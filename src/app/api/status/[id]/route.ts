import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase/server';
import { parseSessionCookie, verifySessionToken } from '../../../../lib/auth';
import { getPrediction } from '../../../../lib/ai/adapter';
import { buildApartmentReport, type DesignerText } from '../../../../lib/ai/groq';
import type { ApartmentGeometry } from '../../../../lib/geometry/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — status polling requires a valid session
  const token = parseSessionCookie(req.headers.get('cookie'));
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const generationId = id;
  if (!generationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Идентификатор генерации обязателен.' } },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from('generations')
    .select('status, render_urls, error_message, designer_text, project_id, created_at, camera_metadata')
    .eq('id', generationId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Генерация не найдена.' } },
      { status: 404 }
    );
  }

  // Ownership check
  if (session.role !== 'admin') {
    const { data: project, error: projectError } = await supabaseServer
      .from('projects')
      .select('user_id')
      .eq('id', data.project_id)
      .single();
    if (projectError || !project || project.user_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Нет доступа к этой генерации.' } },
        { status: 403 }
      );
    }
  }

  // ── Async SDXL prediction polling ────────────────────────────────────────────
  // When the master generation is 'processing', child rows may still be waiting
  // for their Replicate prediction to complete. Resolve them here.
  let effectiveStatus = data.status as string;
  let effectiveError  = (data.error_message as string | null) ?? null;
  let renderUrls      = (data.render_urls as string[] | null) ?? [];

  if (effectiveStatus === 'processing') {
    const resolved = await resolvePendingPredictions(data.project_id as string, generationId);
    renderUrls     = resolved.aggregatedUrls.length > 0 ? resolved.aggregatedUrls : renderUrls;
    if (resolved.allDone) {
      effectiveStatus = resolved.anyRenderUrls ? 'done' : 'failed';
      effectiveError  = resolved.anyRenderUrls ? null : 'All room predictions failed';
    }
  }

  // Treat stuck pending/processing generations as failed after 10 minutes
  if (effectiveStatus === 'pending' || effectiveStatus === 'processing') {
    const ageMs = Date.now() - new Date(data.created_at as string).getTime();
    if (ageMs > 10 * 60 * 1000) {
      effectiveStatus = 'failed';
      effectiveError  = 'Generation timed out';
    }
  }

  const progress =
    effectiveStatus === 'done'       ? 100 :
    effectiveStatus === 'processing' ? 60  :
    effectiveStatus === 'pending'    ? 20  : 0;

  return NextResponse.json({
    success:        true,
    status:         effectiveStatus,
    progress,
    render_urls:    renderUrls,
    error_message:  effectiveError,
    designer_text:  (data.designer_text as Record<string, unknown> | null) ?? null,
    camera_metadata: (data as Record<string, unknown>).camera_metadata ?? null,
  });
}

// ── Prediction resolver ───────────────────────────────────────────────────────

type ResolveResult = {
  allDone: boolean;
  anyRenderUrls: boolean;
  aggregatedUrls: string[];
};

async function resolvePendingPredictions(
  projectId: string,
  masterGenerationId: string,
): Promise<ResolveResult> {
  // Find all per-room child rows (room_index >= 0 means per-room, not the master row)
  const { data: childRows, error: childErr } = await supabaseServer
    .from('generations')
    .select('id, status, render_urls, replicate_prediction_id')
    .eq('project_id', projectId)
    .neq('id', masterGenerationId)
    .gte('room_index', 0);

  if (childErr || !childRows || childRows.length === 0) {
    return { allDone: false, anyRenderUrls: false, aggregatedUrls: [] };
  }

  const pendingRows = childRows.filter(
    r => r.status === 'pending_render' && r.replicate_prediction_id,
  );

  // Poll Replicate for all pending predictions in parallel
  if (pendingRows.length > 0) {
    await Promise.allSettled(
      pendingRows.map(async (row) => {
        try {
          const pred = await getPrediction(row.replicate_prediction_id as string);

          if (pred.status === 'succeeded') {
            console.log(`[status] Prediction ${pred.id} succeeded — ${pred.urls.length} URL(s)`);
            await supabaseServer
              .from('generations')
              .update({ status: 'done', render_urls: pred.urls, image_urls: pred.urls })
              .eq('id', row.id as string);
          } else if (pred.status === 'failed' || pred.status === 'canceled') {
            console.warn(`[status] Prediction ${pred.id} ${pred.status}: ${pred.error}`);
            await supabaseServer
              .from('generations')
              .update({ status: 'failed', error_message: pred.error ?? pred.status })
              .eq('id', row.id as string);
          }
          // 'starting' | 'processing' → leave as-is
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[status] Failed to poll prediction ${row.replicate_prediction_id}:`, msg);
        }
      }),
    );
  }

  // Re-fetch child rows after updates
  const { data: refreshed } = await supabaseServer
    .from('generations')
    .select('status, render_urls')
    .eq('project_id', projectId)
    .neq('id', masterGenerationId)
    .gte('room_index', 0);

  if (!refreshed || refreshed.length === 0) {
    return { allDone: false, anyRenderUrls: false, aggregatedUrls: [] };
  }

  const allDone = refreshed.every(r => r.status === 'done' || r.status === 'failed');
  const aggregatedUrls = refreshed
    .flatMap(r => (r.render_urls as string[] | null) ?? [])
    .filter(Boolean);
  const anyRenderUrls = aggregatedUrls.length > 0;

  // If all predictions resolved, generate apartment report then update master row
  if (allDone) {
    let designerText: DesignerText | null = null;
    let reportText: string | null = null;

    if (anyRenderUrls) {
      try {
        const { data: projectRow } = await supabaseServer
          .from('projects')
          .select('style, budget_level, geometry_extracted_json')
          .eq('id', projectId)
          .single();
        const geometry = (projectRow?.geometry_extracted_json as ApartmentGeometry | null) ?? null;
        if (geometry?.rooms?.length) {
          const report = await buildApartmentReport({
            geometry,
            style: projectRow!.style ?? '',
            budget: projectRow!.budget_level ?? '',
          });
          designerText = report.designerText;
          reportText = report.reportText;
          console.log(`[status] Apartment report generated for master ${masterGenerationId}`);
        }
      } catch (reportErr) {
        console.warn('[status] buildApartmentReport failed (non-fatal):', reportErr instanceof Error ? reportErr.message : reportErr);
      }
    }

    try {
      await supabaseServer
        .from('generations')
        .update({
          status:      anyRenderUrls ? 'done' : 'failed',
          render_urls: aggregatedUrls,
          image_urls:  aggregatedUrls,
          ...(designerText ? { designer_text: designerText, report_text: reportText } : {}),
          ...(anyRenderUrls ? {} : { error_message: 'All room predictions failed' }),
        })
        .eq('id', masterGenerationId);

      await supabaseServer
        .from('projects')
        .update({ status: anyRenderUrls ? 'done' : 'error' })
        .eq('id', projectId);

      console.log(`[status] Master generation ${masterGenerationId} resolved — ${aggregatedUrls.length} render(s)`);
    } catch (writeErr) {
      console.error('[status] Failed to update master generation:', writeErr);
    }
  }

  return { allDone, anyRenderUrls, aggregatedUrls };
}
