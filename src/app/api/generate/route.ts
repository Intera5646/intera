import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import { parseFloorPlan } from '../../../lib/ai/floorPlanParser';
import { buildFloorPlan3D } from '../../../lib/ai/floorPlan3D';
import { generate } from '../../../lib/ai/adapter';
import { STYLE_PROMPTS, ROOM_PROMPTS, BUDGET_PROMPTS } from '../../../lib/data/zones_index';
const defaultCeiling = Number(process.env.DEFAULT_CEILING_HEIGHT_MM ?? '2700');
const controlWeight = Number(process.env.CONTROLNET_WEIGHT ?? '1.2');

export async function POST(req: NextRequest) {
  console.log('Generate request received');

  try {
    const body = await req.json();
    console.log('Generate request body:', body);

    const token = parseSessionCookie(req.headers.get('cookie'));
    console.log('Session token found:', Boolean(token));
    if (!token) {
      console.log('Generate request: missing session token');
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } }, { status: 401 });
    }

    const session = verifySessionToken(token);
    console.log('Session verified:', Boolean(session));
    if (!session) {
      console.log('Generate request: invalid session token');
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Сессия недействительна.' } }, { status: 401 });
    }

    const roomType = String(body.room_type ?? '').trim();
    const style = String(body.style ?? '').trim();
    const budget = String(body.budget ?? '').trim();
    const ceilingHeight = Number(body.ceiling_height ?? defaultCeiling);
    const planImageUrl = String(body.plan_image_url ?? '').trim();

    console.log('Generate request parsed body', { roomType, style, budget, ceilingHeight, planImageUrl });

    if (!roomType || !style || !budget || !planImageUrl) {
      console.log('Generate request: invalid input');
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Необходимы все данные для генерации.' } }, { status: 400 });
    }

    const balanceResult = await supabaseServer
      .from('profiles')
      .select('token_balance, role')
      .eq('id', session.userId)
      .single();

    console.log('Generate request token check result:', {
      error: balanceResult.error?.message,
      role: balanceResult.data?.role,
      token_balance: balanceResult.data?.token_balance,
    });

    if (balanceResult.error || !balanceResult.data) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Профиль не найден.' } }, { status: 404 });
    }

    const balance = balanceResult.data.role === 'admin' ? -1 : balanceResult.data.token_balance ?? 0;
    if (balance !== -1 && balance < 1) {
      return NextResponse.json({ success: false, error: { code: 'INSUFFICIENT_TOKENS', message: 'Недостаточно токенов.' } }, { status: 400 });
    }

    const projectRecord = await supabaseServer.from('projects').insert({
      user_id: session.userId,
      title: `${style} ${roomType}`,
      room_type: roomType,
      style,
      budget_level: budget,
      status: 'processing',
      created_at: new Date().toISOString(),
    }).select('id').single();

    if (projectRecord.error || !projectRecord.data) {
      console.error('Generate request: failed to create project record', projectRecord.error);
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: projectRecord.error?.message ?? 'Не удалось создать проект.' } }, { status: 500 });
    }

    const projectId = projectRecord.data.id;
    console.log('Generate request: created project', projectId);

    const generationRecord = await supabaseServer.from('generations').insert({
      project_id: projectId,
      status: 'pending',
      prompt_used: `${style} ${budget}`,
      budget_range: { budget, currency: 'RUB' },
      created_at: new Date().toISOString(),
    }).select('id').single();

    if (generationRecord.error || !generationRecord.data) {
      console.error('Generate request: failed to create generation record', generationRecord.error);
      return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: generationRecord.error?.message ?? 'Не удалось создать задачу генерации.' } }, { status: 500 });
    }

    const generationId = generationRecord.data.id;
    console.log('Generate request: created generation', generationId);
    // We return the generations.id here and redirect to /projects/[id] by that same ID.

    void runGeneration({
      generationId,
      projectId,
      session,
      roomType,
      style,
      budget,
      ceilingHeight,
      planImageUrl,
    });

    return NextResponse.json({ success: true, generationId });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

type RunGenerationParams = {
  generationId: string;
  projectId: string;
  session: { userId: string; role: string; phone: string; exp: number };
  roomType: string;
  style: string;
  budget: string;
  ceilingHeight: number;
  planImageUrl: string;
};

async function runGeneration(params: RunGenerationParams) {
  console.log('runGeneration start', {
    generationId: params.generationId,
    projectId: params.projectId,
    roomType: params.roomType,
    style: params.style,
    budget: params.budget,
    planImageUrl: params.planImageUrl,
    provider: process.env.GENERATION_PROVIDER,
    replicateToken: !!process.env.REPLICATE_API_TOKEN,
  });

  try {
    await supabaseServer.from('generations').update({ status: 'processing' }).eq('id', params.generationId);

    const parsed = await parseFloorPlan(params.planImageUrl);
    console.log('parsed result:', JSON.stringify(parsed));
    console.log('runGeneration parseFloorPlan result', { parsedShape: parsed?.shape ?? null, parsedRooms: parsed?.rooms?.length ?? 0 });

    const depthMapResult = await buildFloorPlan3D(parsed, params.ceilingHeight);
    console.log('runGeneration buildFloorPlan3D done', { depthMapSize: depthMapResult.depthMapBuffer.length });

    const depthMapDataUrl = `data:image/png;base64,${depthMapResult.depthMapBuffer.toString('base64')}`;

    const prompt = buildPrompt(params.roomType, params.style, params.budget);
    const negativePrompt = 'bad geometry, distorted walls, cartoon, watermark, text';

    console.log('runGeneration calling generate', { prompt, negativePrompt, numOutputs: 4, controlWeight });

    const renderUrls = await generate({
      depthMapUrl: params.planImageUrl,
      prompt,
      negativePrompt,
      numOutputs: 4,
      controlWeight,
      roomType: params.roomType,
      anonUuid: cryptoRandomUuid(),
    });

    console.log('runGeneration generate returned', { renderUrlsCount: renderUrls?.length ?? 0, renderUrls });

    const renderUrlStrings = (renderUrls ?? []).map((r: any) => {
      if (typeof r === 'string') return r;
      if (typeof r?.url === 'function') return r.url();
      if (typeof r?.url === 'string') return r.url;
      return String(r);
    });

    console.log('runGeneration normalized renderUrls:', renderUrlStrings);

    await supabaseServer.from('generations').update({
      status: 'done',
      render_urls: renderUrlStrings,
      processing_time: Math.round(depthMapResult.depthMapBuffer.length / 1024),
    }).eq('id', params.generationId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('runGeneration failed', { error, errorMessage });

    await supabaseServer.from('generations').update({
      status: 'failed',
      error_message: errorMessage,
    }).eq('id', params.generationId);
  }
}

function buildPrompt(roomType: string, style: string, budget: string) {
  return `A photorealistic ${roomType} interior in ${style} style with ${budget} budget. Stable geometry, natural lighting, elegant materials.`;
}

function cryptoRandomUuid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
