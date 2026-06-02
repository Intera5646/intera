import Groq from 'groq-sdk';
import type { GeometryRoom, RoomInfo, FurnitureObject } from '../geometry/types';
import { getRoomArea } from '../geometry/polygon';

// Re-export so existing callers (`import { RoomInfo } from '…/groq'`) keep working.
export type { RoomInfo } from '../geometry/types';
export type { FurnitureObject } from '../geometry/types';

// groq-sdk kept in package.json — do not remove yet
let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}
void getGroq; // suppress unused-function warnings while groq-sdk is retained

// ── Kimi K2.6 via OpenRouter ──────────────────────────────────────────────────

async function callKimi(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  label?: string;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
  const { label, ...apiParams } = params;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Title': 'INTERA',
    },
    body: JSON.stringify({ model: 'moonshotai/kimi-k2.6', reasoning: { enabled: false }, ...apiParams }),
  });
  // Read body as text first — the API may return a plain-text error (e.g.
  // "Host not in allowlist") instead of JSON when the key has origin
  // restrictions, which makes res.json() throw a SyntaxError.
  const bodyText = await res.text();
  let data: { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; error?: { message: string } };
  try {
    data = JSON.parse(bodyText) as typeof data;
  } catch {
    throw new Error(`OpenRouter HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
  }
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `OpenRouter HTTP ${res.status}`);
  const msg = data.choices?.[0]?.message;
  const raw =
    (typeof msg?.content === 'string' && msg.content.length > 0 ? msg.content : '')
    || msg?.reasoning_content
    || '{}';
  // Extract JSON by finding first { or [ and last } or ]
  const firstObj = raw.indexOf('{');
  const firstArr = raw.indexOf('[');
  const lastObj  = raw.lastIndexOf('}');
  const lastArr  = raw.lastIndexOf(']');

  const start = (firstObj === -1) ? firstArr
    : (firstArr === -1) ? firstObj
    : Math.min(firstObj, firstArr);
  const end = Math.max(lastObj, lastArr);

  const result = (start !== -1 && end !== -1 && end > start)
    ? raw.slice(start, end + 1)
    : raw;

  console.log(`[callKimi${label ? ':' + label : ''}]`, result.slice(0, 200));
  return result;
}

export interface RoomPrompt {
  room_id: string;
  room_name: string;
  sd_prompt: string;
  sd_negative_prompt: string;
  report_text: string;
}

export interface DesignerText {
  furniture_placement: string;
  color_solution: string;
  lighting: string;
  style_explanation: string;
  budget_range: {
    min: number;
    max: number;
    currency: string;
    description: string;
  };
  shopping_highlights: Array<{
    category: string;
    item: string;
    price_range: string;
  }>;
}

const ROOM_LABELS: Record<string, string> = {
  living_room: 'гостиная',
  bedroom: 'спальня',
  kitchen: 'кухня',
  bathroom: 'ванная комната',
  office: 'рабочий кабинет',
  balcony: 'балкон / лоджия',
};

const BUDGET_RANGES: Record<string, { min: number; max: number }> = {
  'Эконом': { min: 250000, max: 700000 },
  'Средний': { min: 700000, max: 2000000 },
  'Премиум': { min: 2000000, max: 6000000 },
};

export async function generateDesignerText(params: {
  roomType: string;
  style: string;
  budget: string;
  wishes?: string;
}): Promise<DesignerText> {
  const roomLabel = ROOM_LABELS[params.roomType] ?? params.roomType;
  const range = BUDGET_RANGES[params.budget] ?? { min: 500000, max: 1500000 };

  const wishesClause = params.wishes?.trim()
    ? `\nПожелания клиента: ${params.wishes.slice(0, 300)}`
    : '';

  const systemPrompt =
    'Ты — профессиональный дизайнер интерьеров в России. Отвечаешь кратко, конкретно и по-русски. Только JSON, никакого лишнего текста.';

  const userPrompt = `Опиши дизайн-решение для помещения: ${roomLabel}.
Стиль: "${params.style}". Бюджет: "${params.budget}".${wishesClause}

Верни ровно такой JSON (без markdown, без пояснений):
{
  "furniture_placement": "2-3 предложения о расстановке мебели и функциональных зонах",
  "color_solution": "2-3 предложения о цветовой палитре и сочетаниях",
  "lighting": "2-3 предложения о сценариях освещения и типах светильников",
  "style_explanation": "2-3 предложения об атмосфере и характере стиля",
  "budget_range": {
    "min": ${range.min},
    "max": ${range.max},
    "currency": "RUB",
    "description": "краткое описание: что входит в бюджет данного сегмента"
  },
  "shopping_highlights": [
    {"category": "Диван / кровать", "item": "название главного предмета мебели", "price_range": "от X до Y ₽"},
    {"category": "Освещение", "item": "тип светильника", "price_range": "от X до Y ₽"},
    {"category": "Напольное покрытие", "item": "материал", "price_range": "от X до Y ₽/м²"},
    {"category": "Декор", "item": "ключевые декоративные элементы", "price_range": "от X до Y ₽"}
  ]
}`;

  const content = await callKimi({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.65,
    max_tokens: 900,
    label: 'generateDesignerText',
  });
  return JSON.parse(content) as DesignerText;
}

// ── Two-stage design brief ────────────────────────────────────────────────────

export interface DesignBrief {
  concept: string;
  materials: {
    floor: string;
    walls: string;
    ceiling: string;
    furniture: string;
    accents: string;
  };
  furniture_layout: string;
  lighting: string;
  color_palette: string[];
  personalization_notes: string;
  sd_prompt: string;
  sd_negative_prompt: string;
  report_sections: {
    concept_description: string;
    materials_description: string;
    layout_description: string;
    lighting_description: string;
    personalization_description: string;
    budget_notes: string;
    implementation_tips: string;
  };
  room_prompts?: RoomPrompt[];
}

const BRIEF_SYSTEM_PROMPT = `You are a professional Russian interior designer with 15 years of experience. You create detailed, realistic, and personalized design briefs. Always respond in valid JSON only, no other text.

Given the room parameters, create a complete design brief with this exact JSON structure:
{
  "concept": "One sentence describing the overall design concept in Russian",
  "materials": {
    "floor": "exact material, finish, color in Russian",
    "walls": "exact material, texture, color in Russian",
    "ceiling": "material and height treatment in Russian",
    "furniture": "main furniture materials and fabrics in Russian",
    "accents": "decorative elements, plants, textiles in Russian"
  },
  "furniture_layout": "Detailed description of furniture placement in Russian, mention specific pieces and their positions",
  "lighting": "Lighting scheme: main light, accent lights, natural light in Russian",
  "color_palette": ["hex1", "hex2", "hex3", "hex4"],
  "personalization_notes": "How the design accounts for residents, pets, workspace needs in Russian",
  "sd_prompt": "ENGLISH ONLY: photorealistic interior design render, [style] style, [room type], [floor material], [wall material], [specific furniture with placement], [lighting description], [color palette], [decorative details], professional interior photography, shot on Canon EOS R5 24mm f/2.8, 8K resolution, high detail, architectural visualization, warm ambient lighting, realistic materials and textures",
  "sd_negative_prompt": "ENGLISH ONLY: cartoon, illustration, unrealistic, blurry, low quality, distorted furniture, floating objects, bad proportions, watermark, text",
  "report_sections": {
    "concept_description": "2-3 sentences about the concept in Russian",
    "materials_description": "Detailed materials explanation in Russian",
    "layout_description": "Furniture arrangement rationale in Russian",
    "lighting_description": "Lighting design explanation in Russian",
    "personalization_description": "How design fits the specific residents in Russian",
    "budget_notes": "What to prioritize in this budget segment in Russian",
    "implementation_tips": "3 practical tips for implementation in Russian"
  }
}`;

export async function buildDesignBrief(params: {
  roomType: string;
  style: string;
  budget: string;
  ceilingHeight: number;
  apartmentType?: string;
  uploadType?: string;
  residents?: string | null;
  hasPets?: string | null;
  needsWorkspace?: string | null;
  lightingPreference?: string | null;
  dislikedColors?: string | null;
  wishes?: string;
}): Promise<DesignBrief> {
  const roomLabel = ROOM_LABELS[params.roomType] ?? params.roomType;

  const lines: string[] = [
    `Тип помещения: ${roomLabel}`,
    `Стиль: ${params.style}`,
    `Бюджет: ${params.budget}`,
    `Высота потолков: ${params.ceilingHeight} мм`,
  ];
  if (params.apartmentType) lines.push(`Тип квартиры: ${params.apartmentType}`);
  if (params.uploadType) lines.push(`Тип входных данных: ${params.uploadType}`);
  if (params.residents) lines.push(`Количество проживающих: ${params.residents}`);
  if (params.hasPets) lines.push(`Домашние животные: ${params.hasPets}`);
  if (params.needsWorkspace) lines.push(`Рабочее место: ${params.needsWorkspace}`);
  if (params.lightingPreference) lines.push(`Предпочтения по освещению: ${params.lightingPreference}`);
  if (params.dislikedColors) lines.push(`Нежелательные цвета: ${params.dislikedColors}`);
  if (params.wishes?.trim()) lines.push(`Пожелания клиента: ${params.wishes.slice(0, 400)}`);

  const userPrompt = `Создай дизайн-бриф для следующего проекта:\n\n${lines.join('\n')}`;

  const attemptParse = async (prompt: string): Promise<DesignBrief> => {
    const content = await callKimi({
      messages: [
        { role: 'system', content: BRIEF_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1800,
      label: 'buildDesignBrief',
    });
    return JSON.parse(content) as DesignBrief;
  };

  try {
    const brief = await attemptParse(userPrompt);
    console.log('[buildDesignBrief] Success, sd_prompt length:', brief.sd_prompt?.length ?? 0);
    return brief;
  } catch (firstErr) {
    console.warn('[buildDesignBrief] First attempt failed, retrying:', firstErr);
    try {
      const simplePrompt = `Создай дизайн-бриф. Стиль: ${params.style}. Помещение: ${roomLabel}. Бюджет: ${params.budget}.`;
      const brief = await attemptParse(simplePrompt);
      console.log('[buildDesignBrief] Retry succeeded');
      return brief;
    } catch (secondErr) {
      console.error('[buildDesignBrief] Both attempts failed:', secondErr);
      throw secondErr;
    }
  }
}

export function buildFallbackPrompt(params: { roomType: string; style: string; budget: string }): {
  sdPrompt: string;
  sdNegativePrompt: string;
} {
  const roomLabelsEn: Record<string, string> = {
    living_room: 'living room',
    bedroom: 'bedroom',
    kitchen: 'kitchen with dining area',
    bathroom: 'bathroom',
    office: 'home office',
    balcony: 'balcony terrace',
    studio: 'studio apartment',
  };
  const room = roomLabelsEn[params.roomType] ?? params.roomType;
  return {
    sdPrompt: `photorealistic interior design render, ${params.style} style, ${room}, professional interior photography, shot on Canon EOS R5, 8K resolution, architectural visualization, warm ambient lighting, realistic materials`,
    sdNegativePrompt:
      'cartoon, illustration, unrealistic, blurry, low quality, distorted furniture, floating objects, bad proportions, watermark, text',
  };
}

// ── Per-room prompts for BTI multi-room pipeline ──────────────────────────────

const ROOM_BRIEF_SYSTEM = `You are a professional Russian interior designer. For each room in the provided list, generate a specific Stable Diffusion prompt and a short Russian report. Respond with valid JSON only, no other text.`;

export async function buildRoomPrompts(params: {
  rooms: RoomInfo[];
  style: string;
  budget: string;
  concept: string;
}): Promise<RoomPrompt[]> {
  const roomList = params.rooms.map((r) => {
    const sizeDesc = r.approximate_size === 'large' ? 'large' : r.approximate_size === 'small' ? 'small' : 'medium-sized';
    const lightDesc = r.natural_light === 'high' ? 'bright natural light' : r.natural_light === 'low' ? 'limited natural light' : 'moderate natural light';
    const windowsDesc = r.windows === 'yes' ? 'has windows' : 'no windows';
    return `- ${r.id}: ${r.name} (${sizeDesc}, ${windowsDesc}, ${lightDesc})`;
  }).join('\n');

  const userPrompt = `Style: ${params.style}. Budget: ${params.budget}. Overall concept: ${params.concept}.

Rooms to design:
${roomList}

For each room return this JSON array:
[
  {
    "room_id": "R1",
    "room_name": "Гостиная",
    "sd_prompt": "ENGLISH ONLY: photorealistic interior, [style] style, [room name], [specific furniture], [materials matching size and light], professional photography, Canon EOS R5, 8K",
    "sd_negative_prompt": "ENGLISH ONLY: cartoon, blurry, low quality, distorted, watermark, text, people",
    "report_text": "2-3 sentences in Russian about this specific room's design solution"
  }
]`;

  const attemptParse = async (prompt: string): Promise<RoomPrompt[]> => {
    const content = await callKimi({
      messages: [
        { role: 'system', content: ROOM_BRIEF_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 400 * params.rooms.length + 200,
      label: 'buildRoomPrompts',
    });
    // Kimi may wrap arrays in an object — unwrap if needed
    const parsed = JSON.parse(content) as Record<string, unknown> | RoomPrompt[];
    if (Array.isArray(parsed)) return parsed as RoomPrompt[];
    // Find the first array value in the object
    const firstArray = Object.values(parsed).find(Array.isArray) as RoomPrompt[] | undefined;
    return firstArray ?? [];
  };

  try {
    const prompts = await attemptParse(userPrompt);
    console.log('[buildRoomPrompts] Generated', prompts.length, 'room prompts');
    return prompts;
  } catch (err) {
    console.warn('[buildRoomPrompts] Failed, returning fallback prompts:', err);
    return params.rooms.map((r) => ({
      room_id: r.id,
      room_name: r.name,
      sd_prompt: `photorealistic interior design render, ${params.style} style, ${r.name}, professional photography, 8K, architectural visualization`,
      sd_negative_prompt: 'cartoon, blurry, low quality, distorted, watermark, text, people',
      report_text: `Дизайн ${r.name} выполнен в стиле ${params.style} с учётом бюджета ${params.budget}.`,
    }));
  }
}

export function formatReportText(sections: DesignBrief['report_sections']): string {
  return [
    `🎨 Концепция\n${sections.concept_description}`,
    `🪵 Материалы\n${sections.materials_description}`,
    `🛋 Расстановка мебели\n${sections.layout_description}`,
    `💡 Освещение\n${sections.lighting_description}`,
    `👥 Персонализация\n${sections.personalization_description}`,
    `💰 Бюджет\n${sections.budget_notes}`,
    `✅ Советы по реализации\n${sections.implementation_tips}`,
  ].join('\n\n');
}

// ── Wall-aware brief for v2 BTI pipeline (Flux Depth Pro) ────────────────────
// Uses actual room geometry from Phase 1 extraction to build a targeted prompt.
// The depth map already encodes the geometry; the prompt focuses on materials,
// lighting atmosphere, and camera framing that complements it.

export interface WallAwareBriefParams {
  room: GeometryRoom;
  style: string;
  budget: string;
  wishes?: string;
  cameraIndex?: number;
  furniture?: FurnitureObject[];
}

// Negative prompt tuned for Flux Depth Pro (geometry comes from depth map,
// so "bad geometry" terms are omitted to avoid fighting the control signal).
// Frame-contract terms prevent Flux from hallucinating extra doors/windows.
const FLUX_NEGATIVE_PROMPT =
  'blurry, low quality, cartoon, illustration, watermark, text, logo, people, ' +
  'faces, distorted scale, floating objects, oversaturated, flat lighting, ' +
  'dark shadows, underexposed, noise, artifacts, ' +
  'extra doors, extra windows, invented arches, hallway openings, wrong wall openings';

const ROOM_TYPE_EN: Record<string, string> = {
  kitchen:     'kitchen interior',
  bedroom:     'bedroom interior',
  living:      'living room interior',
  bathroom:    'bathroom interior',
  wc:          'toilet room interior',
  hallway:     'hallway and entrance area',
  balcony:     'enclosed balcony interior',
  storage:     'storage room',
  studio_zone: 'open-plan kitchen-living room',
};

const STYLE_DESC: Record<string, string> = {
  'Скандинавский': 'Scandinavian style, light birch wood, white walls, hygge cozy atmosphere, natural linen textures, indoor plants',
  'Минимализм':   'minimalist style, clean geometric lines, neutral palette, hidden storage, generous negative space',
  'Лофт':         'loft industrial style, exposed concrete walls, dark metal accents, Edison vintage bulbs, reclaimed wood',
  'Классика':     'classical elegant style, crown moldings, warm cream tones, upholstered traditional furniture, parquet floors',
  'Современный':  'modern contemporary style, sleek matte surfaces, bold accent wall, brushed metal fixtures, statement lighting',
};

const BUDGET_DESC: Record<string, string> = {
  'Эконом':  'budget-friendly materials, flat-pack furniture, laminate flooring, white painted walls, LED strip lighting',
  'Средний': 'mid-range quality, solid wood veneer furniture, engineered hardwood, quality porcelain tiles, designer pendant lights',
  'Премиум': 'luxury finishes, solid hardwood furniture, natural stone surfaces, venetian plaster, architectural statement lighting',
};

// Returns the lighting direction relative to the camera position.
function lightingFromCamera(cameraWallId: string, windowWallIds: string[]): string {
  if (windowWallIds.length === 0) {
    return 'warm artificial interior lighting, balanced ambient glow';
  }
  // Map: for each camera wall, which facing is "ahead", "left", "right", "behind"
  const directions: Record<string, Record<string, string>> = {
    W3: { W1: 'natural daylight from the far wall ahead', W2: 'natural light from the right side', W4: 'natural light from the left side', W3: 'backlit, daylight behind camera' },
    W1: { W3: 'natural daylight from the far wall ahead', W4: 'natural light from the right side', W2: 'natural light from the left side', W1: 'backlit, daylight behind camera' },
    W4: { W2: 'natural daylight from the far wall ahead', W1: 'natural light from the right side', W3: 'natural light from the left side', W4: 'backlit, daylight behind camera' },
    W2: { W4: 'natural daylight from the far wall ahead', W3: 'natural light from the right side', W1: 'natural light from the left side', W2: 'backlit, daylight behind camera' },
  };
  const map = directions[cameraWallId] ?? directions['W3'];
  for (const wid of windowWallIds) {
    if (map[wid]) return map[wid];
  }
  return 'soft natural side lighting';
}

// Maps wall IDs to human-readable camera-relative directions for the prompt.
const WALL_NAMES: Record<string, string> = {
  W1: 'back wall', W2: 'right wall', W3: 'front wall', W4: 'left wall',
};

// FIX 4: visible walls per camera wall (excludes the camera wall itself)
const VISIBLE_WALLS: Record<string, string[]> = {
  W3: ['W1', 'W4', 'W2'], // cam at W3: ahead=W1, left=W4, right=W2
  W1: ['W3', 'W2', 'W4'],
  W2: ['W4', 'W1', 'W3'],
  W4: ['W2', 'W3', 'W1'],
};

// Describes the features on each wall visible from the camera — used as the
// "frame contract" block that tells Flux which openings to render.
function describeVisibleWalls(room: GeometryRoom, cameraWallId: string): string {
  const visibleIds = VISIBLE_WALLS[cameraWallId] ?? ['W1', 'W4', 'W2'];
  const wallById = new Map(room.walls.map(w => [w.id, w]));
  const relLabel: Record<string, string> = { W1: 'ahead', W2: 'right wall', W3: 'front wall', W4: 'left wall' };
  return visibleIds.map(wid => {
    const wall = wallById.get(wid);
    if (!wall || wall.features.length === 0) return `  ${relLabel[wid] ?? wid}: solid wall, no openings`;
    const feats = wall.features
      .map(f => `${f.type} at ${f.position_from_start_m.toFixed(1)}m (${f.width_m.toFixed(1)}m wide)`)
      .join('; ');
    return `  ${relLabel[wid] ?? wid}: ${feats}`;
  }).join('\n');
}

function describeFurniture(furniture: FurnitureObject[]): string {
  if (!furniture.length) return '';
  return furniture
    .map(f => `${f.type.replace(/_/g, ' ')} against the ${WALL_NAMES[f.anchorWallId] ?? f.anchorWallId}`)
    .join(', ');
}

// Deterministic fallback — used when Groq is unavailable or returns bad JSON.
function wallAwareFallback(params: WallAwareBriefParams, lightingDesc: string): { prompt: string; negativePrompt: string } {
  const roomTypeEn = ROOM_TYPE_EN[params.room.type] ?? params.room.type;
  const styleDesc  = STYLE_DESC[params.style]   ?? params.style;
  const budgetDesc = BUDGET_DESC[params.budget]  ?? params.budget;
  const { width_m, length_m, height_m } = params.room.dimensions;
  void width_m; void length_m;
  const area = getRoomArea(params.room);
  const sizeTag  = area < 10 ? 'compact' : area < 20 ? 'medium-sized' : 'spacious';
  const heightTag = height_m < 2.6 ? 'low ceiling' : height_m > 2.9 ? 'high ceiling' : 'standard ceiling height';

  const cam = params.room.suggested_cameras[params.cameraIndex ?? 0];
  const camDesc = cam?.description ?? 'wide angle interior shot';

  const parts = [
    'photorealistic interior photograph',
    roomTypeEn,
    styleDesc,
    budgetDesc,
    `${sizeTag} room, ${heightTag}`,
    lightingDesc,
    camDesc,
    '8K resolution',
    'professional architectural photography',
    'cinematic depth of field',
    'no people',
  ];
  if (params.furniture?.length) parts.push(`fully furnished: ${describeFurniture(params.furniture)}`);
  if (params.wishes?.trim()) parts.push(params.wishes.slice(0, 120));

  return { prompt: parts.join(', '), negativePrompt: FLUX_NEGATIVE_PROMPT };
}

export async function buildWallAwareBrief(
  params: WallAwareBriefParams,
): Promise<{ prompt: string; negativePrompt: string }> {
  const { room, style, budget, wishes, cameraIndex = 0 } = params;
  const { width_m, length_m, height_m } = room.dimensions;
  const area = getRoomArea(room);

  // Collect wall IDs that have at least one window feature
  const windowWallIds = room.walls
    .filter(w => w.features.some(f => f.type === 'window'))
    .map(w => w.id);

  const cam = room.suggested_cameras[cameraIndex] ?? room.suggested_cameras[0];
  const cameraWallId = cam?.camera_at_wall_id ?? 'W3';
  const lightingDesc = lightingFromCamera(cameraWallId, windowWallIds);

  const roomTypeEn = ROOM_TYPE_EN[room.type] ?? room.type;
  const sizeTag    = area < 10 ? 'compact' : area < 20 ? 'medium-sized' : area < 30 ? 'spacious' : 'large open-plan';
  const heightTag  = height_m < 2.6 ? 'low ceiling' : height_m > 2.9 ? 'high ceiling' : 'standard ceiling height';
  const camDesc    = cam?.description ?? 'wide angle interior shot';

  // Number of windows and doors for atmosphere hints
  const totalWindows = room.walls.reduce((n, w) => n + w.features.filter(f => f.type === 'window').length, 0);
  const windowsHint  = totalWindows === 0 ? 'no windows' : totalWindows === 1 ? 'single window' : 'multiple windows';

  const systemPrompt =
    'You are a prompt engineer for Flux Depth Pro. The control image is a 3D block model of the room ' +
    'with furniture shown in semantic colors (e.g. blue-grey sofa, white bathtub, brown door, sky-blue window). ' +
    'Render it as a photorealistic interior, keeping every furniture piece and opening exactly where its colored ' +
    'block sits. Your prompt focuses on materials, lighting atmosphere, style mood and camera framing — ' +
    'describe the furniture that is present, do not omit it. Write in English only. Return JSON only.';

  const furnitureClause = params.furniture?.length
    ? `Furniture already placed in scene: ${describeFurniture(params.furniture)}.\n`
    : '';

  // FIX 4: explicit per-wall feature description — constrains Flux to exact openings
  const wallFrameDesc = describeVisibleWalls(room, cameraWallId);
  const frameContract =
    `\nFRAME CONTRACT — render EXACTLY these openings, no extras:\n${wallFrameDesc}\n`;

  const userPrompt =
    `Room: ${roomTypeEn}\n` +
    `Dimensions: ${width_m.toFixed(1)} × ${length_m.toFixed(1)} m, ${sizeTag}, ${heightTag}\n` +
    `Windows: ${windowsHint}\n` +
    `Lighting: ${lightingDesc}\n` +
    `Camera angle: ${camDesc}\n` +
    `Style: ${style}\n` +
    `Budget tier: ${budget}\n` +
    furnitureClause +
    (wishes?.trim() ? `Client wishes: ${wishes.slice(0, 200)}\n` : '') +
    frameContract +
    `\nReturn JSON:\n` +
    `{\n` +
    `  "prompt": "photorealistic interior photograph, [room], [style], [materials], [furniture list with positions], [lighting], [camera], 8K, architectural photography, no people",\n` +
    `  "negative_prompt": "${FLUX_NEGATIVE_PROMPT}"\n` +
    `}`;

  try {
    const raw = await callKimi({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      max_tokens: 450,
      label: `buildWallAwareBrief:${room.type}`,
    });
    const parsed = JSON.parse(raw) as { prompt?: string; negative_prompt?: string };

    if (parsed.prompt && parsed.prompt.length > 20) {
      console.log('[buildWallAwareBrief] Kimi ok — prompt:', parsed.prompt.length, 'chars | room:', room.type, `${area.toFixed(0)}m²`);
      return {
        prompt:         parsed.prompt,
        negativePrompt: parsed.negative_prompt ?? FLUX_NEGATIVE_PROMPT,
      };
    }
    console.warn('[buildWallAwareBrief] Kimi returned empty prompt, using fallback');
  } catch (err) {
    console.warn('[buildWallAwareBrief] Kimi failed, using fallback:', err instanceof Error ? err.message : err);
  }

  const fallback = wallAwareFallback(params, lightingDesc);
  console.log('[buildWallAwareBrief] fallback prompt:', fallback.prompt.length, 'chars');
  return fallback;
}

// ── Legacy prompt builder (kept for compatibility) ────────────────────────────

export async function buildGenerationPrompt(params: {
  roomType: string;
  style: string;
  budget: string;
  wishes?: string;
}): Promise<{ prompt: string; negativePrompt: string }> {
  const roomLabelsEn: Record<string, string> = {
    living_room: 'living room',
    bedroom: 'bedroom',
    kitchen: 'kitchen with dining area',
    bathroom: 'bathroom',
    office: 'home office',
    balcony: 'balcony terrace',
  };

  const styleMap: Record<string, string> = {
    'Скандинавский': 'Scandinavian style, light birch wood, white walls, hygge cozy atmosphere, natural linen textures, indoor plants',
    'Минимализм': 'minimalist style, clean geometric lines, neutral palette, hidden storage, generous negative space',
    'Лофт': 'loft industrial style, exposed brick, raw concrete, dark metal frames, Edison vintage bulbs',
    'Классика': 'classical elegant style, crown moldings, warm cream tones, upholstered traditional furniture, parquet floors',
    'Современный': 'modern contemporary style, sleek matte surfaces, bold accent colors, brushed metal, glass',
  };

  const budgetMap: Record<string, string> = {
    'Эконом': 'budget materials, IKEA furniture, laminate flooring, white painted walls, LED lighting',
    'Средний': 'mid-range quality furniture, engineered hardwood, quality tiles, stylish pendant lights',
    'Премиум': 'luxury designer furniture, natural stone, venetian plaster, Flos architectural lighting, premium finishes',
  };

  const room = roomLabelsEn[params.roomType] ?? params.roomType;
  const stylePart = styleMap[params.style] ?? params.style;
  const budgetPart = budgetMap[params.budget] ?? params.budget;
  const wishesPart = params.wishes?.trim()
    ? `, ${params.wishes.slice(0, 150)}`
    : '';

  const prompt = `photorealistic interior photograph, ${room}, ${stylePart}, ${budgetPart}${wishesPart}, 8k resolution, soft natural light, professional architectural photography, cinematic depth of field, no people`;

  const negativePrompt =
    'bad geometry, distorted walls, warped perspective, cartoon, anime, watermark, text overlay, low quality, blurry, oversaturated, people, faces, ugly, deformed, extra rooms, surreal';

  return { prompt, negativePrompt };
}

// ── Apartment-level design report for BTI v2 pipeline ────────────────────────
// Called once after all room renders complete — one Groq call for the whole project.

export async function buildApartmentReport(params: {
  geometry: import('../geometry/types').ApartmentGeometry;
  style: string;
  budget: string;
  wishes?: string;
}): Promise<{ designerText: DesignerText; reportText: string }> {
  const { geometry, style, budget, wishes } = params;
  const range = BUDGET_RANGES[budget] ?? { min: 500000, max: 1500000 };

  const roomList = geometry.rooms
    .map(r => `- ${r.name}: ${r.dimensions.width_m}×${r.dimensions.length_m} м (${r.type})`)
    .join('\n');

  const wishesClause = wishes?.trim() ? `\nПожелания: ${wishes.slice(0, 300)}` : '';

  const systemPrompt =
    'Ты — профессиональный дизайнер интерьеров в России. Отвечаешь конкретно и по-русски. Только JSON, никакого лишнего текста.';

  const userPrompt = `Опиши единую дизайн-концепцию всей квартиры.
Стиль: "${style}". Бюджет: "${budget}".
Площадь: ${geometry.apartment.total_area_m2} м². Высота потолков: ${geometry.apartment.ceiling_height_m} м.

Помещения:
${roomList}
${wishesClause}

Объясни цельную концепцию: выбор материалов по комнатам (например, плитка в кухне и прихожей, паркет в жилых), цветовое единство, световые сценарии по зонам.

Верни ровно такой JSON (без markdown, без пояснений):
{
  "furniture_placement": "Логика расстановки и зонирования всей квартиры: проходные пространства, хранение, функциональность (2-4 предложения)",
  "color_solution": "Единая цветовая палитра квартиры: основные тона, акценты, как цвет объединяет разные комнаты (2-4 предложения)",
  "lighting": "Световые сценарии по зонам: кухня, жилые, санузел, прихожая — тип светильников и логика (2-4 предложения)",
  "style_explanation": "Стиль и материалы: почему плитка в кухне/прихожей, что в спальнях, отделка стен — как материалы усиливают стиль (2-4 предложения)",
  "budget_range": {
    "min": ${range.min},
    "max": ${range.max},
    "currency": "RUB",
    "description": "Что входит в бюджет данного сегмента: черновые работы, чистовые, мебель, декор"
  },
  "shopping_highlights": [
    {"category": "Напольное покрытие (жилые)", "item": "конкретный материал и марка", "price_range": "от X до Y ₽/м²"},
    {"category": "Напольное покрытие (кухня/прихожая)", "item": "плитка или иной материал", "price_range": "от X до Y ₽/м²"},
    {"category": "Кухонный гарнитур", "item": "стиль, материал фасадов", "price_range": "от X до Y ₽"},
    {"category": "Освещение", "item": "основная система + акценты", "price_range": "от X до Y ₽"},
    {"category": "Мебель (жилые комнаты)", "item": "ключевые предметы", "price_range": "от X до Y ₽"}
  ]
}`;

  const content = await callKimi({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 1200,
    label: 'buildApartmentReport',
  });
  const designerText = JSON.parse(content) as DesignerText;

  const reportText = [
    `🎨 Концепция стиля\n${designerText.style_explanation ?? ''}`,
    `🛋 Планировка и зонирование\n${designerText.furniture_placement ?? ''}`,
    `🎨 Цветовая палитра\n${designerText.color_solution ?? ''}`,
    `💡 Освещение\n${designerText.lighting ?? ''}`,
    `💰 Бюджет\n${designerText.budget_range?.description ?? ''}`,
  ].join('\n\n');

  return { designerText, reportText };
}

// ── Room furniture planner for BTI v2 depth map ───────────────────────────────
// One Groq call per room. Returns FurnitureObject[] anchored to walls.
// If Groq fails, returns a hardcoded default set for the room type.

// §5 Kitchen: model the work sequence as SEPARATE blocks (fridge → sink → prep →
// cooktop) so the semantic render shows each appliance in its own color.
// §4 Sanitary: bathroom = wet fixture + vanity + toilet; wc = toilet + small sink.
const MANDATORY_FURNITURE: Record<string, string> = {
  living:      'sofa (against longest solid wall, facing center), tv_unit (wall opposite sofa), shelving (solid wall)',
  bedroom:     'bed (headboard against solid wall), 2x nightstand (flanking bed), wardrobe (side or opposite wall)',
  kitchen:     'kitchen_run (base counter along one wall), fridge (one end of the run), sink_kitchen (on the run), stove (on the run, work sequence fridge → sink → prep → stove), upper_cabinets (wall-mounted above the run)',
  bathroom:    'bathtub OR shower (against wall), vanity_sink (against wall), toilet (corner away from door)',
  wc:          'toilet (against back wall), corner_sink (corner)',
  hallway:     'wardrobe or coat_storage (against wall), console_table (against wall)',
  balcony:     'bistro_table (center), shelving (along wall)',
  storage:     'shelving (along walls)',
  studio_zone: 'sofa (living zone), kitchen_run (kitchen zone along wall), fridge (end of run), sink_kitchen (on run), stove (on run)',
};

const FALLBACK_FURNITURE: Record<string, FurnitureObject[]> = {
  living: [
    { id: 'F1', type: 'sofa',       anchorWallId: 'W1', positionAlongWall: 0.10, widthM: 2.1, depthM: 0.90, heightM: 0.85 },
    { id: 'F2', type: 'tv_unit',    anchorWallId: 'W4', positionAlongWall: 0.30, widthM: 1.4, depthM: 0.45, heightM: 0.50 },
    { id: 'F3', type: 'shelving',   anchorWallId: 'W2', positionAlongWall: 0.50, widthM: 0.8, depthM: 0.30, heightM: 2.00 },
  ],
  bedroom: [
    { id: 'F1', type: 'bed',        anchorWallId: 'W1', positionAlongWall: 0.20, widthM: 1.6, depthM: 2.00, heightM: 0.55 },
    { id: 'F2', type: 'nightstand', anchorWallId: 'W2', positionAlongWall: 0.10, widthM: 0.5, depthM: 0.45, heightM: 0.55 },
    { id: 'F3', type: 'wardrobe',   anchorWallId: 'W2', positionAlongWall: 0.60, widthM: 1.2, depthM: 0.60, heightM: 2.20 },
  ],
  kitchen: [
    // Work sequence along W1: fridge → sink → stove, with a base run + wall cabinets
    { id: 'F1', type: 'kitchen_run',    anchorWallId: 'W1', positionAlongWall: 0.00, widthM: 3.2,  depthM: 0.60, heightM: 0.90 },
    { id: 'F2', type: 'fridge',         anchorWallId: 'W1', positionAlongWall: 0.00, widthM: 0.65, depthM: 0.65, heightM: 1.85 },
    { id: 'F3', type: 'sink_kitchen',   anchorWallId: 'W1', positionAlongWall: 0.45, widthM: 0.80, depthM: 0.60, heightM: 0.90 },
    { id: 'F4', type: 'stove',          anchorWallId: 'W1', positionAlongWall: 0.75, widthM: 0.60, depthM: 0.60, heightM: 0.90 },
    { id: 'F5', type: 'upper_cabinets', anchorWallId: 'W1', positionAlongWall: 0.00, widthM: 3.2,  depthM: 0.35, heightM: 0.70, yOffsetM: 1.5 },
  ],
  bathroom: [
    { id: 'F1', type: 'bathtub',     anchorWallId: 'W1', positionAlongWall: 0.05, widthM: 1.70, depthM: 0.75, heightM: 0.60 },
    { id: 'F2', type: 'vanity_sink', anchorWallId: 'W2', positionAlongWall: 0.10, widthM: 0.85, depthM: 0.55, heightM: 0.85 },
    { id: 'F3', type: 'toilet',      anchorWallId: 'W4', positionAlongWall: 0.10, widthM: 0.40, depthM: 0.65, heightM: 0.80 },
  ],
  wc: [
    { id: 'F1', type: 'toilet',      anchorWallId: 'W1', positionAlongWall: 0.30, widthM: 0.40, depthM: 0.65, heightM: 0.80 },
    { id: 'F2', type: 'corner_sink', anchorWallId: 'W4', positionAlongWall: 0.05, widthM: 0.40, depthM: 0.40, heightM: 0.80 },
  ],
  hallway: [
    { id: 'F1', type: 'wardrobe',       anchorWallId: 'W2', positionAlongWall: 0.20, widthM: 1.2, depthM: 0.55, heightM: 2.20 },
    { id: 'F2', type: 'console_table',  anchorWallId: 'W4', positionAlongWall: 0.30, widthM: 0.8, depthM: 0.35, heightM: 0.85 },
  ],
  balcony: [
    { id: 'F1', type: 'bistro_table', anchorWallId: 'W1', positionAlongWall: 0.30, widthM: 0.7, depthM: 0.70, heightM: 0.75 },
  ],
  storage: [
    { id: 'F1', type: 'shelving', anchorWallId: 'W1', positionAlongWall: 0.00, widthM: 2.5, depthM: 0.40, heightM: 2.20 },
    { id: 'F2', type: 'shelving', anchorWallId: 'W2', positionAlongWall: 0.10, widthM: 1.2, depthM: 0.40, heightM: 2.20 },
  ],
  studio_zone: [
    { id: 'F1', type: 'sofa',         anchorWallId: 'W1', positionAlongWall: 0.10, widthM: 2.1,  depthM: 0.90, heightM: 0.85 },
    { id: 'F2', type: 'kitchen_run',  anchorWallId: 'W2', positionAlongWall: 0.00, widthM: 2.5,  depthM: 0.60, heightM: 0.90 },
    { id: 'F3', type: 'fridge',       anchorWallId: 'W2', positionAlongWall: 0.00, widthM: 0.65, depthM: 0.65, heightM: 1.85 },
    { id: 'F4', type: 'sink_kitchen', anchorWallId: 'W2', positionAlongWall: 0.45, widthM: 0.80, depthM: 0.60, heightM: 0.90 },
    { id: 'F5', type: 'stove',        anchorWallId: 'W2', positionAlongWall: 0.75, widthM: 0.60, depthM: 0.60, heightM: 0.90 },
  ],
};

function validateFurnitureResponse(raw: unknown, room: GeometryRoom): FurnitureObject[] {
  const { width_m: W, length_m: L } = room.dimensions;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).slice(0, 12).flatMap((item: unknown, idx) => {
    const f = (item ?? {}) as Record<string, unknown>;
    const wallId = String(f.anchorWallId ?? '');
    if (!['W1', 'W2', 'W3', 'W4'].includes(wallId)) return [];
    const wallLen = ['W1', 'W3'].includes(wallId) ? W : L;
    const pos     = Math.max(0, Math.min(0.9, Number(f.positionAlongWall ?? 0)));
    const widthM  = Math.max(0.2, Math.min(wallLen * 0.95, Number(f.widthM  ?? 1.0)));
    const depthM  = Math.max(0.1, Math.min(2.5,             Number(f.depthM  ?? 0.5)));
    const heightM = Math.max(0.1, Math.min(2.5,             Number(f.heightM ?? 1.0)));
    const obj: FurnitureObject = {
      id:                String(f.id ?? `F${idx + 1}`),
      type:              String(f.type ?? 'furniture'),
      anchorWallId:      wallId,
      positionAlongWall: pos,
      widthM,
      depthM,
      heightM,
    };
    // Preserve vertical offset for wall-mounted items (e.g. upper_cabinets)
    if (f.yOffsetM !== undefined) {
      obj.yOffsetM = Math.max(0, Math.min(2.4, Number(f.yOffsetM) || 0));
    }
    if (f.facing) obj.facing = String(f.facing);
    return [obj];
  });
}

export async function buildRoomFurniturePlan(room: GeometryRoom): Promise<FurnitureObject[]> {
  const { width_m: W, length_m: L, height_m: H } = room.dimensions;

  const wallLines = room.walls.map(wall => {
    const featDesc = wall.features.length === 0
      ? 'no features'
      : wall.features.map(f =>
          `${f.type} at ${f.position_from_start_m.toFixed(1)}m from start, width ${f.width_m.toFixed(1)}m`
        ).join('; ');
    return `  ${wall.id} (${wall.length_m.toFixed(1)}m): ${featDesc}`;
  }).join('\n');

  const mandatory = MANDATORY_FURNITURE[room.type] ?? 'appropriate furniture for this room type';
  // Camera is at W3 — furniture there would occlude the viewpoint
  const camWall = room.suggested_cameras[0]?.camera_at_wall_id ?? 'W3';

  const userPrompt =
    `Place furniture in this room for a photorealistic 3D depth map render.\n\n` +
    `Room type: ${room.type} (${room.name})\n` +
    `Dimensions: W=${W.toFixed(1)}m × L=${L.toFixed(1)}m × H=${H.toFixed(1)}m\n` +
    `Walls (ID, length, features):\n${wallLines}\n\n` +
    `Wall system: W1=back(Z far), W2=right(X far), W3=front(Z near), W4=left(X=0)\n` +
    `positionAlongWall: 0.0=start of wall, 1.0=end of wall\n\n` +
    `Required furniture: ${mandatory}\n\n` +
    `Rules:\n` +
    `1. Never place furniture blocking a door — keep door openings clear (check features above)\n` +
    `2. Never place furniture over a window\n` +
    `3. Leave at least 0.8m walking clearance between pieces\n` +
    `4. positionAlongWall + widthM / wallLength must be ≤ 1.0 (furniture must fit on wall)\n` +
    `5. Do not place furniture against ${camWall} (camera is there)\n\n` +
    `Return JSON: { "furniture": [ ... ] }\n` +
    `Each item: { "id":"F1", "type":"sofa", "anchorWallId":"W1", "positionAlongWall":0.1, "widthM":2.1, "depthM":0.9, "heightM":0.85, "facing":"center" }\n` +
    `Use these exact type names so the render colors them correctly: sofa, bed, wardrobe, nightstand, tv_unit, ` +
    `coffee_table, shelving, console_table, kitchen_run, upper_cabinets, fridge, sink_kitchen, stove, ` +
    `bathtub, shower, toilet, vanity_sink, corner_sink.\n` +
    `For wall-mounted items (upper_cabinets) set "yOffsetM" to the floor clearance (e.g. 1.5).\n` +
    `Kitchen work sequence along one wall: fridge → sink_kitchen → prep gap → stove, with kitchen_run as the base counter and upper_cabinets above it.\n` +
    `Realistic sizes: sofa~2.0×0.9×0.85, bed~1.6×2.0×0.55, wardrobe~1.2×0.6×2.2, fridge~0.65×0.65×1.85, ` +
    `sink_kitchen~0.8×0.6×0.9, stove~0.6×0.6×0.9, kitchen_run~[wall_width]×0.6×0.9, upper_cabinets~[wall_width]×0.35×0.7 (yOffsetM 1.5), ` +
    `toilet~0.4×0.65×0.8, bathtub~1.7×0.75×0.6, shower~0.9×0.9×2.0, vanity_sink~0.85×0.55×0.85, corner_sink~0.4×0.4×0.8`;

  try {
    const raw = await callKimi({
      messages: [
        { role: 'system', content: 'You are an interior designer placing furniture. Return only valid JSON.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
      label: `buildRoomFurniturePlan:${room.name}`,
    });
    const parsed = JSON.parse(raw) as { furniture?: unknown };
    const validated = validateFurnitureResponse(parsed.furniture, room);

    // FIX 1: strip any items Groq placed on the camera wall despite instruction
    const filtered = validated.filter(f => f.anchorWallId !== camWall);
    if (filtered.length > 0) {
      console.log(`[designer] ${room.name}: planned ${filtered.length} furniture objects`);
      return filtered;
    }
    console.warn(`[designer] ${room.name}: Groq returned 0 valid objects — using fallback`);
  } catch (err) {
    console.warn(`[designer] ${room.name}: Groq failed — using fallback:`, err instanceof Error ? err.message : err);
  }

  // FIX 1: filter fallback too — never put furniture on camera wall
  const fallback = (FALLBACK_FURNITURE[room.type] ?? FALLBACK_FURNITURE['living'] ?? [])
    .filter(f => f.anchorWallId !== camWall);
  console.log(`[designer] ${room.name}: fallback furniture — ${fallback.length} objects`);
  return fallback;
}
