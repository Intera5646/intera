import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import { parseFloorPlan } from '../../../lib/ai/floorPlanParser';
import { buildFloorPlan3D } from '../../../lib/ai/floorPlan3D';
import { generate } from '../../../lib/ai/adapter';
import { generateDesignerText, buildGenerationPrompt } from '../../../lib/ai/groq';
import { STYLE_PROMPTS, ROOM_PROMPTS, BUDGET_PROMPTS } from '../../../lib/data/zones_index';

const defaultCeiling = Number(process.env.DEFAULT_CEILING_HEIGHT_MM ?? '2700');
const controlWeight = Number(process.env.CONTROLNET_WEIGHT ?? '1.2');

// suppress unused-import warning — these are available for future use
void STYLE_PROMPTS;
void ROOM_PROMPTS;
void BUDGET_PROMPTS;

export async function POST(req: NextRequest) {
  console.log('Generate request received');

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

    const roomType = String(body.room_type ?? '').trim();
    const apartmentType = String(body.apartment_type ?? '').trim();
    const uploadType = String(body.upload_type ?? 'photo').trim();
    const style = String(body.style ?? '').trim();
    const budget = String(body.budget ?? '').trim();
    const ceilingHeight = Number(body.ceiling_height ?? defaultCeiling);
    const planImageUrl = String(body.plan_image_url ?? '').trim();
    const wishes = String(body.user_wishes ?? '').trim();
    const roomCount = Math.max(1, Number(body.room_count ?? 1));

    // Personalization fields (all optional)
    const residents = String(body.residents ?? '').trim() || null;
    const hasPets = String(body.has_pets ?? '').trim() || null;
    const needsWorkspace = String(body.needs_workspace ?? '').trim() || null;
    const lightingPreference = String(body.lighting_preference ?? '').trim() || null;
    const dislikedColors = String(body.disliked_colors ?? '').trim() || null;

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

    const generationRecord = await supabaseServer
      .from('generations')
      .insert({
        project_id: projectId,
        status: 'pending',
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

    // Build enriched wishes string with personalization context
    const personalizationParts: string[] = [];
    if (residents) personalizationParts.push(`Проживает: ${residents}`);
    if (hasPets) personalizationParts.push(`Домашние животные: ${hasPets}`);
    if (needsWorkspace) personalizationParts.push(`Рабочее место: ${needsWorkspace}`);
    if (lightingPreference) personalizationParts.push(`Освещение: ${lightingPreference}`);
    if (dislikedColors) personalizationParts.push(`Нежелательные цвета: ${dislikedColors}`);
    const enrichedWishes = [wishes, ...personalizationParts].filter(Boolean).join('. ');

    void runGeneration({
      generationId,
      projectId,
      session,
      roomType,
      style,
      budget,
      wishes: enrichedWishes,
      ceilingHeight,
      planImageUrl,
      isAdmin,
      roomCount,
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
  wishes: string;
  ceilingHeight: number;
  planImageUrl: string;
  isAdmin: boolean;
  roomCount: number;
};

async function runGeneration(params: RunGenerationParams) {
  const startTime = Date.now();

  try {
    await supabaseServer
      .from('generations')
      .update({ status: 'processing' })
      .eq('id', params.generationId);

    // Spend tokens before starting (skip for admin)
    if (!params.isAdmin) {
      await supabaseServer.rpc('spend_user_tokens', {
        p_user_id: params.session.userId,
        p_amount: params.roomCount,
        p_project_id: params.projectId,
      });
    }

    // Parse floor plan and build 3D depth map
    const parsed = await parseFloorPlan(params.planImageUrl);
    const depthMapResult = await buildFloorPlan3D(parsed, params.ceilingHeight);

    // Upload depth map to Supabase Storage so Replicate can fetch it by URL
    const depthMapPath = `depth-maps/${params.generationId}.png`;
    await supabaseServer.storage
      .from('floor-plans')
      .upload(depthMapPath, depthMapResult.depthMapBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    const { data: depthUrlData } = supabaseServer.storage
      .from('floor-plans')
      .getPublicUrl(depthMapPath);

    const depthMapUrl = depthUrlData?.publicUrl ?? params.planImageUrl;

    // Save depth map URL
    await supabaseServer
      .from('generations')
      .update({ depth_map_url: depthMapUrl })
      .eq('id', params.generationId);

    // Build AI prompt (Groq or fallback)
    let prompt: string;
    let negativePrompt: string;
    try {
      ({ prompt, negativePrompt } = await buildGenerationPrompt({
        roomType: params.roomType,
        style: params.style,
        budget: params.budget,
        wishes: params.wishes,
      }));
    } catch {
      prompt = `photorealistic ${params.roomType} interior in ${params.style} style, ${params.budget} budget, natural lighting, elegant materials, 8k`;
      negativePrompt =
        'bad geometry, distorted walls, cartoon, watermark, text, people, faces, low quality';
    }

    // Run generation and designer text in parallel
    const [renderUrls, designerText] = await Promise.all([
      generate({
        depthMapUrl,
        prompt,
        negativePrompt,
        numOutputs: 4,
        controlWeight,
        roomType: params.roomType,
        anonUuid: cryptoRandomUuid(),
      }),
      generateDesignerText({
        roomType: params.roomType,
        style: params.style,
        budget: params.budget,
        wishes: params.wishes,
      }).catch((err) => {
        console.warn('Groq designer text failed, continuing without it:', err?.message);
        return null;
      }),
    ]);

    const renderUrlStrings = (renderUrls ?? []).map((r: unknown) => {
      if (typeof r === 'string') return r;
      const obj = r as Record<string, unknown>;
      if (typeof obj?.url === 'function') return (obj.url as () => string)();
      if (typeof obj?.url === 'string') return obj.url;
      return String(r);
    }).filter(Boolean);

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    await supabaseServer
      .from('generations')
      .update({
        status: 'done',
        render_urls: renderUrlStrings,
        designer_text: designerText ?? null,
        processing_time: processingTime,
      })
      .eq('id', params.generationId);

    await supabaseServer
      .from('projects')
      .update({ status: 'done' })
      .eq('id', params.projectId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('runGeneration failed:', errorMessage);

    // Refund tokens on failure (skip for admin)
    if (!params.isAdmin) {
      try {
        await supabaseServer.from('token_transactions').insert({
          user_id: params.session.userId,
          amount: params.roomCount,
          type: 'refund',
          reason: 'generation_failed',
          project_id: params.projectId,
          created_at: new Date().toISOString(),
        });
        await supabaseServer.rpc('spend_user_tokens', {
          p_user_id: params.session.userId,
          p_amount: -params.roomCount,
          p_project_id: params.projectId,
        });
      } catch {
        // best effort — don't fail the error handler
      }
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

function cryptoRandomUuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
