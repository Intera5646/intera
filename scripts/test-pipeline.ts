/**
 * End-to-end pipeline test — exercises the REAL prompt-building functions
 * against the REAL Kimi (OpenRouter) API to verify the callKimi fix returns
 * actual content rather than '{}'.
 *
 * Run:  npx tsx scripts/test-pipeline.ts
 *
 * Requires OPENROUTER_API_KEY in .env.local (or the shell environment).
 * This script does NOT mock Kimi — every prompt-builder hits the live API.
 */

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Load .env.local first (project convention), then fall back to .env
loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

import {
  buildDesignBrief,
  buildWallAwareBrief,
  buildApartmentReport,
  buildRoomFurniturePlan,
} from '../src/lib/ai/groq';
import type {
  ApartmentGeometry,
  GeometryRoom,
  GeneralPreferences,
  RoomPreference,
} from '../src/lib/geometry/types';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;

function pass(stage: string, detail = '') {
  passCount++;
  console.log(`${GREEN}✅ PASS${RESET} — ${stage}${detail ? ` ${DIM}(${detail})${RESET}` : ''}`);
}
function fail(stage: string, detail = '') {
  failCount++;
  console.log(`${RED}❌ FAIL${RESET} — ${stage}${detail ? ` ${RED}${detail}${RESET}` : ''}`);
}
function banner(text: string) {
  console.log(`\n${YELLOW}━━━ ${text} ━━━${RESET}`);
}

// ── Sample geometry ─────────────────────────────────────────────────────────────
// W1=back, W2=right, W3=front (camera), W4=left.
function makeRoom(
  id: string,
  name: string,
  type: GeometryRoom['type'],
  width_m: number,
  length_m: number,
  opts: { window?: boolean; door?: boolean } = { window: true, door: true },
): GeometryRoom {
  const area = width_m * length_m;
  const size_category = area < 8 ? 'small' : area < 18 ? 'medium' : 'large';
  // W1 length runs along width, W2 length runs along length.
  const walls = [
    {
      id: 'W1',
      length_m: width_m,
      features: opts.window
        ? [{ type: 'window' as const, position_from_start_m: width_m / 2 - 0.6, width_m: 1.2 }]
        : [],
    },
    { id: 'W2', length_m, features: [] },
    {
      id: 'W3',
      length_m: width_m,
      features: opts.door
        ? [{ type: 'door' as const, position_from_start_m: 0.4, width_m: 0.9 }]
        : [],
    },
    { id: 'W4', length_m, features: [] },
  ];
  return {
    id,
    name,
    type,
    dimensions: { width_m, length_m, height_m: 2.7 },
    size_category,
    num_photos_needed: 1,
    walls,
    suggested_cameras: [
      { camera_at_wall_id: 'W3', facing_wall_id: 'W1', description: 'wide angle interior shot from the entrance' },
    ],
  };
}

const rooms: GeometryRoom[] = [
  makeRoom('R1', 'Гостиная', 'living', 3.5, 5.0, { window: true, door: true }),
  makeRoom('R2', 'Спальня', 'bedroom', 3.0, 4.0, { window: true, door: true }),
  makeRoom('R3', 'Ванная', 'bathroom', 1.8, 2.4, { window: false, door: true }),
];

const generalPrefs: GeneralPreferences = {
  style: 'modern',
  budget: 'standard',
  defaultCeilingHeight: 2.7,
  colorPreferences: 'тёплые нейтральные тона, акценты терракотового',
  generalNotes: 'семья с одним ребёнком, нужно место для хранения',
};

const roomPrefs: RoomPreference[] = [
  { roomId: 'R1', inheritFromGeneral: true },
  { roomId: 'R2', inheritFromGeneral: false, styleNotes: 'спокойная спальня', ceilingHeightOverride: 2.7 },
  { roomId: 'R3', inheritFromGeneral: true, specialRequirements: 'тёплый пол, ниша для стиральной машины' },
];

// The frontend maps the English enum to the Russian label before it reaches
// the prompt-builders, so we replicate that mapping here for a realistic test.
const STYLE_RU: Record<GeneralPreferences['style'], string> = {
  modern: 'Современный', scandinavian: 'Скандинавский', classic: 'Классика',
  loft: 'Лофт', minimalist: 'Минимализм', eclectic: 'Эклектика',
};
const BUDGET_RU: Record<GeneralPreferences['budget'], string> = {
  economy: 'Эконом', standard: 'Средний', premium: 'Премиум',
};
const styleRu = STYLE_RU[generalPrefs.style];   // 'Современный'
const budgetRu = BUDGET_RU[generalPrefs.budget]; // 'Средний'

const apartmentGeometry: ApartmentGeometry = {
  is_bti_plan: true,
  apartment: {
    total_area_m2: rooms.reduce((a, r) => a + r.dimensions.width_m * r.dimensions.length_m, 0),
    ceiling_height_m: generalPrefs.defaultCeilingHeight,
    orientation: 'south',
  },
  rooms,
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${YELLOW}INTERA pipeline test — REAL Kimi API${RESET}`);
  console.log(`${DIM}style=${styleRu} budget=${budgetRu} ceiling=${generalPrefs.defaultCeilingHeight}m | rooms=${rooms.length}${RESET}`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.log(`\n${RED}OPENROUTER_API_KEY is NOT set — Kimi calls will throw/fall back.${RESET}`);
    console.log(`${RED}Add it to .env.local to run a real test.${RESET}\n`);
  } else {
    console.log(`${GREEN}OPENROUTER_API_KEY present (len ${process.env.OPENROUTER_API_KEY.length}).${RESET}`);
  }

  // ── Stage 1: per-room furniture plan ─────────────────────────────────────────
  banner('Stage 1 — buildRoomFurniturePlan (per room)');
  for (const room of rooms) {
    try {
      const furniture = await buildRoomFurniturePlan(room);
      console.log(`\n${DIM}${room.name} (${room.type}) → ${furniture.length} items:${RESET}`);
      console.log(JSON.stringify(furniture, null, 2));
      if (furniture.length === 0) fail(`furniture/${room.name}`, 'empty array');
      else pass(`furniture/${room.name}`, `${furniture.length} items`);
    } catch (err) {
      fail(`furniture/${room.name}`, err instanceof Error ? err.message : String(err));
    }
  }

  // ── Stage 2: design brief ───────────────────────────────────────────────────
  banner('Stage 2 — buildDesignBrief');
  try {
    const brief = await buildDesignBrief({
      roomType: 'living_room',
      style: styleRu,
      budget: budgetRu,
      ceilingHeight: generalPrefs.defaultCeilingHeight * 1000, // mm
      apartmentType: '2-комнатная',
      uploadType: 'bti',
      residents: '3',
      hasPets: 'нет',
      needsWorkspace: 'да',
      wishes: `${generalPrefs.colorPreferences}. ${generalPrefs.generalNotes}`,
    });
    console.log(JSON.stringify(brief, null, 2));
    const sd = brief?.sd_prompt ?? '';
    if (!brief || Object.keys(brief).length === 0) fail('designBrief', 'empty object');
    else if (!sd || sd.length < 10) fail('designBrief', 'sd_prompt missing/empty');
    else pass('designBrief', `sd_prompt ${sd.length} chars`);
  } catch (err) {
    fail('designBrief', err instanceof Error ? err.message : String(err));
  }

  // ── Stage 3: wall-aware brief for room_1 ────────────────────────────────────
  banner('Stage 3 — buildWallAwareBrief (Гостиная)');
  try {
    const furniture = await buildRoomFurniturePlan(rooms[0]);
    const { prompt, negativePrompt } = await buildWallAwareBrief({
      room: rooms[0],
      style: styleRu,
      budget: budgetRu,
      wishes: `${generalPrefs.colorPreferences}. потолок ${generalPrefs.defaultCeilingHeight}м`,
      cameraIndex: 0,
      furniture,
    });
    console.log(`\n${DIM}prompt:${RESET}\n${prompt}`);
    console.log(`\n${DIM}negative_prompt:${RESET}\n${negativePrompt}`);

    const lower = prompt.toLowerCase();
    if (!prompt || prompt === '{}' || prompt.length < 20) {
      fail('wallAwareBrief', 'empty / {} prompt');
    } else {
      pass('wallAwareBrief', `${prompt.length} chars`);
      // user-style verification: 'modern' is how the chosen style surfaces in EN
      if (lower.includes('modern')) pass('wallAwareBrief/style', "'modern' present");
      else fail('wallAwareBrief/style', "'modern' NOT found — style may not have reached prompt");
      // ceiling verification: numeric height is abstracted to a ceiling tag
      if (lower.includes('ceiling') || lower.includes('2.7') || lower.includes('потолок')) {
        pass('wallAwareBrief/ceiling', 'ceiling reference present');
      } else {
        fail('wallAwareBrief/ceiling', 'no ceiling reference found');
      }
    }
  } catch (err) {
    fail('wallAwareBrief', err instanceof Error ? err.message : String(err));
  }

  // ── Stage 4: apartment report ───────────────────────────────────────────────
  banner('Stage 4 — buildApartmentReport');
  try {
    const { designerText, reportText } = await buildApartmentReport({
      geometry: apartmentGeometry,
      style: styleRu,
      budget: budgetRu,
      wishes: `${generalPrefs.colorPreferences}. ${generalPrefs.generalNotes}`,
    });
    console.log(`\n${DIM}designerText:${RESET}`);
    console.log(JSON.stringify(designerText, null, 2));
    console.log(`\n${DIM}reportText:${RESET}\n${reportText}`);
    const explanation = designerText?.style_explanation ?? '';
    if (!reportText || reportText.trim().length < 20 || explanation.length === 0) {
      fail('apartmentReport', 'empty / missing fields');
    } else {
      pass('apartmentReport', `report ${reportText.length} chars`);
    }
  } catch (err) {
    fail('apartmentReport', err instanceof Error ? err.message : String(err));
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  banner('Summary');
  console.log(`${GREEN}${passCount} passed${RESET}, ${failCount ? RED : DIM}${failCount} failed${RESET}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
