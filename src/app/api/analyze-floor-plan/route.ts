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
  RoomShape,
} from '../../../lib/geometry/types';
import { normalizeRoomShape, polygonBoundingBoxMm, getRoomArea } from '../../../lib/geometry/polygon';

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

  // SSRF guard: only allow URLs from our own Supabase Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const storagePrefix = `${supabaseUrl}/storage/v1/object/`;
    if (!imageUrl.startsWith(storagePrefix)) {
      return NextResponse.json({ success: false, error: 'INVALID_IMAGE_URL' }, { status: 400 });
    }
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
      console.log('[analyze:openrouter] Calling moonshotai/kimi-k2.6 with base64 image...');
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

  if (openRouterKey) {
    try {
      console.log('[analyze:kimi-fallback] Calling Kimi K2.6 single-call fallback with base64 image...');
      const t0 = Date.now();
      const result = await analyzeWithKimiFallback(base64DataUrl, openRouterKey);
      const elapsed = Date.now() - t0;
      if (result) {
        console.log(
          `[analyze:kimi-fallback] SUCCESS in ${elapsed}ms — roomCount: ${result.roomCount} | rooms: ${result.room_names.join(', ')} | geometry: ${result.geometry_json ? 'yes' : 'no'}`
        );
        return NextResponse.json({ success: true, ...result });
      }
      console.warn(`[analyze:kimi-fallback] Returned null result after ${elapsed}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error('[analyze:kimi-fallback] FAILED:', msg);
      if (stack) console.error('[analyze:kimi-fallback] stack:', stack);
    }
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

// ── Prompts ───────────────────────────────────────────────────────────────────

// Step 1 user prompt: image → free-text description (NO JSON requested)
const STEP1_PROMPT = `Analyze this floor plan thoroughly.

Before describing anything, count all distinct enclosed spaces visible on the plan and write: 'I count N spaces.'

Then describe each space as a numbered list:
Space 1: ...
Space 2: ...

Each space gets its own numbered entry — never combine two spaces into one entry.

For every enclosed space clearly bounded by walls:
- Read the exact dimension numbers printed on the drawing (in mm)
- Describe its location: left side / right side / center / top / bottom
- List any visible fixtures: toilet symbol, bathtub, sink basin, stove burners, door swing arcs
- Note window openings with their printed width in mm
- Note door openings with their printed width in mm
- Note wall thickness: thick hatched lines = external/load-bearing, thin single lines = partition walls

For each window and door opening, SPECIFY WHICH WALL IT IS ON:
  - Describe the wall as: top wall / bottom wall / left wall / right wall (as the room appears on the plan)
  - Give the approximate distance from the left corner of that wall to the start of the opening (in mm)
  - Example: "window on top wall, starts 800mm from left corner, width 1200mm"
  - Example: "door on bottom wall, starts 300mm from left corner, width 900mm, leads to corridor"

For each space, also describe its overall SHAPE:
- If the room is a clean rectangle with straight walls on all 4 sides, say
  'shape: rectangle' and give just width × length.
- If the room has a cutout, niche, L-shape, bay window, or any non-rectangular
  outline, say 'shape: polygon' and list all corner points in order going
  clockwise, starting from the top-left corner. For each corner give its
  position in millimetres relative to the top-left corner of the room's
  bounding box.

Example for an L-shaped room 3000mm × 5340mm with a 900×890mm cutout in the
bottom-right corner:
  shape: polygon
  points: (0,0), (3000,0), (3000,4450), (2100,4450), (2100,5340), (0,5340)

Read these segment lengths from the dimension annotations printed on the plan.
Do not invent measurements that are not written.

Important rules:
- Read numbers ONLY from what is printed on the drawing
- Do NOT invent spaces — only describe areas with clear wall boundaries on all sides
- Do NOT name room types (no 'bedroom', 'kitchen')
- If two areas have no wall between them, describe them as one space
- Be precise about how many distinct enclosed spaces you count`;

// Step 2 user prompt: analysisText (NO image) → structured JSON
function buildStep2Prompt(analysisText: string): string {
  return `Based on this floor plan analysis, extract structured data.

ANALYSIS:
${analysisText}

Return ONLY this JSON structure:
{
  "total_spaces": <number of distinct spaces found>,
  "rooms": [
    {
      "id": "room_1",
      "label": "Помещение 1",
      "type": "unknown",
      "type_hint": <see rules below>,
      "dimensions": {
        "width_m": <bounding box width in meters>,
        "length_m": <bounding box length in meters>,
        "height_m": null
      },
      "shape": {
        "kind": "rectangle"
      },
      "walls": [
        {
          "id": "W1",
          "length_m": <length of this wall in metres>,
          "features": [
            { "type": "window", "position_from_start_m": 0.8, "width_m": 1.2,
              "sill_mm": 900, "height_mm": 1200 }
          ]
        },
        { "id": "W2", "length_m": <length>, "features": [] },
        {
          "id": "W3",
          "length_m": <length>,
          "features": [
            { "type": "door", "position_from_start_m": 0.3, "width_m": 0.9,
              "sill_mm": 0, "height_mm": 2100 }
          ]
        },
        { "id": "W4", "length_m": <length>, "features": [] }
      ]
    }
  ]
}

WALL CONVENTION — use this system for every room:
- W1 = the wall with the MOST or LARGEST windows (usually the exterior / outer wall).
       Position it as the back wall. Length = the physical span of that wall in metres.
- W2 = right wall when standing inside and facing W1. Length = perpendicular span.
- W3 = the wall opposite W1 (interior / corridor side). Usually has the entry door. Length same as W1.
- W4 = left wall when facing W1. Length same as W2.
- If no windows exist, assign W1 to the longest exterior wall or any dominant wall.
- Every room MUST have exactly 4 walls: W1, W2, W3, W4.
- At least ONE door feature must appear in W3 (or W2/W4 if topology requires).

FEATURES in walls:
- type: "window" or "door"
- position_from_start_m: distance in metres from the LEFT corner of that wall (when facing the wall from inside)
- width_m: width of the opening in metres
- sill_mm: floor-to-sill height in mm. Default 900 for windows, 0 for doors.
- height_mm: opening height in mm. Default 1200 for windows, 2100 for doors.
- For features described in mm in the analysis, convert position/width to metres but keep sill_mm/height_mm in mm
- If a position is not mentioned, distribute evenly (e.g. a single opening: position = (wall_length - opening_width) / 2)
- Every room MUST have at least one door opening somewhere. Any room touching an exterior wall must have at least one window.

For NON-rectangular rooms, replace the "shape" field with:
  "shape": {
    "kind": "polygon",
    "points": [
      {"x_mm": 0, "y_mm": 0},
      {"x_mm": 3000, "y_mm": 0},
      {"x_mm": 3000, "y_mm": 4450},
      {"x_mm": 2100, "y_mm": 4450},
      {"x_mm": 2100, "y_mm": 5340},
      {"x_mm": 0, "y_mm": 5340}
    ]
  }

Shape rules:
- Default to "rectangle" unless the analysis text explicitly describes the
  shape as non-rectangular or lists vertices.
- For polygons, list points clockwise from the top-left corner. The last
  point implicitly connects back to the first — do not duplicate the first
  point at the end.
- Polygons require at least 4 points (3 corners + close-back).
- Compute "dimensions" as the BOUNDING BOX of the polygon: width_m =
  (max x_mm − min x_mm) / 1000, length_m = (max y_mm − min y_mm) / 1000.

type_hint rules — set ONLY when analysis explicitly mentions:
- toilet symbol or bathtub → "bathroom"
- stove burners or kitchen sink → "kitchen"
- very narrow space under 1.0m wide → "hallway"
- the word balcony or явный выступ за периметр здания → "balcony"
- all other cases → null

Strict rules:
- type is ALWAYS "unknown" — never change this
- Do NOT add rooms not described in the analysis
- Do NOT invent dimensions — use only numbers from the analysis text
- label is always "Помещение N" — never a room type name`;
}

// USER_PROMPT used by Kimi single-call fallback
const USER_PROMPT = `This is a Russian apartment floor plan (план БТИ). It WILL have between 3 and 8 enclosed rooms.

STEP 1 — COUNT: Trace every polygon formed by wall lines. Count each enclosed space.
STEP 2 — IDENTIFY each room type from geometry and symbols (sink/stove=kitchen, bathtub=bathroom, etc).
STEP 3 — MEASURE: Use dimension lines. Estimate from door widths (~0.9 m) if no scale.
STEP 4 — WALLS: For each room, number walls W1-W4 clockwise from the window/feature wall. Note doors and windows.
STEP 5 — CAMERAS: Suggest 1-2 camera positions per room.

CRITICAL: A typical apartment has 4-8 rooms. If you detect only 1, recount every enclosed polygon carefully.

Return ONLY valid JSON, no markdown:
{
  "is_bti_plan": true,
  "apartment": { "total_area_m2": 52.0, "ceiling_height_m": 2.7, "orientation": "south" },
  "rooms": [
    {
      "id": "R1", "name": "Гостиная", "type": "living", "type_hint": null,
      "dimensions": { "width_m": 3.8, "length_m": 5.2, "height_m": 2.7 },
      "size_category": "large", "num_photos_needed": 2,
      "walls": [
        { "id": "W1", "length_m": 5.2, "features": [{ "type": "window", "position_from_start_m": 1.5, "width_m": 1.6 }] },
        { "id": "W2", "length_m": 3.8, "features": [] },
        { "id": "W3", "length_m": 5.2, "features": [{ "type": "door", "position_from_start_m": 0.3, "width_m": 0.9, "leads_to_room_id": "R4" }] },
        { "id": "W4", "length_m": 3.8, "features": [] }
      ],
      "suggested_cameras": [
        { "camera_at_wall_id": "W3", "facing_wall_id": "W1", "description": "Wide shot facing window wall" }
      ]
    }
  ]
}

Valid types: kitchen, bedroom, living, bathroom, wc, hallway, balcony, storage, studio_zone
Valid size_category: small (<10 m²), medium (10-20 m²), large (>20 m²)
Valid orientation: north, south, east, west, unknown`;

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
  'hallway', 'balcony', 'storage', 'studio_zone', 'unknown',
  'combined_bathroom', 'corridor', 'dressing_room', 'loggia',
  'kitchen_living', 'kids_room', 'laundry', 'vestibule',
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

const VALID_TYPE_HINTS_SET = new Set(['bathroom', 'kitchen', 'hallway', 'balcony']);

function parseGeometryRoom(r: unknown, idx: number): GeometryRoom {
  const room = (r ?? {}) as Record<string, unknown>;

  const type = toRoomType(room.type);
  const defaults = DEFAULT_ROOM_DIMENSIONS[type] ?? { width_m: 3.0, length_m: 4.0 };
  const rawHint = String(room.type_hint ?? '').toLowerCase().trim();
  const type_hint = VALID_TYPE_HINTS_SET.has(rawHint) ? (rawHint as 'bathroom' | 'kitchen' | 'hallway' | 'balcony') : null;

  // Parse shape — defaults to rectangle if missing/malformed
  const shape: RoomShape = normalizeRoomShape(room.shape);

  const dims = (room.dimensions ?? {}) as Record<string, unknown>;
  let width_m  = clampDim(dims.width_m  ?? dims.width,  0.5, 20) || defaults.width_m;
  let length_m = clampDim(dims.length_m ?? dims.length, 0.5, 20) || defaults.length_m;
  const height_m = clampDim(dims.height_m ?? dims.height, 2.0, 5.0) || 2.7;

  // If polygon and dimensions look like defaults/missing, derive from bbox.
  if (shape.kind === 'polygon') {
    const bbox = polygonBoundingBoxMm(shape.points);
    const bboxW = (bbox.maxX - bbox.minX) / 1000;
    const bboxL = (bbox.maxY - bbox.minY) / 1000;
    if (bboxW > 0.5 && (!dims.width_m && !dims.width))  width_m  = clampDim(bboxW, 0.5, 30);
    if (bboxL > 0.5 && (!dims.length_m && !dims.length)) length_m = clampDim(bboxL, 0.5, 30);
  }

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
    type_hint,
    dimensions: { width_m, length_m, height_m },
    size_category,
    num_photos_needed,
    walls,
    suggested_cameras,
    shape,
  };
}

const ROOM_TYPE_TO_RUSSIAN: Record<RoomType, string> = {
  kitchen:           'Кухня',
  bedroom:           'Спальня',
  living:            'Гостиная',
  bathroom:          'Ванная',
  wc:                'Туалет',
  hallway:           'Прихожая',
  balcony:           'Балкон',
  storage:           'Кладовая',
  studio_zone:       'Кухня-гостиная',
  unknown:           'Неизвестно',
  combined_bathroom: 'Совмещённый санузел',
  corridor:          'Коридор',
  dressing_room:     'Гардеробная',
  loggia:            'Лоджия',
  kitchen_living:    'Кухня-гостиная',
  kids_room:         'Детская',
  laundry:           'Постирочная',
  vestibule:         'Тамбур',
};

function mapTypeToHint(type: RoomType): GeometryRoom['type_hint'] {
  switch (type) {
    case 'combined_bathroom':
    case 'laundry':
      return 'bathroom';
    case 'corridor':
      return 'hallway';
    case 'loggia':
      return 'balcony';
    default:
      return null;
  }
}

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

// ── Step 2 response parser ────────────────────────────────────────────────────

interface Step2RoomWall {
  id: string;
  length_m: number;
  features: Array<{ type: string; position_from_start_m: number; width_m: number }>;
}

interface Step2Room {
  id: string;
  label: string;
  type_hint: 'bathroom' | 'kitchen' | 'hallway' | 'balcony' | null;
  width_m: number;
  length_m: number;
  shape: RoomShape;
  walls?: Step2RoomWall[];
}

interface Step2Data {
  total_spaces: number;
  rooms: Step2Room[];
}

function parseStep2Response(rawJson: string): Step2Data | null {
  console.log(`[analyze:step2:parse] ${rawJson.length} chars | first 400: ${rawJson.slice(0, 400)}`);
  try {
    const parsed = JSON.parse(extractJsonBlock(rawJson)) as Record<string, unknown>;
    if (!Array.isArray(parsed.rooms) || (parsed.rooms as unknown[]).length === 0) {
      console.warn('[analyze:step2:parse] No rooms array:', JSON.stringify(parsed).slice(0, 200));
      return null;
    }
    const rooms = (parsed.rooms as unknown[]).map((r: unknown, idx) => {
      const room = (r ?? {}) as Record<string, unknown>;
      const dims = (room.dimensions ?? {}) as Record<string, unknown>;
      const rawHint = String(room.type_hint ?? '').toLowerCase().trim();
      const VALID_HINTS = new Set(['bathroom', 'kitchen', 'hallway', 'balcony']);

      // Dimensions may arrive in mm if the model didn't convert — normalise to metres
      const rawW = Number(dims.width_m ?? 0);
      const rawL = Number(dims.length_m ?? 0);
      let width_m  = rawW  > 20 ? rawW  / 1000 : rawW;
      let length_m = rawL  > 20 ? rawL  / 1000 : rawL;

      const shape: RoomShape = normalizeRoomShape(room.shape);
      // For polygons, derive bounding box from points if dimensions look invalid
      if (shape.kind === 'polygon') {
        const bbox = polygonBoundingBoxMm(shape.points);
        const bboxW = (bbox.maxX - bbox.minX) / 1000;
        const bboxL = (bbox.maxY - bbox.minY) / 1000;
        if (bboxW > 0.5 && (width_m  < 0.5 || width_m  > 30)) width_m  = bboxW;
        if (bboxL > 0.5 && (length_m < 0.5 || length_m > 30)) length_m = bboxL;
      }

      // Parse walls if model returned them
      let walls: Step2RoomWall[] | undefined;
      if (Array.isArray(room.walls) && room.walls.length > 0) {
        walls = (room.walls as unknown[]).slice(0, 4).map((w: unknown) => {
          const wall = (w ?? {}) as Record<string, unknown>;
          const rawFeatures = Array.isArray(wall.features) ? wall.features : [];
          const features = (rawFeatures as unknown[]).slice(0, 8).map((f: unknown) => {
            const feat = (f ?? {}) as Record<string, unknown>;
            const featType = String(feat.type ?? '') === 'door' ? 'door' : 'window';
            const pos = Number(feat.position_from_start_m ?? feat.position ?? 0);
            const w_m = Number(feat.width_m ?? feat.width ?? (featType === 'door' ? 0.9 : 1.2));
            // sill_mm / height_mm → convert to metres (values > 10 are in mm, else already metres)
            const rawSill = Number(feat.sill_mm ?? feat.sill_height_m ?? '');
            const rawH    = Number(feat.height_mm ?? feat.opening_height_m ?? '');
            const sill_height_m   = Number.isFinite(rawSill)  && rawSill  >= 0 ? (rawSill  > 10 ? rawSill  / 1000 : rawSill)  : undefined;
            const opening_height_m = Number.isFinite(rawH) && rawH > 0 ? (rawH > 10 ? rawH / 1000 : rawH) : undefined;
            return {
              type: featType,
              position_from_start_m: Number.isFinite(pos) ? Math.max(0, pos) : 0,
              width_m: Number.isFinite(w_m) && w_m > 0 ? Math.min(w_m, 5) : (featType === 'door' ? 0.9 : 1.2),
              ...(sill_height_m   !== undefined ? { sill_height_m }   : {}),
              ...(opening_height_m !== undefined ? { opening_height_m } : {}),
            };
          });
          const wallLen = Number(wall.length_m ?? wall.length ?? 3);
          return {
            id: String(wall.id ?? 'W1'),
            length_m: Number.isFinite(wallLen) && wallLen > 0 ? Math.min(wallLen, 30) : 3,
            features,
          };
        });
        const windowCount = walls.flatMap(w => w.features).filter(f => f.type === 'window').length;
        const doorCount   = walls.flatMap(w => w.features).filter(f => f.type === 'door').length;
        console.log(`[analyze:step2:walls] room ${idx + 1}: ${walls.length} walls, ${windowCount} windows, ${doorCount} doors`);
      }

      return {
        id:        String(room.id    ?? `room_${idx + 1}`),
        label:     String(room.label ?? `Помещение ${idx + 1}`),
        type_hint: VALID_HINTS.has(rawHint) ? (rawHint as 'bathroom' | 'kitchen' | 'hallway' | 'balcony') : null,
        width_m:   clampDim(width_m,  0.5, 20),
        length_m:  clampDim(length_m, 0.5, 20),
        shape,
        walls,
      };
    });

    return {
      total_spaces: Number(parsed.total_spaces ?? rooms.length),
      rooms,
    };
  } catch (e) {
    console.warn('[analyze:step2:parse] failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ── OpenRouter Kimi K2.6 — two-step: observe → extract ───────────────────────

async function analyzeWithOpenRouter(base64DataUrl: string, apiKey: string): Promise<AnalysisResult | null> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Title': 'INTERA',
  };

  // ── Step 1: image → free-text description (no JSON) ──────────────────────
  console.log('[analyze:openrouter] Step 1 — free analysis (image → text)...');
  const res1 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.6',
      reasoning: { enabled: false },
      messages: [
        {
          role: 'system',
          content: 'You are analyzing a Russian architectural floor plan (BTI).\nRead it carefully and describe everything you observe.\nDo NOT output JSON. Write a detailed text description.',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64DataUrl } },
            { type: 'text', text: STEP1_PROMPT },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0,
    }),
  });

  const text1 = await res1.text();
  console.log(`[analyze:openrouter] Step 1 HTTP ${res1.status} | length: ${text1.length}`);
  if (!res1.ok) {
    console.error('[analyze:openrouter] Step 1 error:', text1.slice(0, 400));
    throw new Error(`OpenRouter Step 1 HTTP ${res1.status}: ${text1.slice(0, 300)}`);
  }

  const data1 = JSON.parse(text1) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; error?: { message?: string } };
  if (data1.error) throw new Error(`OpenRouter Step 1 API error: ${data1.error.message}`);

  const analysisText = data1?.choices?.[0]?.message?.content
    || data1?.choices?.[0]?.message?.reasoning_content
    || '';
  console.log('[analyze:step1:analysis]', analysisText.slice(0, 300));

  if (!analysisText.trim()) {
    console.warn('[analyze:openrouter] Step 1 returned empty text — falling back');
    return null;
  }

  // ── Step 2: analysisText (no image) → structured JSON ────────────────────
  console.log('[analyze:openrouter] Step 2 — structured extraction (text → JSON)...');
  const res2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.6',
      reasoning: { enabled: false },
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant.\nConvert architectural analysis text into structured JSON.\nReturn ONLY valid JSON, no explanation, no markdown.',
        },
        {
          role: 'user',
          content: buildStep2Prompt(analysisText),
        },
      ],
      max_tokens: 2048,
      temperature: 0,
    }),
  });

  const text2 = await res2.text();
  console.log(`[analyze:openrouter] Step 2 HTTP ${res2.status} | length: ${text2.length}`);
  if (!res2.ok) {
    console.error('[analyze:openrouter] Step 2 error:', text2.slice(0, 400));
    throw new Error(`OpenRouter Step 2 HTTP ${res2.status}: ${text2.slice(0, 300)}`);
  }

  const data2 = JSON.parse(text2) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; error?: { message?: string } };
  if (data2.error) throw new Error(`OpenRouter Step 2 API error: ${data2.error.message}`);

  const rawJson = data2?.choices?.[0]?.message?.content
    || data2?.choices?.[0]?.message?.reasoning_content
    || '';
  console.log('[analyze:step2:raw]', rawJson.slice(0, 500));

  const parsedData = parseStep2Response(rawJson);
  if (!parsedData || parsedData.rooms.length === 0) {
    console.warn('[analyze:openrouter] Step 2 returned no rooms — falling back');
    return null;
  }
  console.log('[analyze:step2:rooms_found]', parsedData.total_spaces);

  // ── Build GeometryRooms from Step 2 data ──────────────────────────────────
  const OPPOSITE_WALL: Record<string, string> = { W1: 'W3', W3: 'W1', W2: 'W4', W4: 'W2' };

  const geometryRooms: GeometryRoom[] = parsedData.rooms.map((r, idx) => {
    const type: RoomType = 'unknown';
    const width_m  = r.width_m  || 3.0;
    const length_m = r.length_m || 4.0;
    const height_m = 2.7;
    const size_category = toSizeCategory(undefined, width_m, length_m);
    const num_photos_needed: 1 | 2 = width_m * length_m >= 15 ? 2 : 1;

    // Use parsed walls if available, otherwise build defaults
    const walls = r.walls
      ? parseRoomWalls(r.walls, width_m, length_m)
      : buildDefaultWalls(width_m, length_m);

    // Derive camera: place on wall OPPOSITE to the wall with most window area
    const lightWall = walls.reduce<{ id: string; totalM: number } | null>((best, w) => {
      const totalM = w.features
        .filter(f => f.type === 'window')
        .reduce((s, f) => s + f.width_m, 0);
      return totalM > (best?.totalM ?? 0) ? { id: w.id, totalM } : best;
    }, null);

    let suggested_cameras: CameraSuggestion[];
    if (lightWall && lightWall.totalM > 0) {
      const camWall = OPPOSITE_WALL[lightWall.id] ?? 'W3';
      console.log(`[analyze:cameras] room ${idx + 1}: light wall ${lightWall.id} (${lightWall.totalM.toFixed(1)}m) → camera on ${camWall}`);
      suggested_cameras = [
        { camera_at_wall_id: camWall, facing_wall_id: lightWall.id, description: `Facing light wall ${lightWall.id}` },
      ];
      if (num_photos_needed === 2) {
        const second = ['W1', 'W3'].includes(lightWall.id) ? 'W4' : 'W3';
        const secondFacing = ['W1', 'W3'].includes(lightWall.id) ? 'W2' : 'W1';
        suggested_cameras.push({ camera_at_wall_id: second, facing_wall_id: secondFacing, description: 'Secondary angle' });
      }
    } else {
      suggested_cameras = buildDefaultCameras(type, num_photos_needed);
    }

    void idx;
    return {
      id:   r.id,
      name: r.label,
      type,
      type_hint: r.type_hint,
      dimensions: { width_m, length_m, height_m },
      size_category,
      num_photos_needed,
      walls,
      suggested_cameras,
      shape: r.shape,
    };
  });

  const totalArea = geometryRooms.reduce((sum, r) => sum + getRoomArea(r), 0);
  const geometry: ApartmentGeometry = {
    is_bti_plan: true,
    apartment: {
      total_area_m2:    Math.round(totalArea * 10) / 10,
      ceiling_height_m: 2.7,
      orientation:      'unknown',
    },
    rooms: geometryRooms,
  };

  const rooms: RoomInfo[] = geometryRooms.map(geometryRoomToRoomInfo);
  console.log(`[analyze:openrouter] DONE — ${geometryRooms.length} rooms`);

  return {
    roomCount: geometryRooms.length,
    rooms,
    room_names: geometryRooms.map(r => r.name),
    geometry_json: geometry,
    debug_raw_response: analysisText.slice(0, 500),
  };
}

// ── Kimi K2.6 single-call fallback (via OpenRouter) ──────────────────────────

async function analyzeWithKimiFallback(base64DataUrl: string, apiKey: string): Promise<AnalysisResult | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://intera.vercel.app',
        'X-Title': 'INTERA Floor Plan Analyzer',
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2.6',
        reasoning: { enabled: false },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: base64DataUrl } },
              { type: 'text', text: USER_PROMPT },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0,
      }),
    });

    const responseText = await res.text();
    console.log(`[analyze:kimi-fallback] HTTP ${res.status} | response length: ${responseText.length} chars`);

    if (!res.ok) {
      console.warn('[analyze:kimi-fallback] Failed:', responseText.slice(0, 300));
      return null;
    }

    const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> };
    const content = data?.choices?.[0]?.message?.content
      || data?.choices?.[0]?.message?.reasoning_content
      || '';
    console.log(`[analyze:kimi-fallback] Raw response — length: ${content.length} chars | first 500: ${content.slice(0, 500)}`);
    const result = parseAnalysisResponse(content);
    if (result) {
      result.debug_raw_response = content.slice(0, 1000);
      return result;
    }
  } catch (err) {
    console.warn('[analyze:kimi-fallback] threw:', err instanceof Error ? err.message : err);
  }
  return null;
}
