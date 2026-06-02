import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';
import type { GeometryRoom, FurnitureItem } from '../../../lib/geometry/types';
import { pointInPolygon } from '../../../lib/geometry/polygon';

export async function POST(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let room: GeometryRoom;
  let style: string;
  let budget: string;

  try {
    const body = await req.json() as { room: GeometryRoom; style?: string; budget?: string };
    room = body.room;
    style = String(body.style ?? 'Современный');
    budget = String(body.budget ?? 'Средний');
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ furniture: [] });
  }

  const width_mm = Math.round(room.dimensions.width_m * 1000);
  const length_mm = Math.round(room.dimensions.length_m * 1000);
  const ceiling_m = room.dimensions.height_m ?? 2.7;
  const isPolygon = room.shape?.kind === 'polygon';

  const wallsJson = JSON.stringify(
    room.walls.map(w => ({
      id: w.id,
      length_m: w.length_m,
      features: w.features.map(f => ({
        type: f.type,
        position_from_start_m: f.position_from_start_m,
        width_m: f.width_m,
      })),
    }))
  );

  // Polygon outline description for Kimi when shape is non-rectangular
  const polygonNote = isPolygon && room.shape?.kind === 'polygon'
    ? `\nThis room is NOT a simple rectangle. Its outline (polygon) is:\n` +
      room.shape.points.map(p => `  (${Math.round(p.x_mm)}, ${Math.round(p.y_mm)})`).join('\n') +
      `\n\nAll furniture must be placed within this outline. Do NOT place furniture\n` +
      `in cutout regions (areas outside the polygon). Walking paths and clearances\n` +
      `apply to the actual outline shape, not the bounding box.\n`
    : '';

  const userPrompt =
    `You are a professional interior designer placing furniture.\n\n` +
    `Room: ${room.name}\n` +
    `Type: ${room.type}\n` +
    `Bounding box: ${room.dimensions.width_m}m × ${room.dimensions.length_m}m\n` +
    `Ceiling: ${ceiling_m}m\n` +
    `Style: ${style}\n` +
    `Budget: ${budget}\n` +
    `Walls: ${wallsJson}` +
    polygonNote +
    `\n\nReturn ONLY a valid JSON array, no explanation, no markdown:\n` +
    `[\n` +
    `  {\n` +
    `    "name": "Диван",\n` +
    `    "x_mm": 200,\n` +
    `    "y_mm": 300,\n` +
    `    "width_mm": 2200,\n` +
    `    "depth_mm": 900,\n` +
    `    "rotation": 0,\n` +
    `    "color": "#D4B896"\n` +
    `  }\n` +
    `]\n\n` +
    `Design rules you must follow:\n` +
    `- Minimum 800mm walking clearance on all paths\n` +
    `- Bed: away from windows, not under AC\n` +
    `- Sofa: facing main wall or TV wall, not blocking door\n` +
    `- Kitchen table: near window if possible\n` +
    `- Toilet/shower: 400mm clearance\n` +
    `- All coordinates from top-left corner of room\n` +
    `- Items must stay within room bounds: max x = ${width_mm}, max y = ${length_mm}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'INTERA',
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2.6',
        reasoning: { enabled: false },
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    // Read as text first — OpenRouter may return a plain-text error body
    // (e.g. "Host not in allowlist") which makes res.json() throw.
    const bodyText = await res.text();
    let data: { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; error?: { message: string } };
    try {
      data = JSON.parse(bodyText) as typeof data;
    } catch {
      console.warn('[furniture-plan] Non-JSON response from OpenRouter for', room.name, ':', bodyText.slice(0, 200));
      return NextResponse.json({ furniture: [] });
    }

    // Kimi K2.6 may return its output in reasoning_content with content empty
    const raw = data.choices?.[0]?.message?.content
      || data.choices?.[0]?.message?.reasoning_content
      || '';
    console.log('[furniture-plan] raw response for', room.name, ':', raw.slice(0, 400));

    // Extract JSON array from response (model may wrap in prose)
    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket <= firstBracket) {
      console.warn('[furniture-plan] No JSON array in response for room:', room.name);
      return NextResponse.json({ furniture: [] });
    }

    const parsed = JSON.parse(raw.slice(firstBracket, lastBracket + 1)) as unknown[];

    const furniture: FurnitureItem[] = parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map(item => ({
        name: String(item.name ?? ''),
        x_mm: Math.max(0, Number(item.x_mm ?? 0)),
        y_mm: Math.max(0, Number(item.y_mm ?? 0)),
        width_mm: Math.max(100, Number(item.width_mm ?? 500)),
        depth_mm: Math.max(100, Number(item.depth_mm ?? 400)),
        rotation: ([0, 90, 180, 270].includes(Number(item.rotation))
          ? Number(item.rotation) : 0) as FurnitureItem['rotation'],
        color: String(item.color ?? '#C8B89A'),
      }))
      .filter(item => item.name.length > 0);

    // Polygon filter: drop items whose center lies outside the room outline.
    let finalFurniture = furniture;
    if (room.shape?.kind === 'polygon') {
      const polygon = room.shape.points;
      const before = finalFurniture.length;
      finalFurniture = finalFurniture.filter(item => {
        const cx = item.x_mm + item.width_mm / 2;
        const cy = item.y_mm + item.depth_mm / 2;
        return pointInPolygon(cx, cy, polygon);
      });
      const dropped = before - finalFurniture.length;
      if (dropped > 0) {
        console.log(`[furniture-plan] Polygon filter for ${room.name}: dropped ${dropped} item(s) outside outline`);
      }
    }

    return NextResponse.json({ furniture: finalFurniture });
  } catch (err) {
    console.error('[furniture-plan] Error for room', room.name, ':', err instanceof Error ? err.message : err);
    return NextResponse.json({ furniture: [] });
  }
}
