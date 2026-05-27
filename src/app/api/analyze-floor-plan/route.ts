import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';

interface AnalysisResult {
  roomCount: number;
  rooms: string[];
}

export async function POST(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let imageUrl: string;
  try {
    const body = await req.json();
    // Accept both spellings from client
    imageUrl = String(body.image_url ?? body.imageUrl ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!imageUrl) {
    return NextResponse.json({ success: false, error: 'MISSING_IMAGE_URL' }, { status: 400 });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Try OpenRouter Qwen2-VL-72B first
  if (openRouterKey) {
    try {
      const result = await analyzeWithOpenRouter(imageUrl, openRouterKey);
      if (result !== null) {
        return NextResponse.json({ success: true, roomCount: result.roomCount, rooms: result.rooms });
      }
    } catch (err) {
      console.warn('[analyze-floor-plan] OpenRouter failed:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback: Groq LLaMA 3.2 90B Vision
  if (groqKey) {
    try {
      const result = await analyzeWithGroq(imageUrl, groqKey);
      if (result !== null) {
        return NextResponse.json({ success: true, roomCount: result.roomCount, rooms: result.rooms });
      }
    } catch (err) {
      console.warn('[analyze-floor-plan] Groq fallback failed:', err instanceof Error ? err.message : err);
    }
  }

  // Both failed — safe default
  return NextResponse.json({ success: true, roomCount: 1, rooms: [] });
}

const USER_PROMPT =
  'This is a floor plan. Count the number of separate rooms that need interior design visualization (bedrooms, living rooms, kitchens, bathrooms, offices). Respond with ONLY a JSON object: {"room_count": N, "rooms": ["room1", "room2", ...]} Do not include hallways, corridors, or storage rooms.';

function parseAnalysisResponse(content: string): AnalysisResult | null {
  try {
    const parsed = JSON.parse(content) as { room_count?: unknown; rooms?: unknown };
    const count = Number(parsed?.room_count);
    if (!Number.isFinite(count) || count <= 0) return null;
    const rooms = Array.isArray(parsed?.rooms)
      ? (parsed.rooms as unknown[]).map(String).slice(0, 20)
      : [];
    return { roomCount: Math.min(count, 20), rooms };
  } catch {
    return null;
  }
}

async function analyzeWithOpenRouter(imageUrl: string, apiKey: string): Promise<AnalysisResult | null> {
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
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 256,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  console.log('[analyze-floor-plan] OpenRouter response:', content.slice(0, 200));
  return parseAnalysisResponse(content);
}

async function analyzeWithGroq(imageUrl: string, apiKey: string): Promise<AnalysisResult | null> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.2-90b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 256,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  console.log('[analyze-floor-plan] Groq response:', content.slice(0, 200));
  return parseAnalysisResponse(content);
}
