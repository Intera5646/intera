import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase/server';
import type {
  RoomInfo,
  ApartmentGeometry,
  GeometryRoom,
  RoomType,
  SizeCategory,
  RoomWall,
  CameraSuggestion,
  WallFeature,
} from '../../../lib/geometry/types';

interface AnalysisResult {
  roomCount: number;
  rooms: RoomInfo[];
  room_names: string[];
  geometry_json: ApartmentGeometry | null;
  debug_raw_response?: string;
}

// ── Download image → base64 data URL ─────────────────────────────────────────
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

  if (openRouterKey) {
    try {
      console.log('[analyze:openrouter] Calling qwen/qwen3-vl-235b-a22b-instruct with base64 image...');
      const t0 = Date.now();
      const result = await analyzeWithOpenRouter(base64DataUrl, openRouterKey);
      const elapsed = Date.now() - t0;
      if (result) {
        console.log(
          `[analyze:openrouter] SUCCESS in ${elapsed}ms — roomCount: ${result.roomCount} | rooms: ${result.room_names.join(', ')} | geometry: ${result.geometry_json ? 'yes' : 'no'}`
        );
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

  if (groqKey) {
    try {
      console.log('[analyze:groq] Calling Groq vision fallback with base64 image...');
      const t0 = Date.now();
      const result = await analyzeWithGroq(base64DataUrl, groqKey);
      const elapsed = Date.now() - t0;
      if (result) {
        console.log(
          `[analyze:groq] SUCCESS in ${elapsed}ms — roomCount: ${result.roomCount} | rooms: ${result.room_names.join(', ')} | geometry: ${result.geometry_json ? 'yes' : 'no'}`
        );
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
  return NextResponse.json({
    success: true,
    roomCount: 1,
    rooms: [],
    room_names: [],
    geometry_json: null,
    debug_raw_response: 'both_providers_failed',
  });
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const USER_PROMPT = `This is a Russian apartment floor plan (BTИ/БТИ). Analyze the WALL GEOMETRY and ENCLOSED SPACES to extract precise room dimensions and layout data.

STEP 1 — READ THE SCALE:
Look for dimension lines (sizes in mm or cm written along walls). Use them to determine the real-world scale. If no scale is shown, estimate from standard door widths (~900 mm) or the overall plan width.

STEP 2 — IDENTIFY EACH ENCLOSED ROOM:
For each room, trace all 4+ walls. Measure width and length using dimension lines or the scale you determined. Typical ceiling height is 2.7 m for modern buildings.

IDENTIFY BY GEOMETRY AND SYMBOLS:
- Largest space with exterior windows → Гостиная (living) or Спальня (bedroom)
- Space with sink/stove symbol → Кухня (kitchen)
- Space with bathtub symbol → Ванная (bathroom)
- Small space (~2-4 m²) with toilet → Туалет (wc)
- Narrow connecting space → Коридор / Прихожая (hallway)
- Space with exterior wall, no windows, thin slab → Балкон / Лоджия (balcony)

STEP 3 — FOR EACH ROOM, EXTRACT WALLS:
Number the walls W1, W2, W3, W4 (clockwise from the wall opposite the main entrance/window).
For each wall record:
- length in meters (from dimension lines)
- any doors (width ~0.9 m) or windows (width ~1.2-1.8 m) along it

STEP 4 — SUGGEST CAMERA POSITIONS:
For each room suggest 1-2 camera angles. A good camera is placed at a corner or mid-wall facing the opposite wall or the window wall. Larger rooms (>15 m²) need 2 cameras.

COUNTING RULES:
- Each walled-off enclosed space = separate room
- Bathtub + toilet in same space → Санузел совмещённый (bathroom), type=bathroom, count as 1
- Separate spaces → Ванная (bathroom) + Туалет (wc), count as 2
- DO NOT INCLUDE: elevator shafts, stairwells, structural columns

Return ONLY valid JSON — no markdown, no explanation:
{
  "is_bti_plan": true,
  "apartment": {
    "total_area_m2": 52.0,
    "ceiling_height_m": 2.7,
    "orientation": "south"
  },
  "rooms": [
    {
      "id": "R1",
      "name": "Гостиная",
      "type": "living",
      "dimensions": { "width_m": 3.8, "length_m": 5.2, "height_m": 2.7 },
      "size_category": "large",
      "num_photos_needed": 2,
      "walls": [
        { "id": "W1", "length_m": 5.2, "features": [{ "type": "window", "position_from_start_m": 1.5, "width_m": 1.6 }] },
        { "id": "W2", "length_m": 3.8, "features": [] },
        { "id": "W3", "length_m": 5.2, "features": [{ "type": "door", "position_from_start_m": 0.3, "width_m": 0.9, "leads_to_room_id": "R4" }] },
        { "id": "W4", "length_m": 3.8, "features": [] }
      ],
      "suggested_cameras": [
        { "camera_at_wall_id": "W3", "facing_wall_id": "W1", "description": "Wide shot facing window wall" },
        { "camera_at_wall_id": "W4", "facing_wall_id": "W2", "description": "Corner shot showing room depth" }
      ]
    }
  ]
}

Valid type values: kitchen, bedroom, living, bathroom, wc, hallway, balcony, storage, studio_zone
Valid size_category values: small (<10 m²), medium (10-20 m²), large (>20 m²)
Valid orientation values: north, south, east, west, unknown`;

// ── Geometry parsing helpers ──────────────────────────────────────────────────

const DEFAULT_ROOM_DIMENSIONS: Record<string, { width_m: number; length_m: number }> = {
  kitchen:     { width_m: 2.5, length_m: 3.2 },
  living:      { width_m: 3.8, length_m: 5.0 },
  bedroom:     { width_m: 3.0, length_m: 4.0 },
  bathroom:    { width_m: 1.8, length_m: 2.4 },
  wc:          { width_m: 0.9, length_m: 1.8 },
  hallway:     { width_m: 1.2, length_m: 3.5 },
  balcony:     { width_m: 1.4, length_m: 3.0 },
  storage:     { width_m: 1.0, length_m: 1.5 },
  studio_zone: { width_m: 3.5, length_m: 4.5 },
};

const VALID_ROOM_TYPES = new Set<RoomType>([
  'kitchen', 'bedroom', 'living', 'bathroom', 'wc',
  'hallway', 'balcony', 'storage', 'studio_zone',
]);

function toRoomType(raw: unknown): RoomType {
  const s = String(raw ?? '').toLowerCase().trim();
  if (VALID_ROOM_TYPES.has(s as RoomType)) return s as RoomType;
  // loose mappings from Russian-influenced English
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('bed') || s.includes('sleep')) return 'bedroom';
  if (s.includes('living') || s.includes('lounge')) return 'living';
  if (s.includes('bath')) return 'bathroom';
  if (s.includes('toilet') || s.includes('wc')) return 'wc';
  if (s.includes('hall') || s.includes('corridor') || s.includes('entry')) return 'hallway';
  if (s.includes('balcon') || s.includes('loggia')) return 'balcony';
  if (s.includes('storage') || s.includes('closet') || s.includes('pantry')) return 'storage';
  return 'living';
}

function toSizeCategory(raw: unknown, width?: number, length?: number): SizeCategory {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'small' || s === 'medium' || s === 'large') return s;
  if (width && length) {
    const area = width * length;
    if (area < 10) return 'small';
    if (area < 20) return 'medium';
    return 'large';
  }
  return 'medium';
}

function clampDim(val: unknown, min = 0.5, max = 20): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return min;
  return Math.min(Math.max(n, min), max);
}

function buildDefaultWalls(width_m: number, length_m: number): RoomWall[] {
  return [
    { id: 'W1', length_m: length_m, features: [] },
    { id: 'W2', length_m: width_m,  features: [] },
    { id: 'W3', length_m: length_m, features: [] },
    { id: 'W4', length_m: width_m,  features: [] },
  ];
}

function buildDefaultCameras(roomType: RoomType, numPhotos: 1 | 2): CameraSuggestion[] {
  const cameras: CameraSuggestion[] = [
    { camera_at_wall_id: 'W3', facing_wall_id: 'W1', description: 'Main perspective, facing window/feature wall' },
  ];
  if (numPhotos === 2) {
    cameras.push({ camera_at_wall_id: 'W4', facing_wall_id: 'W2', description: 'Secondary angle showing room depth' });
  }
  return cameras;
}

function parseWallFeatures(raw: unknown): WallFeature[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((f: unknown) => {
    const feat = (f ?? {}) as Record<string, unknown>;
    const type = String(feat.type ?? '') === 'door' ? 'door' : 'window';
    const pos = Number(feat.position_from_start_m ?? feat.position ?? 0);
    const width = Number(feat.width_m ?? feat.width ?? (type === 'door' ? 0.9 : 1.4));
    const feature: WallFeature = {
      type,
      position_from_start_m: Number.isFinite(pos) ? Math.max(0, pos) : 0,
      width_m: Number.isFinite(width) && width > 0 ? Math.min(width, 5) : (type === 'door' ? 0.9 : 1.4),
    };
    if (feat.leads_to_room_id) feature.leads_to_room_id = String(feat.leads_to_room_id);
    return feature;
  });
}

function parseRoomWalls(raw: unknown, width_m: number, length_m: number): RoomWall[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return buildDefaultWalls(width_m, length_m);
  }
  return raw.slice(0, 8).map((w: unknown, idx) => {
    const wall = (w ?? {}) as Record<string, unknown>;
    return {
      id: String(wall.id ?? `W${idx + 1}`),
      length_m: clampDim(wall.length_m ?? wall.length, 0.5, 20),
      features: parseWallFeatures(wall.features),
    };
  });
}

function parseGeometryRoom(r: unknown, idx: number): GeometryRoom {
  const room = (r ?? {}) as Record<string, unknown>;

  const type = toRoomType(room.type);
  const defaults = DEFAULT_ROOM_DIMENSIONS[type] ?? { width_m: 3.0, length_m: 4.0 };

  const dims = (room.dimensions ?? {}) as Record<string, unknown>;
  const width_m  = clampDim(dims.width_m  ?? dims.width,  0.5, 20) || defaults.width_m;
  const length_m = clampDim(dims.length_m ?? dims.length, 0.5, 20) || defaults.length_m;
  const height_m = clampDim(dims.height_m ?? dims.height, 2.0, 5.0) || 2.7;

  const size_category = toSizeCategory(room.size_category, width_m, length_m);
  const area = width_m * length_m;
  const num_photos_needed: 1 | 2 = area >= 15 ? 2 : 1;

  const walls = parseRoomWalls(room.walls, width_m, length_m);

  let suggested_cameras: CameraSuggestion[];
  if (Array.isArray(room.suggested_cameras) && room.suggested_cameras.length > 0) {
    suggested_cameras = (room.suggested_cameras as unknown[]).slice(0, 2).map((c: unknown) => {
      const cam = (c ?? {}) as Record<string, unknown>;
      return {
        camera_at_wall_id: String(cam.camera_at_wall_id ?? 'W3'),
        facing_wall_id:    String(cam.facing_wall_id    ?? 'W1'),
        description:       String(cam.description       ?? ''),
      };
    });
  } else {
    suggested_cameras = buildDefaultCameras(type, num_photos_needed);
  }

  return {
    id:   String(room.id   ?? `R${idx + 1}`),
    name: String(room.name ?? `Комната ${idx + 1}`),
    type,
    dimensions: { width_m, length_m, height_m },
    size_category,
    num_photos_needed,
    walls,
    suggested_cameras,
  };
}

const ROOM_TYPE_TO_RUSSIAN: Record<RoomType, string> = {
  kitchen:     'Кухня',
  bedroom:     'Спальня',
  living:      'Гостиная',
  bathroom:    'Ванная',
  wc:          'Туалет',
  hallway:     'Прихожая',
  balcony:     'Балкон',
  storage:     'Кладовая',
  studio_zone: 'Кухня-гостиная',
};

function geometryRoomToRoomInfo(gr: GeometryRoom): RoomInfo {
  return {
    id:               gr.id,
    name:             gr.name,
    approximate_size: gr.size_category,
    windows:          gr.walls.some(w => w.features.some(f => f.type === 'window')) ? 'yes' : 'no',
    natural_light:    gr.type === 'storage' || gr.type === 'wc' ? 'low'
                      : gr.type === 'hallway' ? 'medium' : 'high',
    connected_to:     gr.walls
                        .flatMap(w => w.features)
                        .filter(f => f.type === 'door' && f.leads_to_room_id)
                        .map(f => f.leads_to_room_id!),
  };
}

// ── Response parser ───────────────────────────────────────────────────────────

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
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    // ── New format: has "rooms" array with geometry fields ────────────────────
    const isNewFormat = Array.isArray(parsed.rooms) &&
      (parsed.rooms as unknown[]).length > 0 &&
      typeof ((parsed.rooms as unknown[])[0] as Record<string, unknown>).walls !== 'undefined';

    if (isNewFormat) {
      console.log('[analyze:parse] Detected new geometry format (walls present)');

      const rawRooms = parsed.rooms as unknown[];
      const geometryRooms: GeometryRoom[] = rawRooms
        .slice(0, 20)
        .map((r, idx) => parseGeometryRoom(r, idx));

      const aptRaw = (parsed.apartment ?? {}) as Record<string, unknown>;
      const geometry: ApartmentGeometry = {
        is_bti_plan: parsed.is_bti_plan !== false,
        apartment: {
          total_area_m2:    clampDim(aptRaw.total_area_m2 ?? aptRaw.total_area, 5, 1000) || 50,
          ceiling_height_m: clampDim(aptRaw.ceiling_height_m ?? aptRaw.ceiling_height, 2.0, 5.0) || 2.7,
          orientation: (['north','south','east','west'].includes(String(aptRaw.orientation))
            ? aptRaw.orientation : 'unknown') as ApartmentGeometry['apartment']['orientation'],
        },
        rooms: geometryRooms,
      };

      const rooms: RoomInfo[] = geometryRooms.map(geometryRoomToRoomInfo);

      console.log(
        `[analyze:parse] geometry rooms: ${geometryRooms.length} | ` +
        `area: ${geometry.apartment.total_area_m2} m² | ` +
        `types: ${geometryRooms.map(r => r.type).join(', ')}`
      );

      return {
        roomCount: Math.min(geometryRooms.length, 20),
        rooms,
        room_names: geometryRooms.map(r => r.name),
        geometry_json: geometry,
        debug_raw_response: content.slice(0, 1000),
      };
    }

    // ── Legacy format: has "room_count" field ─────────────────────────────────
    console.log('[analyze:parse] Falling back to legacy format (no walls)');

    // Also accept "rooms" array length if room_count is missing
    const countFromRooms = Array.isArray(parsed.rooms) ? (parsed.rooms as unknown[]).length : 0;
    const count = Number(parsed.room_count ?? countFromRooms);

    if (!Number.isFinite(count) || count <= 0) {
      console.warn('[analyze:parse] Invalid room_count:', parsed.room_count, '| full parsed:', JSON.stringify(parsed).slice(0, 300));
      return null;
    }

    const rawRooms = Array.isArray(parsed.rooms) ? parsed.rooms as unknown[] : [];
    console.log(`[analyze:parse] room_count: ${count} | rooms array length: ${rawRooms.length}`);

    const rooms: RoomInfo[] = rawRooms.slice(0, 20).map((r: unknown, idx) => {
      const room = (r ?? {}) as Record<string, unknown>;
      return {
        id: String(room.id ?? `R${idx + 1}`),
        name: String(room.name ?? `Комната ${idx + 1}`),
        approximate_size: (['large', 'medium', 'small'].includes(String(room.approximate_size))
          ? room.approximate_size : 'medium') as RoomInfo['approximate_size'],
        windows: String(room.windows) === 'yes' ? 'yes' : 'no',
        natural_light: (['high', 'medium', 'low'].includes(String(room.natural_light))
          ? room.natural_light : 'medium') as RoomInfo['natural_light'],
        connected_to: Array.isArray(room.connected_to) ? room.connected_to.map(String) : [],
      };
    });

    return {
      roomCount: Math.min(count, 20),
      rooms,
      room_names: rooms.map((r) => r.name),
      geometry_json: null,
      debug_raw_response: content.slice(0, 1000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[analyze:parse] JSON.parse failed:', msg, '| cleaned content was:', content.slice(0, 400));
    return null;
  }
}

// ── OpenRouter Qwen3-VL-235B ──────────────────────────────────────────────────

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
      max_tokens: 2048,
      temperature: 0,
    }),
  });

  const responseText = await res.text();
  console.log(`[analyze:openrouter] HTTP ${res.status} | response length: ${responseText.length} chars`);

  if (!res.ok) {
    console.error('[analyze:openrouter] Error body:', responseText.slice(0, 400));
    throw new Error(`OpenRouter HTTP ${res.status}: ${responseText.slice(0, 300)}`);
  }

  const data = JSON.parse(responseText) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
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
          max_tokens: 2048,
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
