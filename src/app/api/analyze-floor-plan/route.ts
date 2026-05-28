import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import type { RoomInfo } from '../../../lib/ai/groq';

interface AnalysisResult {
  roomCount: number;
  rooms: RoomInfo[];
  room_names: string[];
  debug_raw_response?: string;
}

// ── Download image → base64 data URL ─────────────────────────────────────────
// Sending base64 bypasses all URL access issues (private buckets, signed URL
// expiry, firewall). The model receives the image bytes directly.
async function toBase64DataUrl(imageUrl: string): Promise<string> {
  console.log('[analyze:base64] Downloading image:', imageUrl.slice(0, 120));

  const downloadUrl = await toSignedUrl(imageUrl);

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: HTTP ${res.status} from ${downloadUrl.slice(0, 80)}`);
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  console.log(`[analyze:base64] OK — mime: ${mime} | bytes: ${buffer.byteLength} | base64 chars: ${base64.length}`);

  return `data:${mime};base64,${base64}`;
}

// ── URL helper: convert Supabase public URL → signed URL ─────────────────────
async function toSignedUrl(imageUrl: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const prefix = `${supabaseUrl}/storage/v1/object/`;
    if (!imageUrl.startsWith(prefix)) {
      console.log('[analyze] URL is not Supabase Storage, using as-is:', imageUrl.slice(0, 80));
      return imageUrl;
    }

    const afterPrefix = imageUrl.slice(prefix.length);
    const withoutVisibility = afterPrefix.replace(/^(public|authenticated|sign)\//, '');
    const slashIdx = withoutVisibility.indexOf('/');
    if (slashIdx === -1) return imageUrl;

    const bucket = withoutVisibility.slice(0, slashIdx);
    const filePath = withoutVisibility.slice(slashIdx + 1).split('?')[0];

    console.log('[analyze] Generating signed URL — bucket:', bucket, '| path:', filePath);

    const { data, error } = await supabaseServer.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);

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

  // Download image and encode as base64 so vision models receive bytes directly
  let base64DataUrl: string;
  try {
    base64DataUrl = await toBase64DataUrl(imageUrl);
  } catch (err) {
    console.error('[analyze] Image download failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'IMAGE_DOWNLOAD_FAILED' }, { status: 400 });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  console.log('[analyze] Keys present — OPENROUTER_API_KEY:', !!openRouterKey, '| GROQ_API_KEY:', !!groqKey);

  // Try OpenRouter Qwen3-VL-235B first
  if (openRouterKey) {
    try {
      console.log('[analyze:openrouter] Calling qwen/qwen3-vl-235b-a22b-instruct with base64 image...');
      const t0 = Date.now();
      const result = await analyzeWithOpenRouter(base64DataUrl, openRouterKey);
      const elapsed = Date.now() - t0;
      if (result) {
        console.log(`[analyze:openrouter] SUCCESS in ${elapsed}ms — roomCount: ${result.roomCount} | rooms: ${result.room_names.join(', ')}`);
        return NextResponse.json({ success: true, ...result });
      }
      console.warn(`[analyze:openrouter] Returned null result after ${elapsed}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('[analyze:openrouter] FAILED:', msg);
      if (stack) console.error('[analyze:openrouter] stack:', stack);
    }
  } else {
    console.log('[analyze] Skipping OpenRouter (no API key)');
  }

  // Fallback: Groq LLaMA 3.2 vision
  if (groqKey) {
    try {
      console.log('[analyze:groq] Calling Groq vision fallback with base64 image...');
      const t0 = Date.now();
      const result = await analyzeWithGroq(base64DataUrl, groqKey);
      const elapsed = Date.now() - t0;
      if (result) {
        console.log(`[analyze:groq] SUCCESS in ${elapsed}ms — roomCount: ${result.roomCount} | rooms: ${result.room_names.join(', ')}`);
        return NextResponse.json({ success: true, ...result });
      }
      console.warn(`[analyze:groq] Returned null result after ${elapsed}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('[analyze:groq] FAILED:', msg);
      if (stack) console.error('[analyze:groq] stack:', stack);
    }
  } else {
    console.log('[analyze] Skipping Groq (no API key)');
  }

  console.warn('[analyze] Both providers failed — returning safe default roomCount:1');
  return NextResponse.json({ success: true, roomCount: 1, rooms: [], room_names: [], debug_raw_response: 'both_providers_failed' });
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const USER_PROMPT = `This is a Russian apartment floor plan (BTИ/БТИ). Analyze the WALL GEOMETRY and ENCLOSED SPACES to count and identify every room. Do NOT rely on text labels — Russian BTИ plans often have no room labels, only walls, dimensions, and symbols.

IDENTIFY ROOMS BY GEOMETRY AND SYMBOLS:
- Largest enclosed space with exterior windows → Гостиная (living room) or Спальня (bedroom)
- Space with sink/stove symbol (small rectangle or circle near wall) → Кухня (kitchen)
- Space with bathtub symbol (rounded rectangle) → Ванная комната (bathroom)
- Small space (~2-4 m²) with toilet symbol (small oval/circle) → Туалет (toilet)
- Narrow connecting space linking entrance to other rooms → Коридор / Прихожая (hallway)
- Space with exterior wall but no windows, thin floor slab shown → Балкон / Лоджия (balcony)

COUNTING RULES:
- Each walled-off enclosed space = separate room
- If bathtub and toilet are in the SAME enclosed space → Санузел совмещённый (combined bathroom), count as 1
- If in separate adjacent spaces → count as 2 (Ванная + Туалет)
- Typical 1-room apartment: 3-4 spaces (living/kitchen + bathroom + toilet + hallway)
- Typical 2-room apartment: 5-6 spaces
- Typical 3-room apartment: 6-8 spaces

INCLUDE: living rooms, bedrooms, kitchens, bathrooms, toilets, hallways, balconies, home offices
DO NOT INCLUDE: elevator shafts, stairwells, external walls only, structural columns

Examine the floor plan carefully — count every distinct enclosed polygon formed by walls.

For each room provide in Russian:
- id: sequential (R1, R2, R3...)
- name: Гостиная / Спальня / Кухня / Ванная / Туалет / Санузел совмещённый / Коридор / Прихожая / Балкон / Кабинет / Детская
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

// FIXED: was only stripping ``` fences at exact start/end. Now extracts the JSON
// substring between the first `{` and last `}`, tolerating prose intros, mid-text
// fences, or anything wrapped around the JSON body.
function extractJsonBlock(content: string): string {
  const noFences = content.replace(/```(?:json|JSON)?/g, '').trim();
  const firstBrace = noFences.indexOf('{');
  const lastBrace = noFences.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return noFences;
  return noFences.slice(firstBrace, lastBrace + 1);
}

function parseAnalysisResponse(content: string): AnalysisResult | null {
  console.log(`[analyze:parse] Raw response (${content.length} chars):`, content.slice(0, 600));
  try {
    const cleaned = extractJsonBlock(content);
    const parsed = JSON.parse(cleaned) as { room_count?: unknown; rooms?: unknown[] };
    const count = Number(parsed?.room_count);
    if (!Number.isFinite(count) || count <= 0) {
      console.warn('[analyze:parse] Invalid room_count:', parsed?.room_count, '| full parsed:', JSON.stringify(parsed).slice(0, 300));
      return null;
    }

    const rawRooms = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
    console.log(`[analyze:parse] room_count: ${count} | rooms array length: ${rawRooms.length}`);

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
      debug_raw_response: content.slice(0, 1000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[analyze:parse] JSON.parse failed:', msg, '| cleaned content was:', content.slice(0, 400));
    return null;
  }
}

// ── OpenRouter Qwen2-VL-72B ───────────────────────────────────────────────────

async function analyzeWithOpenRouter(base64DataUrl: string, apiKey: string): Promise<AnalysisResult | null> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://intera.app',
      'X-Title': 'INTERA Floor Plan Analyzer',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3-vl-235b-a22b-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64DataUrl } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0,
    }),
  });

  const responseText = await res.text();
  console.log(`[analyze:openrouter] HTTP ${res.status} | response length: ${responseText.length} chars`);

  if (!res.ok) {
    console.error('[analyze:openrouter] Error body:', responseText.slice(0, 400));
    throw new Error(`OpenRouter HTTP ${res.status}: ${responseText.slice(0, 300)}`);
  }

  const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (data.error) {
    console.error('[analyze:openrouter] API error in response:', data.error.message);
    throw new Error(`OpenRouter API error: ${data.error.message}`);
  }
  const content = data?.choices?.[0]?.message?.content ?? '';
  console.log(`[analyze:openrouter] Model content (${content.length} chars):`, content.slice(0, 300));
  const result = parseAnalysisResponse(content);
  if (result) {
    result.debug_raw_response = content.slice(0, 1000);
  }
  return result;
}

// ── Groq vision models ────────────────────────────────────────────────────────
// Try 90b first, fall back to 11b — neither supports response_format for vision

const GROQ_VISION_MODELS = [
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
] as const;

async function analyzeWithGroq(base64DataUrl: string, apiKey: string): Promise<AnalysisResult | null> {
  for (const model of GROQ_VISION_MODELS) {
    try {
      console.log('[analyze] Trying Groq model:', model);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: base64DataUrl } },
                { type: 'text', text: USER_PROMPT },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0,
        }),
      });

      const responseText = await res.text();
      console.log(`[analyze:groq:${model}] HTTP ${res.status} | response length: ${responseText.length} chars`);

      if (!res.ok) {
        console.warn(`[analyze:groq:${model}] Failed:`, responseText.slice(0, 300));
        continue;
      }

      const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content ?? '';
      console.log(`[analyze:groq:${model}] Model content (${content.length} chars):`, content.slice(0, 300));
      const result = parseAnalysisResponse(content);
      if (result) {
        result.debug_raw_response = content.slice(0, 1000);
        return result;
      }
    } catch (err) {
      console.warn('[analyze] Groq', model, 'threw:', err instanceof Error ? err.message : err);
    }
  }
  return null;
}
