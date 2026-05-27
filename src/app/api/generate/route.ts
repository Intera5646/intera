import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import {
  generate,
  generateDraftRender,
  generateDepthMap,
} from '../../../lib/ai/adapter';
import {
  buildDesignBrief,
  buildFallbackPrompt,
  buildRoomPrompts,
  formatReportText,
  type DesignBrief,
  type RoomInfo,
  type RoomPrompt,
} from '../../../lib/ai/groq';
import { STYLE_PROMPTS, ROOM_PROMPTS, BUDGET_PROMPTS } from '../../../lib/data/zones_index';

// suppress unused-import warning
void STYLE_PROMPTS; void ROOM_PROMPTS; void BUDGET_PROMPTS;

const defaultCeiling = Number(process.env.DEFAULT_CEILING_HEIGHT_MM ?? '2700');
const controlWeight = Number(process.env.CONTROLNET_WEIGHT ?? '1.2');
void controlWeight; // used by adapter internally

const ANGLE_VARIANTS = [
  'front view, main perspective',
  'side view, alternative angle',
  'detail view, close up on furniture arrangement',
  'wide angle, full room overview',
] as const;

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('[generate] Request received');

  try {
    const body = await req.json();

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

    const residents           = String(body.residents ?? '').trim() || null;
    const hasPets             = String(body.has_pets ?? '').trim() || null;
    const needsWorkspace      = String(body.needs_workspace ?? '').trim() || null;
    const lightingPreference  = String(body.lighting_preference ?? '').trim() || null;
    const dislikedColors      = String(body.disliked_colors ?? '').trim() || null;

    if (!roomType || !style || !budget || !planImageUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Необходимы все данные для генерации.' } },
        { status: 400 }
      );
    }

    const balanceResult = await supabaseServer
      .from('profiles')
      .select('token_balance, role')
      .eq('id', session.userId)
      .single();

    if (balanceResult.error || !balanceResult.data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Профиль не найден.' } },
        { status: 404 }
      );
    }

    const isAdmin = balanceResult.data.role === 'admin';
    const balance = isAdmin ? Infinity : (balanceResult.data.token_balance ?? 0);
    if (!isAdmin && balance < roomCount) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_TOKENS', message: 'Недостаточно токенов.' } },
        { status: 400 }
      );
    }

    // Create project
    const projectRecord = await supabaseServer
      .from('projects')
      .insert({
        user_id: session.userId,
        title: `${style} · ${roomType}`,
        room_type: roomType,
        apartment_type: apartmentType || null,
        upload_type: uploadType,
        style,
        budget_level: budget,
        status: 'processing',
        residents,
        has_pets: hasPets,
        needs_workspace: needsWorkspace,
        lighting_preference: lightingPreference,
        disliked_colors: dislikedColors,
        detected_rooms_json: detectedRoomsJson,
        room_count: roomCount,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (projectRecord.error || !projectRecord.data) {
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Не удалось создать проект.' } },
        { status: 500 }
      );
    }

    const projectId = projectRecord.data.id;

    // Create master generation record (used for navigation + overall status)
    const generationRecord = await supabaseServer
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

    if (generationRecord.error || !generationRecord.data) {
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: 'Не удалось создать задачу генерации.' } },
        { status: 500 }
      );
    }

    const generationId = generationRecord.data.id;

    void runGeneration({
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
      residents,
      hasPets,
      needsWorkspace,
      lightingPreference,
      dislikedColors,
    });

    return NextResponse.json({ success: true, generationId, projectId });
  } catch (error) {
    console.error('[generate] Unexpected error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
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

  try {
    await supabaseServer
      .from('generations')
      .update({ status: 'processing' })
      .eq('id', params.generationId);

    // Spend tokens upfront (all rooms atomically)
    if (!params.isAdmin) {
      await supabaseServer.rpc('spend_user_tokens', {
        p_user_id: params.session.userId,
        p_amount: params.roomCount,
        p_project_id: params.projectId,
      });
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[runGeneration] Failed:', errorMessage);

    if (!params.isAdmin) {
      await refundTokens(params.session.userId, params.roomCount, params.projectId);
    }

    await supabaseServer
      .from('generations')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', params.generationId);

    await supabaseServer
      .from('projects')
      .update({ status: 'error' })
      .eq('id', params.projectId);
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
    .slice(0, 4);

  const processingTime = Math.round((Date.now() - startTime) / 1000);
  const reportText = brief ? formatReportText(brief.report_sections) : null;

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
  console.log(`[room:${room.name}] Step 4: final renders (${ANGLE_VARIANTS.length} angles)`);
  const renderResults = await Promise.allSettled(
    ANGLE_VARIANTS.map((angle) =>
      generate({
        depthMapUrl: draftRenderUrl,
        prompt: `${opts.sdPromptForRoom}, ${angle}`,
        negativePrompt: opts.sdNegForRoom,
        numOutputs: 2,
        controlWeight: 1.0,
        roomType: room.name,
        anonUuid: cryptoRandomUuid(),
        strength: 0.8,
        guidanceScale: 15,
      })
    )
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
      depth_map_url: depthMapUrl ?? undefined,
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
  console.log(`[photo] Running 4 angle renders for: ${params.roomType}`);

  const renderResults = await Promise.allSettled(
    ANGLE_VARIANTS.map((angle) =>
      generate({
        depthMapUrl: params.planImageUrl,
        prompt: `${sdPrompt}, ${angle}`,
        negativePrompt: sdNegativePrompt,
        numOutputs: 2,
        controlWeight: 1.0,
        roomType: params.roomType,
        anonUuid: cryptoRandomUuid(),
        strength: 0.8,
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

  if (!succeeded && !params.isAdmin) {
    await refundTokens(params.session.userId, params.roomCount, params.projectId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function refundTokens(userId: string, amount: number, projectId: string) {
  try {
    await supabaseServer.from('token_transactions').insert({
      user_id: userId,
      amount,
      type: 'refund',
      reason: 'generation_failed',
      project_id: projectId,
      created_at: new Date().toISOString(),
    });
    await supabaseServer.rpc('spend_user_tokens', {
      p_user_id: userId,
      p_amount: -amount,
      p_project_id: projectId,
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
