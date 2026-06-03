import type { GeometryRoom } from './types';

export interface WallOpening {
  /** perpendicular axis of the wall plane: 0 = X-axis wall (W2/W4), 2 = Z-axis wall (W1/W3) */
  perpAxis: 0 | 2;
  /** coordinate on perpAxis where the wall sits */
  perpValue: number;
  /** min/max on the lateral horizontal axis (X for Z-walls, Z for X-walls) */
  lateralMin: number;
  lateralMax: number;
  /** vertical extent */
  yMin: number;
  yMax: number;
  /** feature kind — drives semantic color (window=sky blue, door=brown) */
  type: 'door' | 'window';
}

export interface RoomCamera {
  x: number; y: number; z: number;
  /** unit forward vector */
  fx: number; fy: number; fz: number;
  /** unit right vector (horizontal, perpendicular to forward) */
  rx: number; ry: number; rz: number;
}

export interface RoomScene {
  width_m: number;
  length_m: number;
  height_m: number;
  camera: RoomCamera;
  openings: WallOpening[];
}

// Distance camera is placed from its backing wall (metres)
const INSET_M = 0.35;
// Reduced inset for rooms smaller than 4 m² (balcony, wc, etc.)
const INSET_SMALL = 0.15;

// Room coordinate system:
//   X ∈ [0, width_m]   — left to right (when looking at back wall)
//   Y ∈ [0, height_m]  — floor to ceiling
//   Z ∈ [0, length_m]  — front (near) to back
//
// Wall IDs (clockwise from feature/window wall):
//   W1 = back wall  (Z = length_m) — usually has windows
//   W2 = right wall (X = width_m)
//   W3 = front wall (Z = 0)        — default camera position
//   W4 = left wall  (X = 0)

function cameraAtWall(id: string, W: number, L: number, eyeY: number, inset: number): RoomCamera {
  switch (id) {
    case 'W1': // back wall → look toward front (-Z)
      return { x: W / 2, y: eyeY, z: L - inset, fx: 0, fy: 0, fz: -1, rx: -1, ry: 0, rz: 0 };
    case 'W2': // right wall → look toward left (-X)
      return { x: W - inset, y: eyeY, z: L / 2, fx: -1, fy: 0, fz: 0, rx: 0, ry: 0, rz: 1 };
    case 'W4': // left wall → look toward right (+X)
      return { x: inset, y: eyeY, z: L / 2, fx: 1, fy: 0, fz: 0, rx: 0, ry: 0, rz: -1 };
    case 'W3': // front wall → look toward back (+Z)  — default
    default:
      return { x: W / 2, y: eyeY, z: inset, fx: 0, fy: 0, fz: 1, rx: 1, ry: 0, rz: 0 };
  }
}

function extractOpenings(room: GeometryRoom): WallOpening[] {
  const { width_m: W, length_m: L, height_m: H } = room.dimensions;

  const wallDefs: Record<string, { perpAxis: 0 | 2; perpValue: number; lateralMax: number }> = {
    W1: { perpAxis: 2, perpValue: L, lateralMax: W },
    W2: { perpAxis: 0, perpValue: W, lateralMax: L },
    W3: { perpAxis: 2, perpValue: 0, lateralMax: W },
    W4: { perpAxis: 0, perpValue: 0, lateralMax: L },
  };

  const openings: WallOpening[] = [];

  for (const wall of room.walls) {
    const def = wallDefs[wall.id];
    if (!def) continue;

    for (const feat of wall.features) {
      const isDoor = feat.type === 'door';
      const yMin = isDoor ? 0 : 0.9;
      const yMax = isDoor ? 2.1 : Math.min(2.1, H - 0.1);
      const latMin = Math.max(0, feat.position_from_start_m);
      const latMax = Math.min(def.lateralMax, feat.position_from_start_m + feat.width_m);
      if (latMax <= latMin || yMax <= yMin) continue;

      openings.push({
        perpAxis:   def.perpAxis,
        perpValue:  def.perpValue,
        lateralMin: latMin,
        lateralMax: latMax,
        yMin,
        yMax,
        type:       feat.type,
      });
    }
  }

  return openings;
}

const OPPOSITE_WALL: Record<string, string> = { W1: 'W3', W3: 'W1', W2: 'W4', W4: 'W2' };

export function buildScene(room: GeometryRoom, cameraIndex = 0): RoomScene {
  const { width_m: W, length_m: L, height_m: H } = room.dimensions;
  const eyeY = Math.min(1.6, H * 0.6);
  const area = W * L;
  const inset = area < 4 ? INSET_SMALL : INSET_M;

  // Find the wall with the most total window width → camera goes on OPPOSITE wall
  let maxWindowM = 0;
  let lightWallId: string | null = null;
  for (const wall of room.walls) {
    const totalW = wall.features
      .filter(f => f.type === 'window')
      .reduce((sum, f) => sum + f.width_m, 0);
    if (totalW > maxWindowM) {
      maxWindowM = totalW;
      lightWallId = wall.id;
    }
  }

  let wallId: string;
  if (lightWallId && maxWindowM > 0) {
    wallId = OPPOSITE_WALL[lightWallId] ?? (room.suggested_cameras[cameraIndex]?.camera_at_wall_id ?? 'W3');
    console.log(`[3d-model] ${room.name}: light wall ${lightWallId} (${maxWindowM.toFixed(1)}m windows) → camera on ${wallId}`);
  } else {
    const camSuggestion = room.suggested_cameras[cameraIndex] ?? room.suggested_cameras[0];
    wallId = camSuggestion?.camera_at_wall_id ?? 'W3';
  }

  return {
    width_m:  W,
    length_m: L,
    height_m: H,
    camera:   cameraAtWall(wallId, W, L, eyeY, inset),
    openings: extractOpenings(room),
  };
}
