import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import type { RoomInfo } from '../../../lib/ai/groq';

interface AnalysisResult {
  roomCount: number;
  rooms: RoomInfo[];
  room_names: string[];
}

// ── URL helper: convert Supabase public URL → signed URL ─────────────────────
// Public URLs only work when the bucket is set to public in Supabase dashboard.
// A signed URL works regardless of bucket policy and is accessible by Qwen.
async function toSignedUrl(imageUrl: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    // Match both /object/public/ and /object/authenticated/ variants
    const prefix = `${supabaseUrl}/storage/v1/object/`;
    if (!imageUrl.startsWith(prefix)) {
      console.log('[analyze] URL is not Supabase Storage, using as-is:', imageUrl.slice(0, 80));
      return imageUrl;
    }

    // Extract: <bucket>/<path> from either:
    //   .../object/public/<bucket>/<path>
    //   .../object/authenticated/<bucket>/<path>
    const afterPrefix = imageUrl.slice(prefix.length);
    const withoutVisibility = afterPrefix.replace(/^(public|authenticated|sign)\//, '');
    const slashIdx = withoutVisibility.indexOf('/');
    if (slashIdx === -1) return imageUrl;

    const bucket = withoutVisibility.slice(0, slashIdx);
    const filePath = withoutVisibility.slice(slashIdx + 1).split('?')[0]; // strip query params

    console.log('[analyze] Generating signed URL — bucket:', bucket, '| path:', filePath);

    const { data, error } = await supabaseServer.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour — enough for Qwen analysis

    if (error || !data?.signedUrl) {
      console.warn('[analyze] createSignedUrl failed:', error?.message, '— using original URL');
      return imageUrl;
    }

    console.log('[analyze] Signed URL created:', data.signedUrl.slice(0, 100));
    return data.signedUrl;
  } catch (err) {
    console.warn('[analyze] toSignedUrl error, using original URL:', err);
    return imageUrl;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  console.log('[analyze] Raw image URL received:', imageUrl.slice(0, 120));

  // Convert to signed URL so external AI services can access the file
  const accessUrl = await toSignedUrl(imageUrl);

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  console.log('[analyze] OPENROUTER_API_KEY present:', !!openRouterKey);
  console.log('[analyze] GROQ_API_KEY present:', !!groqKey);
  console.log('[analyze] Sending URL to vision model:', accessUrl.slice(0, 120));

  // Try OpenRouter Qwen2-VL-72B first
  if (openRouterKey) {
    try {
      console.log('[analyze] Calling OpenRouter Qwen2-VL-72B...');
      const result = await analyzeWithOpenRouter(accessUrl, openRouterKey);
      if (result) {
        console.log('[analyze] OpenRouter success — roomCount:', result.roomCount, '| rooms:', result.room_names.join(', '));
        return NextResponse.json({ success: true, ...result });
      }
      console.warn('[analyze] OpenRouter returned null result');
    } catch (err) {
      console.warn('[analyze] OpenRouter failed:', err instanceof Error ? err.message : err);
    }
  } else {
    console.log('[analyze] Skipping OpenRouter (no API key)');
  }

  // Fallback: Groq LLaMA 3.2 90B Vision
  if (groqKey) {
    try {
      console.log('[analyze] Calling Groq LLaMA 3.2 90B Vision...');
      const result = await analyzeWithGroq(accessUrl, groqKey);
      if (result) {
        console.log('[analyze] Groq success — roomCount:', result.roomCount, '| rooms:', result.room_names.join(', '));
        return NextResponse.json({ success: true, ...result });
      }
      console.warn('[analyze] Groq returned null result');
    } catch (err) {
      console.warn('[analyze] Groq failed:', err instanceof Error ? err.message : err);
    }
  } else {
    console.log('[analyze] Skipping Groq (no API key)');
  }

  console.log('[analyze] Both providers failed — returning safe default: roomCount 1');
  return NextResponse.json({ success: true, roomCount: 1, rooms: [], room_names: [] });
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const USER_PROMPT = `Look at this floor plan image carefully. Your task is to count and identify ALL rooms that need interior design visualization.

IMPORTANT: Count each room separately. Examples:
- A 2-bedroom apartment typically has: living room + 2 bedrooms + kitchen + bathroom + toilet = 6 rooms
- A studio apartment has: main room + kitchen area + bathroom = 3 rooms
- A 3-bedroom apartment typically has: living room + 3 bedrooms + kitchen + 2 bathrooms = 7 rooms

DO INCLUDE: living rooms, bedrooms, kitchens, dining rooms, bathrooms, toilets, home offices
DO NOT INCLUDE: hallways, corridors, entrance halls, elevator shafts, stairwells, storage closets, utility rooms

For each room provide in Russian:
- id: sequential (R1, R2, R3...)
- name: Гостиная / Спальня / Кухня / Ванная / Туалет / Кабинет / Детская / etc.
- approximate_size: "large" (>20m²) or "medium" (10-20m²) or "small" (<10m²)
- windows: "yes" or "no"
- natural_light: "high" or "medium" or "low"
- connected_to: array of room IDs this room directly connects to

Return ONLY valid JSON with no explanation, no markdown, no extra text:
{
  "room_count": N,
  "rooms": [
    {
      "id": "R1",
      "name": "Гостиная",
      "approximate_size": "large",
      "windows": "yes",
      "natural_light": "high",
      "connected_to": ["R3", "R4"]
    }
  ]
}`;

// ── Response parser ───────────────────────────────────────────────────────────

function parseAnalysisResponse(content: string): AnalysisResult | null {
  console.log('[analyze] Raw model response:', content.slice(0, 500));
  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as { room_count?: unknown; rooms?: unknown[] };
    const count = Number(parsed?.room_count);
    if (!Number.isFinite(count) || count <= 0) {
      console.warn('[analyze] Invalid room_count in response:', parsed?.room_count);
      return null;
    }

    const rawRooms = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
    console.log('[analyze] Parsed rooms array length:', rawRooms.length);

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
  } catch (e) {
    console.warn('[analyze] JSON parse failed:', e, '| content was:', content.slice(0, 300));
    return null;
  }
}

// ── OpenRouter Qwen2-VL-72B ───────────────────────────────────────────────────

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

  const responseText = await res.text();
  console.log('[analyze] OpenRouter HTTP status:', res.status);

  if (!res.ok) {
    throw new Error(`OpenRouter HTTP ${res.status}: ${responseText.slice(0, 300)}`);
  }

  const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '';
  return parseAnalysisResponse(content);
}

// ── Groq LLaMA 3.2 90B Vision ────────────────────────────────────────────────

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

  const responseText = await res.text();
  console.log('[analyze] Groq HTTP status:', res.status);

  if (!res.ok) {
    throw new Error(`Groq HTTP ${res.status}: ${responseText.slice(0, 300)}`);
  }

  const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? '';
  return parseAnalysisResponse(content);
}
