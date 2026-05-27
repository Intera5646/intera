import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import type { RoomInfo } from '../../../lib/ai/groq';

interface AnalysisResult {
  roomCount: number;
  rooms: RoomInfo[];
  room_names: string[];
}

export async function POST(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let imageUrl: string;
  try {
    const body = await req.json();
    imageUrl = String(body.image_url ?? body.imageUrl ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  if (!imageUrl) {
    return NextResponse.json({ success: false, error: 'MISSING_IMAGE_URL' }, { status: 400 });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (openRouterKey) {
    try {
      const result = await analyzeWithOpenRouter(imageUrl, openRouterKey);
      if (result) {
        return NextResponse.json({ success: true, ...result });
      }
    } catch (err) {
      console.warn('[analyze-floor-plan] OpenRouter failed:', err instanceof Error ? err.message : err);
    }
  }

  if (groqKey) {
    try {
      const result = await analyzeWithGroq(imageUrl, groqKey);
      if (result) {
        return NextResponse.json({ success: true, ...result });
      }
    } catch (err) {
      console.warn('[analyze-floor-plan] Groq fallback failed:', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ success: true, roomCount: 1, rooms: [], room_names: [] });
}

const USER_PROMPT = `This is a floor plan image. Analyze it and identify all rooms that need interior design visualization.

For each room, provide:
- A sequential ID (R1, R2, R3...)
- Russian room name (Гостиная, Спальня, Кухня, Ванная, Кабинет, etc.)
- Approximate size: large (>20m²), medium (10-20m²), or small (<10m²)
- Whether it has windows: yes or no
- Natural light level: high, medium, or low
- Which other rooms it connects to (by ID)

Respond with ONLY this JSON (no other text):
{
  "room_count": N,
  "rooms": [
    {
      "id": "R1",
      "name": "Гостиная",
      "approximate_size": "large",
      "windows": "yes",
      "natural_light": "high",
      "connected_to": ["R2"]
    }
  ]
}

Do NOT include hallways, corridors, storage closets, elevator shafts, or stairwells.
Only include rooms that can be designed as living spaces.`;

function parseAnalysisResponse(content: string): AnalysisResult | null {
  try {
    const parsed = JSON.parse(content) as { room_count?: unknown; rooms?: unknown[] };
    const count = Number(parsed?.room_count);
    if (!Number.isFinite(count) || count <= 0) return null;

    const rawRooms = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
    const rooms: RoomInfo[] = rawRooms.slice(0, 20).map((r: unknown, idx) => {
      const room = (r ?? {}) as Record<string, unknown>;
      return {
        id: String(room.id ?? `R${idx + 1}`),
        name: String(room.name ?? `Комната ${idx + 1}`),
        approximate_size: (['large', 'medium', 'small'].includes(String(room.approximate_size))
          ? room.approximate_size
          : 'medium') as RoomInfo['approximate_size'],
        windows: String(room.windows) === 'yes' ? 'yes' : 'no',
        natural_light: (['high', 'medium', 'low'].includes(String(room.natural_light))
          ? room.natural_light
          : 'medium') as RoomInfo['natural_light'],
        connected_to: Array.isArray(room.connected_to) ? room.connected_to.map(String) : [],
      };
    });

    return {
      roomCount: Math.min(count, 20),
      rooms,
      room_names: rooms.map((r) => r.name),
    };
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
      max_tokens: 1024,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  console.log('[analyze-floor-plan] OpenRouter response:', content.slice(0, 300));
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
      max_tokens: 1024,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  console.log('[analyze-floor-plan] Groq response:', content.slice(0, 300));
  return parseAnalysisResponse(content);
}
