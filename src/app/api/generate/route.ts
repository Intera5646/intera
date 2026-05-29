import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import {
  generate,
  generateDraftRender,
  generateDepthMap,
  generateWithDepthControlNet,
  generateFluxDepthPro,
} from '../../../lib/ai/adapter';
import {
  buildDesignBrief,
  buildFallbackPrompt,
  buildRoomPrompts,
  buildWallAwareBrief,
  buildApartmentReport,
  buildRoomFurniturePlan,
  formatReportText,
  type DesignBrief,
  type DesignerText,
  type RoomInfo,
  type RoomPrompt,
} from '../../../lib/ai/groq';
import { generateSemanticRenderBuffer } from '../../../lib/geometry/depthMap';
import type { ApartmentGeometry, GeometryRoom } from '../../../lib/geometry/types';
import { STYLE_PROMPTS, ROOM_PROMPTS, BUDGET_PROMPTS } from '../../../lib/data/zones_index';

// Allow long-running background generation on Vercel
export const maxDuration = 300;

// suppress unused-import warning
void STYLE_PROMPTS; void ROOM_PROMPTS; void BUDGET_PROMPTS;

const defaultCeiling = Number(process.env.DEFAULT_CEILING_HEIGHT_MM ?? '2700');
const controlWeight = Number(process.env.CONTROLNET_WEIGHT ?? '1.2');
void controlWeight; // used by adapter internally

const ANGLE_VARIANTS = [
  'front view, main perspective',
  'wide angle, full room overview',
] as const;

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('[generate] Request received');

  try {
    console.log('[generate] Step 1: parsing body');
    const body = await req.json();

    console.log('[generate] Step 2: auth check');
    const token = parseSessionCookie(req.headers.get('cookie'));
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } },
        { status: 401 }
      );
    }

    const session = verifySessionToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Сессия недействительна.' } },
        { status: 401 }
      );
    }
    console.log('[generate] Step 2: auth OK, userId:', session.userId, 'role:', session.role);

    const roomType        = String(body.room_type ?? '').trim();
    const apartmentType   = String(body.apartment_type ?? '').trim();
    const uploadType      = String(body.upload_type ?? 'photo').trim();
    const style           = String(body.style ?? '').trim();
    const budget          = String(body.budget ?? '').trim();
    const ceilingHeight   = Number(body.ceiling_height ?? defaultCeiling);
    const planImageUrl    = String(body.plan_image_url ?? '').trim();
    const wishes          = String(body.user_wishes ?? '').trim();
    const roomCount       = Math.max(1, Number(body.room_count ?? 1));
    const detectedRoomsJson = String(body.detected_rooms_json ?? '').trim() || null;
    // v2 pipeline: ApartmentGeometry from /api/analyze-floor-plan
    const geometryJson: ApartmentGeometry | null =
      body.geometry_json && typeof body.geometry_json === 'object'
        ? (body.geometry_json as ApartmentGeometry)
        : null;

    const residents           = String(body.residents ?? '').trim() || null;
    const hasPets             = String(body.has_pets ?? '').trim() || null;
    const needsWorkspace      = String(body.needs_workspace ?? '').trim() || null;
    const lightingPreference  = String(body.lighting_preference ?? '').trim() || null;
    const dislikedColors      = String(body.disliked_colors ?? '').trim() || null;

    console.log('[generate] Step 2b: parsed fields — roomType:', roomType, '| style:', style, '| budget:', budget, '| planImageUrl:', planImageUrl.slice(0, 60));

    if (!roomType || !style || !budget || !planImageUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Необходимы все данные для генерации.' } },
        { status: 400 }
      );
    }

    console.log('[generate] Step 3: reading balance');
    const balanceResult = await supabaseServer
      .from('profiles')
      .select('token_balance, role')
      .eq('id', session.userId)
      .single();

    console.log('[generate] Step 3: balanceResult error:', balanceResult.error?.message ?? 'none', '| data:', JSON.stringify(balanceResult.data));

    if (balanceResult.error || !balanceResult.data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Профиль не найден.' } },
        { status: 404 }
      );
    }

    const rawBalance = balanceResult.data.token_balance;
    console.log('[generate] Step 4: rawBalance:', rawBalance, '| type:', typeof rawBalance, '| role:', balanceResult.data.role);

    // Admin sentinel: role=admin OR token_balance = -1 (unlimited) OR token_balance = NULL
    const isAdmin = balanceResult.data.role === 'admin' || rawBalance === -1 || rawBalance === null;
    // Treat any negative value as infinite (e.g. -1 sentinel)
    const balance = isAdmin ? Infinity : (rawBalance ?? 0);
    console.log('[generate] Step 4: isAdmin:', isAdmin, '| effective balance:', balance, '| roomCount:', roomCount);

    if (!isAdmin && balance < roomCount) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_TOKENS', message: 'Недостаточно токенов.' } },
        { status: 400 }
      );
    }

    // Spend tokens BEFORE generation starts.
    // SQL spend_user_tokens returns NULL on insufficient balance — must check `data`, not just `error`.
    if (!isAdmin) {
      console.log('[generate] Step 5: spending', roomCount, 'tokens for user', session.userId);
      const { data: remaining, error: spendError } = await supabaseServer.rpc('spend_user_tokens', {
        user_uuid: session.userId,
        amount: roomCount,
      });
      console.log('[generate] Step 5: spend result — remaining:', remaining, '| error:', spendError?.message ?? 'none');
      if (spendError) {
        console.error('[generate] Token spend RPC error:', spendError);
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: 'Не удалось списать токены.' } },
          { status: 500 }
        );
      }
      // NULL return = atomic WHERE clause matched no row (insufficient balance race)
      if (remaining === null || remaining === undefined) {
        return NextResponse.json(
          { success: false, error: { code: 'INSUFFICIENT_TOKENS', message: 'Недостаточно токенов.' } },
          { status: 400 }
        );
      }
    } else {
      console.log('[generate] Step 5: skipping token spend (admin/unlimited)');
    }

    // ── Step 6: Create project ──────────────────────────────────────────────
    console.log('[generate] Step 6: inserting project row — user_id:', session.userId, '| roomCount:', roomCount);
    let projectRecord;
    try {
      projectRecord = await supabaseServer
        .from('projects')
        .insert({
          user_id: session.userId,
          title: `${style} · ${roomType}`,
          room_type: roomType,
          style,
          budget_level: budget,
          status: 'processing',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    } catch (insertErr) {
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      console.error('[generate] Step 6 THREW synchronously:', msg);
      if (!isAdmin) await refundTokens(session.userId, roomCount, null);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: `Project insert threw: ${msg}` } },
        { status: 500 }
      );
    }

    console.log('[generate] Step 6 result — error:', projectRecord.error?.message ?? 'none', '| code:', projectRecord.error?.code ?? 'none', '| data:', JSON.stringify(projectRecord.data));

    if (projectRecord.error || !projectRecord.data) {
      const errDetail = projectRecord.error ? `${projectRecord.error.code}: ${projectRecord.error.message}` : 'no data returned';
      console.error('[generate] Step 6 FAILED:', errDetail);
      if (!isAdmin) await refundTokens(session.userId, roomCount, null);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: `Не удалось создать проект: ${errDetail}` } },
        { status: 500 }
      );
    }

    const projectId = projectRecord.data.id;
    console.log('[generate] Step 7: project created OK, projectId:', projectId);

    // ── Step 8: Log token transaction ───────────────────────────────────────
    if (!isAdmin) {
      console.log('[generate] Step 8: inserting token_transaction');
      try {
        const txResult = await supabaseServer.from('token_transactions').insert({
          user_id: session.userId,
          amount: -roomCount,
          type: 'generation',
          reason: 'generation_started',
          project_id: projectId,
          created_at: new Date().toISOString(),
        });
        console.log('[generate] Step 8 done — error:', txResult.error?.message ?? 'none');
      } catch (txErr) {
        // Non-fatal: token was already spent; just log and continue
        console.warn('[generate] Step 8 token_transactions insert threw (non-fatal):', txErr instanceof Error ? txErr.message : txErr);
      }
    } else {
      console.log('[generate] Step 8: skipping token_transaction (admin)');
    }

    // ── Step 9: Create master generation record ─────────────────────────────
    console.log('[generate] Step 9: inserting generation record');
    let generationRecord;
    try {
      generationRecord = await supabaseServer
        .from('generations')
        .insert({
          project_id: projectId,
          status: 'pending',
          room_name: uploadType === 'bti' ? 'apartment' : roomType,
          room_index: uploadType === 'bti' ? -1 : 0,
          prompt_used: `${style} ${budget} ${roomType}`,
          budget_range: { budget, currency: 'RUB' },
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    } catch (genInsertErr) {
      const msg = genInsertErr instanceof Error ? genInsertErr.message : String(genInsertErr);
      console.error('[generate] Step 9 THREW synchronously:', msg);
      if (!isAdmin) await refundTokens(session.userId, roomCount, projectId);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: `Generation insert threw: ${msg}` } },
        { status: 500 }
      );
    }

    console.log('[generate] Step 9 result — error:', generationRecord.error?.message ?? 'none', '| code:', generationRecord.error?.code ?? 'none', '| id:', generationRecord.data?.id ?? 'null');

    if (generationRecord.error || !generationRecord.data) {
      const errDetail = generationRecord.error ? `${generationRecord.error.code}: ${generationRecord.error.message}` : 'no data returned';
      console.error('[generate] Step 9 FAILED:', errDetail);
      if (!isAdmin) await refundTokens(session.userId, roomCount, projectId);
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: `Не удалось создать задачу генерации: ${errDetail}` } },
        { status: 500 }
      );
    }

    const generationId = generationRecord.data.id;
    console.log('[generate] Step 10: firing background generation — generationId:', generationId);

    waitUntil(runGeneration({
      generationId,
      projectId,
      session,
      roomType,
      apartmentType: apartmentType || undefined,
      uploadType,
      style,
      budget,
      wishes,
      ceilingHeight,
      planImageUrl,
      isAdmin,
      roomCount,
      detectedRoomsJson,
      geometryJson,
      residents,
      hasPets,
      needsWorkspace,
      lightingPreference,
      dislikedColors,
    }));

    console.log('[generate] Step 11: returning success { generationId, projectId }');
    return NextResponse.json({ success: true, generationId, projectId });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('[generate] FATAL:', errMsg);
    if (errStack) console.error('[generate] FATAL stack:', errStack);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: errMsg } },
      { status: 500 }
    );
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Session = { userId: string; role: string; phone: string; exp: number };

type RunGenerationParams = {
  generationId: string;
  projectId: string;
  session: Session;
  roomType: string;
  apartmentType?: string;
  uploadType: string;
  style: string;
  budget: string;
  wishes: string;
  ceilingHeight: number;
  planImageUrl: string;
  isAdmin: boolean;
  roomCount: number;
  detectedRoomsJson: string | null;
  geometryJson: ApartmentGeometry | null;
  residents: string | null;
  hasPets: string | null;
  needsWorkspace: string | null;
  lightingPreference: string | null;
  dislikedColors: string | null;
};

// ── Main generation dispatcher ────────────────────────────────────────────────

async function runGeneration(params: RunGenerationParams) {
  const startTime = Date.now();
  console.log(`[runGeneration] Starting — uploadType: ${params.uploadType}, rooms: ${params.roomCount}`);

  // FIXED: tokens are now spent in POST handler before this runs.
  // Inner pipelines own their refund logic; outer catch must not refund
  // (would double-refund on top of partial inner refunds).

  try {
    await supabaseServer
      .from('generations')
      .update({ status: 'processing' })
      .eq('id', params.generationId);

    // Stage A: Global design brief from Groq
    let brief: DesignBrief | null = null;
    let sdPrompt: string;
    let sdNegativePrompt: string;

    try {
      brief = await buildDesignBrief({
        roomType: params.roomType,
        style: params.style,
        budget: params.budget,
        ceilingHeight: params.ceilingHeight,
        apartmentType: params.apartmentType,
        uploadType: params.uploadType,
        residents: params.residents,
        hasPets: params.hasPets,
        needsWorkspace: params.needsWorkspace,
        lightingPreference: params.lightingPreference,
        dislikedColors: params.dislikedColors,
        wishes: params.wishes,
      });
      sdPrompt = brief.sd_prompt ?? '';
      sdNegativePrompt = brief.sd_negative_prompt ?? '';
      console.log('[runGeneration] Brief ready, sd_prompt length:', sdPrompt.length);
    } catch (briefErr) {
      console.warn('[runGeneration] buildDesignBrief failed, using fallback:', briefErr);
      const fallback = buildFallbackPrompt({ roomType: params.roomType, style: params.style, budget: params.budget });
      sdPrompt = fallback.sdPrompt;
      sdNegativePrompt = fallback.sdNegativePrompt;
    }

    if (params.uploadType === 'bti' || params.uploadType === 'combined') {
      await runBtiPipeline({ params, brief, sdPrompt, sdNegativePrompt, startTime });
    } else {
      await runPhotoPipeline({ params, brief, sdPrompt, sdNegativePrompt, startTime });
    }
  } catch (error) {
    // FIXED: unhandled orchestration error. Inner pipelines wrap their own writes,
    // so reaching here means catastrophic failure with no inner refund done.
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[runGeneration] Unhandled error (defensive):', errorMessage);

    try {
      await supabaseServer
        .from('generations')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', params.generationId);
      await supabaseServer
        .from('projects')
        .update({ status: 'error' })
        .eq('id', params.projectId);
    } catch (writeErr) {
      console.error('[runGeneration] Failed to mark failure status:', writeErr);
    }

    if (!params.isAdmin) {
      await refundTokens(params.session.userId, params.roomCount, params.projectId);
    }
  }
}

// ── BTI 4-step pipeline ───────────────────────────────────────────────────────

async function runBtiPipeline(ctx: {
  params: RunGenerationParams;
  brief: DesignBrief | null;
  sdPrompt: string;
  sdNegativePrompt: string;
  startTime: number;
}) {
  const { params, brief, sdPrompt, sdNegativePrompt, startTime } = ctx;

  // ── v2 path: Flux Depth Pro with procedural depth map ────────────────────
  const useV2 = (process.env.BTI_PIPELINE_V2 ?? '').toLowerCase() === 'true';
  if (useV2 && params.geometryJson?.rooms?.length) {
    console.log('[BTI] BTI_PIPELINE_V2=true and geometry present — using v2 pipeline');
    await runBtiPipelineV2({ params, geometry: params.geometryJson, startTime });
    return;
  }
  if (useV2) {
    console.log('[BTI] BTI_PIPELINE_V2=true but no geometry_json — falling back to v1');
  }

  // ── v1 path: existing adirik/MiDaS pipeline ───────────────────────────────

  // Parse detected rooms
  let rooms: RoomInfo[] = [];
  if (params.detectedRoomsJson) {
    try {
      const parsed = JSON.parse(params.detectedRoomsJson);
      if (Array.isArray(parsed)) rooms = parsed as RoomInfo[];
    } catch (e) {
      console.warn('[BTI] Failed to parse detectedRoomsJson:', e);
    }
  }
  if (rooms.length === 0) {
    rooms = [{
      id: 'R1', name: params.roomType || 'Комната',
      approximate_size: 'medium', windows: 'yes', natural_light: 'medium', connected_to: [],
    }];
  }
  console.log(`[BTI] Processing ${rooms.length} rooms:`, rooms.map(r => r.name).join(', '));

  // Build per-room prompts
  let roomPrompts: RoomPrompt[] = [];
  if (brief) {
    try {
      roomPrompts = await buildRoomPrompts({
        rooms,
        style: params.style,
        budget: params.budget,
        concept: brief.concept ?? '',
      });
      console.log('[BTI] Room prompts built:', roomPrompts.length);
    } catch (rpe) {
      console.warn('[BTI] buildRoomPrompts failed, will use global prompt per room:', rpe);
    }
  }

  // Process all rooms in parallel
  const results = await Promise.allSettled(
    rooms.map((room, idx) => {
      const rp = roomPrompts[idx];
      return runRoomPipeline({
        room,
        roomIndex: idx,
        projectId: params.projectId,
        style: params.style,
        apartmentType: params.apartmentType,
        planImageUrl: params.planImageUrl,
        sdPromptForRoom: rp?.sd_prompt ?? `${sdPrompt}, ${room.name}`,
        sdNegForRoom: rp?.sd_negative_prompt ?? sdNegativePrompt,
        reportForRoom: rp?.report_text ?? null,
        colorPalette: brief?.color_palette ?? null,
      });
    })
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failedCount = rooms.length - successCount;
  console.log(`[BTI] Done: ${successCount} succeeded, ${failedCount} failed`);

  // Partial refund for failed rooms
  if (!params.isAdmin && failedCount > 0) {
    await refundTokens(params.session.userId, failedCount, params.projectId);
  }

  // Collect a sample of successful render URLs for the master record
  const sampleUrls = results
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .slice(0, 2);

  const processingTime = Math.round((Date.now() - startTime) / 1000);
  const reportText = brief ? formatReportText(brief.report_sections) : null;

  // FIXED: wrap final status writes so a Supabase failure here can't propagate
  // to runGeneration's outer catch (which would then double-refund on top of
  // the per-room partial refund done above).
  try {
    await supabaseServer.from('generations').update({
      status: successCount === 0 ? 'failed' : 'done',
      render_urls: sampleUrls,
      image_urls: sampleUrls,
      designer_text: brief,
      sd_prompt: sdPrompt,
      report_text: reportText,
      color_palette: brief?.color_palette ?? null,
      processing_time: processingTime,
      ...(successCount === 0 ? { error_message: 'All rooms failed to generate' } : {}),
    }).eq('id', params.generationId);

    await supabaseServer.from('projects').update({
      status: successCount === 0 ? 'error' : 'done',
    }).eq('id', params.projectId);
  } catch (writeErr) {
    console.error('[BTI] Failed to save final status (refunds already done):', writeErr);
  }
}

// ── Single room pipeline (Steps 2–4) ─────────────────────────────────────────

async function runRoomPipeline(opts: {
  room: RoomInfo;
  roomIndex: number;
  projectId: string;
  style: string;
  apartmentType?: string;
  planImageUrl: string;
  sdPromptForRoom: string;
  sdNegForRoom: string;
  reportForRoom: string | null;
  colorPalette: string[] | null;
}): Promise<string[]> {
  const { room } = opts;
  console.log(`[room:${room.name}] Starting pipeline`);

  // Create per-room generation record
  const genRecord = await supabaseServer.from('generations').insert({
    project_id: opts.projectId,
    status: 'processing',
    room_name: room.name,
    room_index: opts.roomIndex,
    sd_prompt: opts.sdPromptForRoom,
    report_text: opts.reportForRoom,
    color_palette: opts.colorPalette,
    created_at: new Date().toISOString(),
  }).select('id').single();

  const roomGenId = genRecord.data?.id ?? null;

  // Step 2: Draft render (txt2img — empty room, no furniture)
  console.log(`[room:${room.name}] Step 2: draft render`);
  let draftRenderUrl: string;
  try {
    draftRenderUrl = await generateDraftRender({
      roomName: room.name,
      style: opts.style,
      apartmentType: opts.apartmentType,
    });
    console.log(`[room:${room.name}] Step 2 done:`, draftRenderUrl.slice(0, 70));
  } catch (err) {
    console.warn(`[room:${room.name}] Step 2 failed, using plan image as base:`, err instanceof Error ? err.message : err);
    draftRenderUrl = opts.planImageUrl;
  }

  // Step 3: Depth map via MiDaS
  console.log(`[room:${room.name}] Step 3: MiDaS depth map`);
  let depthMapUrl: string | null = null;
  try {
    depthMapUrl = await generateDepthMap(draftRenderUrl);
    console.log(`[room:${room.name}] Step 3 done:`, depthMapUrl.slice(0, 70));
  } catch (err) {
    console.warn(`[room:${room.name}] Step 3 (MiDaS) failed, continuing without depth map:`, err instanceof Error ? err.message : err);
  }

  // Step 4: Final renders × 4 angle variants
  // FIXED: if a ControlNet depth model is configured AND we have a depth map,
  // feed the depth map directly so geometry is actually depth-conditioned.
  // Otherwise fall back to adirik/interior-design with the draft render
  // (which computes its own conditioning internally).
  const depthModelConfigured = Boolean(
    depthMapUrl && process.env.REPLICATE_CONTROLNET_DEPTH_MODEL?.trim()
  );
  console.log(
    `[room:${room.name}] Step 4: final renders (${ANGLE_VARIANTS.length} angles) — ` +
      `path: ${depthModelConfigured ? 'depth-controlnet' : 'adirik (fallback)'}`
  );

  const renderResults = await Promise.allSettled(
    ANGLE_VARIANTS.map(async (angle) => {
      const prompt = `${opts.sdPromptForRoom}, ${angle}`;

      // Try depth-controlnet path first if configured and depth map exists
      if (depthModelConfigured && depthMapUrl) {
        try {
          console.log(`[room:${room.name}/${angle}] → depth-controlnet`);
          return await generateWithDepthControlNet({
            depthMapUrl,
            prompt,
            negativePrompt: opts.sdNegForRoom,
            numOutputs: 1,
            guidanceScale: 7.5,
            numInferenceSteps: 30,
          });
        } catch (err) {
          console.warn(
            `[room:${room.name}/${angle}] depth-controlnet failed, falling back to adirik:`,
            err instanceof Error ? err.message : err
          );
          // fall through to adirik
        }
      }

      // Fallback path: existing adirik/interior-design with draft render
      console.log(`[room:${room.name}/${angle}] → adirik`);
      return await generate({
        depthMapUrl: draftRenderUrl,
        prompt,
        negativePrompt: opts.sdNegForRoom,
        numOutputs: 2,
        controlWeight: 1.0,
        roomType: room.name,
        anonUuid: cryptoRandomUuid(),
        strength: 0.8,
        guidanceScale: 15,
      });
    })
  );

  const renderUrls = renderResults
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(Boolean);

  console.log(`[room:${room.name}] Step 4 done: ${renderUrls.length}/${ANGLE_VARIANTS.length} renders`);

  if (renderUrls.length === 0) {
    if (roomGenId) {
      await supabaseServer.from('generations').update({
        status: 'failed',
        error_message: 'All angle renders failed',
      }).eq('id', roomGenId);
    }
    throw new Error(`All renders failed for room: ${room.name}`);
  }

  // Save per-room results
  if (roomGenId) {
    await supabaseServer.from('generations').update({
      status: 'done',
      render_urls: renderUrls,
      image_urls: renderUrls,
      draft_render_url: draftRenderUrl,
      depth_map_url: depthMapUrl ?? null,
    }).eq('id', roomGenId);
  }

  return renderUrls;
}

// ── Photo pipeline (Step 4 only, 4 renders directly) ─────────────────────────

async function runPhotoPipeline(ctx: {
  params: RunGenerationParams;
  brief: DesignBrief | null;
  sdPrompt: string;
  sdNegativePrompt: string;
  startTime: number;
}) {
  const { params, brief, sdPrompt, sdNegativePrompt, startTime } = ctx;
  console.log(`[photo] Running ${ANGLE_VARIANTS.length} angle renders for: ${params.roomType}`);
  console.log('[photo] Using adirik directly with original photo, prompt_strength: 0.6');

  const photoNegativePrompt = `${sdNegativePrompt}, birds, butterflies, insects, flying objects, artifacts, distortion, unrealistic elements, people, text`;

  const renderResults = await Promise.allSettled(
    ANGLE_VARIANTS.map((angle) =>
      generate({
        depthMapUrl: params.planImageUrl,
        prompt: `${sdPrompt}, ${angle}`,
        negativePrompt: photoNegativePrompt,
        numOutputs: 1,
        controlWeight: 1.0,
        roomType: params.roomType,
        anonUuid: cryptoRandomUuid(),
        strength: 0.6,
        guidanceScale: 15,
      })
    )
  );

  const renderUrls = renderResults
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(Boolean);

  console.log(`[photo] Done: ${renderUrls.length}/${ANGLE_VARIANTS.length} renders`);

  const processingTime = Math.round((Date.now() - startTime) / 1000);
  const reportText = brief ? formatReportText(brief.report_sections) : null;
  const succeeded = renderUrls.length > 0;

  // FIXED: refund FIRST so a downstream supabase write failure doesn't skip the refund.
  // Then wrap writes in try/catch so they can't propagate to runGeneration's outer catch.
  if (!succeeded && !params.isAdmin) {
    await refundTokens(params.session.userId, params.roomCount, params.projectId);
  }

  try {
    await supabaseServer.from('generations').update({
      status: succeeded ? 'done' : 'failed',
      render_urls: renderUrls,
      image_urls: renderUrls,
      designer_text: brief,
      sd_prompt: sdPrompt,
      report_text: reportText,
      color_palette: brief?.color_palette ?? null,
      processing_time: processingTime,
      ...(succeeded ? {} : { error_message: 'All renders failed' }),
    }).eq('id', params.generationId);

    await supabaseServer.from('projects').update({
      status: succeeded ? 'done' : 'error',
    }).eq('id', params.projectId);
  } catch (writeErr) {
    console.error('[photo] Failed to save final status:', writeErr);
  }
}

// ── BTI v2 pipeline: procedural depth map → Flux Depth Pro ───────────────────

// FIX 3: named constant for Flux Depth Pro control strength
const CONTROL_STRENGTH = 0.6;

interface CameraMetaEntry {
  camera_index: number;
  camera_at_wall_id: string;
  facing_wall_id: string;
  description: string;
  room_id: string;
  room_name: string; // FIX 7: display room label in UI
  depth_map_url: string;
}

async function runBtiPipelineV2(ctx: {
  params: RunGenerationParams;
  geometry: ApartmentGeometry;
  startTime: number;
}) {
  const { params, geometry, startTime } = ctx;

  // Cache ApartmentGeometry in the project row (non-fatal)
  supabaseServer.from('projects')
    .update({ geometry_extracted_json: geometry })
    .eq('id', params.projectId)
    .then(({ error }) => {
      if (error) console.warn('[BTI-v2] geometry cache write failed (non-fatal):', error.message);
    });

  console.log(`[BTI-v2] Processing ${geometry.rooms.length} rooms in parallel — 1 camera, 1 render each`);

  const roomResults = await Promise.allSettled(
    geometry.rooms.map(async (room, index) => {
      // FIX 5: log each room so failures are traceable
      console.log(`[BTI-v2] Queuing room ${index + 1}/${geometry.rooms.length}: "${room.name}" (${room.type})`);
      if (index > 0) await new Promise(r => setTimeout(r, index * 1000));
      return runBtiRoomV2({ room, params });
    })
  );

  const allRenderUrls: string[] = [];
  const cameraMetas: CameraMetaEntry[] = [];

  for (let i = 0; i < roomResults.length; i++) {
    const result = roomResults[i];
    const room = geometry.rooms[i];
    if (result.status === 'fulfilled') {
      allRenderUrls.push(...result.value.renderUrls);
      cameraMetas.push(result.value.cameraMeta);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[BTI-v2] Room "${room?.name ?? i}" (${room?.type ?? '?'}) FAILED: ${msg}`);
    }
  }

  const processingTime = Math.round((Date.now() - startTime) / 1000);
  const succeeded = allRenderUrls.length > 0;

  if (!succeeded && !params.isAdmin) {
    await refundTokens(params.session.userId, params.roomCount, params.projectId);
  }

  // One Groq call for the whole apartment design report (non-fatal)
  let designerText: DesignerText | null = null;
  let reportText: string | null = null;
  if (succeeded) {
    try {
      const report = await buildApartmentReport({
        geometry,
        style: params.style,
        budget: params.budget,
        wishes: params.wishes || undefined,
      });
      designerText = report.designerText;
      reportText = report.reportText;
      console.log('[BTI-v2] Apartment design report generated');
    } catch (err) {
      console.warn('[BTI-v2] Design report failed (non-fatal):', err instanceof Error ? err.message : err);
    }
  }

  try {
    await supabaseServer.from('generations').update({
      status:          succeeded ? 'done' : 'failed',
      render_urls:     allRenderUrls,
      image_urls:      allRenderUrls,
      camera_metadata: cameraMetas,
      depth_map_url:   cameraMetas[0]?.depth_map_url ?? null,
      processing_time: processingTime,
      ...(designerText ? { designer_text: designerText, report_text: reportText } : {}),
      ...(succeeded ? {} : { error_message: 'Flux Depth Pro returned no renders' }),
    }).eq('id', params.generationId);

    await supabaseServer.from('projects').update({
      status: succeeded ? 'done' : 'error',
    }).eq('id', params.projectId);
  } catch (writeErr) {
    console.error('[BTI-v2] Failed to write final status (refunds already done):', writeErr);
  }
}

async function runBtiRoomV2(opts: {
  room: GeometryRoom;
  params: RunGenerationParams;
}): Promise<{ renderUrls: string[]; cameraMeta: CameraMetaEntry }> {
  const { room, params } = opts;
  const camIdx = 0;

  // FIX 5: clamp tiny rooms (narrow balconies, wc) to minimum 1.5 m sides so
  // the ray-caster never produces a degenerate scene.
  const sanitizedRoom: GeometryRoom = {
    ...room,
    dimensions: {
      ...room.dimensions,
      width_m:  Math.max(1.5, room.dimensions.width_m),
      length_m: Math.max(1.5, room.dimensions.length_m),
    },
  };

  // FIX 1 (belt-and-suspenders): camera wall must not host any furniture
  const camWall = sanitizedRoom.suggested_cameras[0]?.camera_at_wall_id ?? 'W3';

  // Step A: plan furniture with Groq designer
  console.log(`[BTI-v2:${room.name}] Planning furniture`);
  const rawFurniture = await buildRoomFurniturePlan(sanitizedRoom);
  const furniture = rawFurniture.filter(f => f.anchorWallId !== camWall);

  // FIX 6: wider FOV for small rooms so the whole space fits the frame
  const area = sanitizedRoom.dimensions.width_m * sanitizedRoom.dimensions.length_m;
  const fovDeg = area < 4 ? 80 : undefined;

  // Step B: generate colored semantic 3D block render with furniture
  console.log(`[BTI-v2:${room.name}] Generating semantic render (${furniture.length} furniture objects${fovDeg ? ', FOV=' + fovDeg : ''})`);
  const controlPng = await generateSemanticRenderBuffer(sanitizedRoom, { width: 768, height: 768, cameraIndex: camIdx, furniture, fovDeg });

  // Step C: upload to depth-maps bucket (now holds the colored control image)
  const depthPath = `${params.projectId}/${params.generationId}_${room.id}.png`;
  const { data: uploadData, error: uploadErr } = await supabaseServer.storage
    .from('depth-maps')
    .upload(depthPath, controlPng, { contentType: 'image/png', upsert: true });

  if (uploadErr || !uploadData) {
    throw new Error(`control image upload failed for ${room.name}: ${uploadErr?.message ?? 'no data'}`);
  }
  const { data: urlData } = supabaseServer.storage.from('depth-maps').getPublicUrl(uploadData.path);
  const controlImageUrl = urlData.publicUrl;
  console.log(`[BTI-v2:${room.name}] Semantic render →`, controlImageUrl.slice(0, 80));

  // Step D: build wall-aware Groq prompt with frame contract
  const { prompt, negativePrompt } = await buildWallAwareBrief({
    room: sanitizedRoom,
    style: params.style,
    budget: params.budget,
    wishes: params.wishes || undefined,
    cameraIndex: camIdx,
    furniture,
  });

  // Step E: call Flux Depth Pro — colored control image needs higher guidance + steps
  console.log(`[BTI-v2:${room.name}] Calling Flux Depth Pro (controlStrength=${CONTROL_STRENGTH})`);
  const renderUrls = await generateFluxDepthPro({
    controlImage: controlImageUrl,
    prompt,
    negativePrompt,
    numOutputs: 1,
    guidanceScale: 7.5,
    numInferenceSteps: 35,
    controlStrength: CONTROL_STRENGTH, // FIX 3
  });
  console.log(`[BTI-v2:${room.name}] ${renderUrls.length} render(s) returned`);

  const cam = sanitizedRoom.suggested_cameras[camIdx];
  return {
    renderUrls,
    cameraMeta: {
      camera_index:      camIdx,
      camera_at_wall_id: cam?.camera_at_wall_id ?? 'W3',
      facing_wall_id:    cam?.facing_wall_id    ?? 'W1',
      description:       cam?.description       ?? '',
      room_id:           room.id,
      room_name:         room.name, // FIX 7
      depth_map_url:     controlImageUrl,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// FIXED: projectId nullable — early-stage failures (project creation, gen record creation)
// refund tokens before a project_id exists.
async function refundTokens(userId: string, amount: number, projectId: string | null) {
  try {
    // SQL function: spend_user_tokens(user_uuid, amount, project_uuid) — negative amount restores balance
    await supabaseServer.rpc('spend_user_tokens', {
      user_uuid: userId,
      amount: -amount,
      project_uuid: projectId ?? undefined,
    });
    await supabaseServer.from('token_transactions').insert({
      user_id: userId,
      amount, // positive = credit back to user
      type: 'refund',
      reason: 'generation_failed',
      project_id: projectId,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[refundTokens] Failed:', err);
  }
}

function cryptoRandomUuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
