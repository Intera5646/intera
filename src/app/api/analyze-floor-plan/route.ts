import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';

export async function POST(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let imageUrl: string;
  try {
    const body = await req.json();
    imageUrl = String(body.image_url ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!imageUrl) {
    return NextResponse.json({ success: false, error: 'MISSING_IMAGE_URL' }, { status: 400 });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Try OpenRouter Qwen2-VL first
  if (openRouterKey) {
    try {
      const roomCount = await analyzeWithOpenRouter(imageUrl, openRouterKey);
      if (roomCount !== null) {
        return NextResponse.json({ success: true, roomCount });
      }
    } catch (err) {
      console.warn('[analyze-floor-plan] OpenRouter failed:', err);
    }
  }

  // Fallback: Groq LLaMA 3.2 90B Vision
  if (groqKey) {
    try {
      const roomCount = await analyzeWithGroq(imageUrl, groqKey);
      if (roomCount !== null) {
        return NextResponse.json({ success: true, roomCount });
      }
    } catch (err) {
      console.warn('[analyze-floor-plan] Groq fallback failed:', err);
    }
  }

  // Both failed — return 1 as safe default
  return NextResponse.json({ success: true, roomCount: 1 });
}

const SYSTEM_PROMPT =
  'You are an architectural floor plan analyzer. Count only the rooms that can be visualized as interior spaces (living room, bedroom, kitchen, bathroom, office, balcony, hallway). Do NOT count storage closets, elevator shafts, or stairwells. Respond with ONLY a JSON object: {"room_count": N}';

const USER_PROMPT =
  'Analyze this floor plan image. Count the visualizable rooms (living room, bedroom, kitchen/dining, bathroom/toilet, office, balcony, hallway/corridor). Return only JSON: {"room_count": N}';

async function analyzeWithOpenRouter(imageUrl: string, apiKey: string): Promise<number | null> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://intera.app',
      'X-Title': 'INTERA Floor Plan Analyzer',
    },
    body: JSON.stringify({
      model: 'qwen/qwen2-vl-72b-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 64,
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { room_count?: unknown };
  const count = Number(parsed?.room_count);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 20) : null;
}

async function analyzeWithGroq(imageUrl: string, apiKey: string): Promise<number | null> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.2-90b-vision-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 64,
      temperature: 0,
    }),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { room_count?: unknown };
  const count = Number(parsed?.room_count);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 20) : null;
}
