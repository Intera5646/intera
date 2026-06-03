import sharp from 'sharp';
import { buildScene } from './sceneBuilder';
import type { GeometryRoom, FurnitureObject, Point2D } from './types';
import type { WallOpening } from './sceneBuilder';
import { getRoomPolygonMm } from './polygon';

export interface DepthMapOptions {
  /** Output width in pixels (default 768) */
  width?: number;
  /** Output height in pixels (default 768) */
  height?: number;
  /** Camera FOV in degrees (default 75) */
  fovDeg?: number;
  /** Index into room.suggested_cameras to use (default 0) */
  cameraIndex?: number;
  /** Furniture to render as solid colored boxes in the semantic render */
  furniture?: FurnitureObject[];
}

// ── Semantic color palette ─────────────────────────────────────────────────────
// The control image is a 3D block model in semantic colors. Flux Depth Pro reads
// BOTH the extracted depth (perspective + hybrid shading) AND the semantic hue of
// each surface, so a sofa-colored block becomes a sofa, a white bathtub shape a
// bathtub, a sky-blue rectangle a window, etc.

type RGB = [number, number, number];

const SURFACE_COLORS: Record<'floor' | 'ceiling' | 'wall' | 'window' | 'door', RGB> = {
  floor:   [212, 180, 131], // warm wood
  ceiling: [240, 238, 232], // off-white
  wall:    [225, 220, 210], // warm white
  window:  [135, 200, 235], // sky blue
  door:    [139, 105, 20],  // warm brown wood
};

const FURNITURE_COLORS: Record<string, RGB> = {
  sofa:           [100, 120, 160], // muted blue-grey
  bed:            [160, 175, 200], // light blue
  wardrobe:       [180, 155, 120], // tan wood
  kitchen_run:    [210, 210, 205], // warm white cabinet
  upper_cabinets: [210, 210, 205], // same
  fridge:         [195, 200, 205], // cool light grey
  stove:          [80, 80, 85],    // dark anthracite
  cooktop:        [80, 80, 85],    // alias of stove
  sink_kitchen:   [180, 190, 195], // stainless
  bathtub:        [235, 235, 255], // white porcelain, blue tint
  shower:         [180, 210, 225], // light blue-white
  toilet:         [238, 238, 245], // white ceramic
  vanity_sink:    [220, 225, 240], // white with blue tint
  corner_sink:    [220, 225, 240], // alias of vanity
  console_table:  [175, 148, 118], // warm wood
  tv_unit:        [90, 90, 95],    // dark grey
  coffee_table:   [190, 165, 130], // natural wood
  bistro_table:   [190, 165, 130], // alias of coffee table
  nightstand:     [190, 165, 130], // natural wood
  shelving:       [200, 178, 148], // light wood
  coat_storage:   [180, 155, 120], // alias of wardrobe
};

const FURNITURE_DEFAULT: RGB = [160, 150, 140]; // neutral warm grey
const BACKGROUND: RGB = [0, 0, 0];              // rays that escape the closed box

// Hybrid shading: surface keeps its hue, brightness scales with proximity so the
// render still carries a depth gradient for Flux's internal depth estimator.
const SHADE_MIN = 0.4;

function colorForFurniture(type: string): RGB {
  return FURNITURE_COLORS[type] ?? FURNITURE_DEFAULT;
}

// ── Furniture AABB helpers ─────────────────────────────────────────────────────

interface FurnitureAABB {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  zMin: number; zMax: number;
  color: RGB;
}

/** Convert a FurnitureObject to an axis-aligned bounding box in room coordinates. */
function furnitureToAABB(f: FurnitureObject, W: number, L: number): FurnitureAABB | null {
  // FIX 2: clamp width so furniture can never overflow the wall it's anchored to
  const wallLength = ['W1', 'W3'].includes(f.anchorWallId) ? W : L;
  const wF  = Math.max(0.1, Math.min(wallLength * 0.9, f.widthM));
  const dF  = Math.max(0.1, f.depthM);
  const hF  = Math.max(0.1, f.heightM);
  const pos = Math.max(0, Math.min(0.95, f.positionAlongWall));
  const yLo = f.yOffsetM ?? 0;
  const yHi = yLo + hF;
  const color = colorForFurniture(f.type);

  switch (f.anchorWallId) {
    case 'W1': { // back wall Z = L, runs along X
      const xStart = pos * W;
      return { xMin: xStart, xMax: Math.min(W, xStart + wF), yMin: yLo, yMax: yHi, zMin: Math.max(0, L - dF), zMax: L, color };
    }
    case 'W3': { // front wall Z = 0, runs along X
      const xStart = pos * W;
      return { xMin: xStart, xMax: Math.min(W, xStart + wF), yMin: yLo, yMax: yHi, zMin: 0, zMax: Math.min(L, dF), color };
    }
    case 'W2': { // right wall X = W, runs along Z
      const zStart = pos * L;
      return { xMin: Math.max(0, W - dF), xMax: W, yMin: yLo, yMax: yHi, zMin: zStart, zMax: Math.min(L, zStart + wF), color };
    }
    case 'W4': { // left wall X = 0, runs along Z
      const zStart = pos * L;
      return { xMin: 0, xMax: Math.min(W, dF), yMin: yLo, yMax: yHi, zMin: zStart, zMax: Math.min(L, zStart + wF), color };
    }
    default:
      return null;
  }
}

/**
 * Slab-method ray-AABB intersection.
 * Returns the smallest positive t where the ray enters the box, or Infinity if no hit.
 */
function rayIntersectsAABB(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  box: FurnitureAABB,
): number {
  // Use safe reciprocals so parallel rays produce ±Infinity (handled correctly by min/max)
  const idx = Math.abs(dx) < EPS ? (dx >= 0 ? 1e15 : -1e15) : 1 / dx;
  const idy = Math.abs(dy) < EPS ? (dy >= 0 ? 1e15 : -1e15) : 1 / dy;
  const idz = Math.abs(dz) < EPS ? (dz >= 0 ? 1e15 : -1e15) : 1 / dz;

  const tx1 = (box.xMin - ox) * idx, tx2 = (box.xMax - ox) * idx;
  const ty1 = (box.yMin - oy) * idy, ty2 = (box.yMax - oy) * idy;
  const tz1 = (box.zMin - oz) * idz, tz2 = (box.zMax - oz) * idz;

  const tNear = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
  const tFar  = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));

  if (tFar < 0.001 || tNear > tFar) return Infinity;
  return tNear > 0.001 ? tNear : Infinity;
}

const EPS = 1e-9;

// Returns the opening type at a wall hit point, or null if the hit is solid wall.
// perpAxis=0 means it's an X-wall (W2/W4) → lateral coord is hitZ
// perpAxis=2 means it's a Z-wall (W1/W3) → lateral coord is hitX
function openingTypeAt(
  openings: WallOpening[],
  perpAxis: 0 | 2,
  perpValue: number,
  hitX: number,
  hitY: number,
  hitZ: number,
): 'door' | 'window' | null {
  const lateral = perpAxis === 0 ? hitZ : hitX;
  for (const op of openings) {
    if (op.perpAxis !== perpAxis) continue;
    if (Math.abs(op.perpValue - perpValue) > 0.02) continue;
    if (
      lateral >= op.lateralMin && lateral <= op.lateralMax &&
      hitY   >= op.yMin        && hitY   <= op.yMax
    ) return op.type;
  }
  return null;
}

// Picks the semantic color of a wall hit: window / door opening, or solid wall.
function wallColor(
  openings: WallOpening[],
  perpAxis: 0 | 2,
  perpValue: number,
  hitX: number,
  hitY: number,
  hitZ: number,
): RGB {
  const op = openingTypeAt(openings, perpAxis, perpValue, hitX, hitY, hitZ);
  if (op === 'window') return SURFACE_COLORS.window;
  if (op === 'door')   return SURFACE_COLORS.door;
  return SURFACE_COLORS.wall;
}

// Signed intersection of a ray with an axis-aligned plane.
// Returns the ray parameter t, or Infinity if the ray is parallel or hits behind origin.
function planeT(
  ro: number,  // ray origin component on that axis
  rd: number,  // ray direction component on that axis
  val: number, // plane position on that axis
): number {
  if (Math.abs(rd) < EPS) return Infinity;
  const t = (val - ro) / rd;
  return t > 0.001 ? t : Infinity;
}

/**
 * Render a colored semantic 3D block model of the room from the chosen camera.
 * Output: RGB PNG where each surface carries its semantic hue, shaded by depth.
 */
export async function generateSemanticRenderBuffer(
  room: GeometryRoom,
  options?: DepthMapOptions,
): Promise<Buffer> {
  const imgW     = options?.width       ?? 768;
  const imgH     = options?.height      ?? 768;
  const fovRad   = ((options?.fovDeg ?? 75) * Math.PI) / 180;
  const camIndex = options?.cameraIndex ?? 0;

  const scene = buildScene(room, camIndex);
  const { width_m: W, length_m: L, height_m: H, camera: cam, openings } = scene;

  // Pre-compute furniture AABBs (with their colors) once, outside the pixel loop
  const furnitureBoxes: FurnitureAABB[] = (options?.furniture ?? [])
    .map(f => furnitureToAABB(f, W, L))
    .filter((b): b is FurnitureAABB => b !== null);

  // Normalisation: distances beyond this are fully shaded toward dark
  const maxDist = Math.sqrt(W * W + H * H + L * L) * 1.1;

  const aspect      = imgW / imgH;
  const tanHalfFov  = Math.tan(fovRad / 2);

  // RGB raw pixel buffer (3 bytes per pixel)
  const rawBuf = Buffer.allocUnsafe(imgW * imgH * 3);

  for (let py = 0; py < imgH; py++) {
    for (let px = 0; px < imgW; px++) {
      // Pixel → normalised device coords
      const ndcX = ((px + 0.5) / imgW * 2 - 1) * aspect * tanHalfFov;
      const ndcY = (1 - (py + 0.5) / imgH * 2) * tanHalfFov;

      // Ray direction: forward + ndcX * right + ndcY * worldUp
      // worldUp is always (0, 1, 0), cam.r(x|y|z) is the horizontal right vector
      const rdx = cam.fx + ndcX * cam.rx;
      const rdy = cam.fy + ndcY;           // worldUp.y = 1
      const rdz = cam.fz + ndcX * cam.rz;
      const rlen = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
      const dx = rdx / rlen;
      const dy = rdy / rlen;
      const dz = rdz / rlen;

      const ox = cam.x, oy = cam.y, oz = cam.z;
      let minT = Infinity;
      let cr = BACKGROUND[0], cg = BACKGROUND[1], cb = BACKGROUND[2];

      // ── Floor  (y = 0) ────────────────────────────────────────────────────
      {
        const t = planeT(oy, dy, 0);
        if (t < minT) {
          const hx = ox + dx * t, hz = oz + dz * t;
          if (hx >= 0 && hx <= W && hz >= 0 && hz <= L) {
            minT = t; cr = SURFACE_COLORS.floor[0]; cg = SURFACE_COLORS.floor[1]; cb = SURFACE_COLORS.floor[2];
          }
        }
      }

      // ── Ceiling  (y = H) ──────────────────────────────────────────────────
      {
        const t = planeT(oy, dy, H);
        if (t < minT) {
          const hx = ox + dx * t, hz = oz + dz * t;
          if (hx >= 0 && hx <= W && hz >= 0 && hz <= L) {
            minT = t; cr = SURFACE_COLORS.ceiling[0]; cg = SURFACE_COLORS.ceiling[1]; cb = SURFACE_COLORS.ceiling[2];
          }
        }
      }

      // ── Front wall  (z = 0, W3) ───────────────────────────────────────────
      {
        const t = planeT(oz, dz, 0);
        if (t < minT) {
          const hx = ox + dx * t, hy = oy + dy * t;
          if (hx >= 0 && hx <= W && hy >= 0 && hy <= H) {
            minT = t;
            const c = wallColor(openings, 2, 0, hx, hy, 0); cr = c[0]; cg = c[1]; cb = c[2];
          }
        }
      }

      // ── Back wall  (z = L, W1) ────────────────────────────────────────────
      {
        const t = planeT(oz, dz, L);
        if (t < minT) {
          const hx = ox + dx * t, hy = oy + dy * t;
          if (hx >= 0 && hx <= W && hy >= 0 && hy <= H) {
            minT = t;
            const c = wallColor(openings, 2, L, hx, hy, L); cr = c[0]; cg = c[1]; cb = c[2];
          }
        }
      }

      // ── Left wall  (x = 0, W4) ────────────────────────────────────────────
      {
        const t = planeT(ox, dx, 0);
        if (t < minT) {
          const hy = oy + dy * t, hz = oz + dz * t;
          if (hz >= 0 && hz <= L && hy >= 0 && hy <= H) {
            minT = t;
            const c = wallColor(openings, 0, 0, 0, hy, hz); cr = c[0]; cg = c[1]; cb = c[2];
          }
        }
      }

      // ── Right wall  (x = W, W2) ───────────────────────────────────────────
      {
        const t = planeT(ox, dx, W);
        if (t < minT) {
          const hy = oy + dy * t, hz = oz + dz * t;
          if (hz >= 0 && hz <= L && hy >= 0 && hy <= H) {
            minT = t;
            const c = wallColor(openings, 0, W, W, hy, hz); cr = c[0]; cg = c[1]; cb = c[2];
          }
        }
      }

      // ── Furniture boxes  (nearest AABB wins) ──────────────────────────────
      for (let fi = 0; fi < furnitureBoxes.length; fi++) {
        const box = furnitureBoxes[fi];
        const t = rayIntersectsAABB(ox, oy, oz, dx, dy, dz, box);
        if (t < minT) {
          minT = t; cr = box.color[0]; cg = box.color[1]; cb = box.color[2];
        }
      }

      // ── Hybrid shading: semantic hue × depth-driven brightness ─────────────
      const i = (py * imgW + px) * 3;
      if (minT === Infinity) {
        rawBuf[i] = BACKGROUND[0]; rawBuf[i + 1] = BACKGROUND[1]; rawBuf[i + 2] = BACKGROUND[2];
      } else {
        const depthFactor = Math.max(0, Math.min(1, 1 - minT / maxDist));
        const shade = SHADE_MIN + (1 - SHADE_MIN) * depthFactor;
        rawBuf[i]     = Math.round(cr * shade);
        rawBuf[i + 1] = Math.round(cg * shade);
        rawBuf[i + 2] = Math.round(cb * shade);
      }
    }
  }

  return sharp(rawBuf, { raw: { width: imgW, height: imgH, channels: 3 } })
    .png()
    .toBuffer();
}

// Backward-compatible alias — earlier pipeline code imports generateDepthMapBuffer.
export const generateDepthMapBuffer = generateSemanticRenderBuffer;

// ── Shared inner raycaster ─────────────────────────────────────────────────────
// Returns the nearest intersection distance (t) for a single ray against all
// room surfaces + furniture. Used by both depth and lineart generators.

/**
 * A wall segment in the XZ plane (vertical extruded from y=0 to y=H).
 * (x1,z1) → (x2,z2) in metres.
 */
type WallSegment = readonly [number, number, number, number];

/**
 * Ray-segment intersection in the XZ plane, returns the ray parameter t
 * at which the ray (origin (ox,oz), direction (dx,dz)) crosses the segment
 * (x1,z1)→(x2,z2). The y-coordinate at the hit must lie in [0, H] for a
 * vertical wall hit. Returns Infinity if no valid hit.
 */
function segmentRayHit(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  x1: number, z1: number, x2: number, z2: number,
  H: number,
): number {
  const sx = x2 - x1;
  const sz = z2 - z1;
  const det = sx * dz - sz * dx;
  if (Math.abs(det) < EPS) return Infinity; // ray parallel to wall

  const t = ((x1 - ox) * sz - (z1 - oz) * sx) / -det;
  if (t < 0.001) return Infinity;

  const u = (dx * (z1 - oz) - dz * (x1 - ox)) / -det;
  if (u < -1e-6 || u > 1 + 1e-6) return Infinity; // beyond segment endpoints

  const hy = oy + dy * t;
  if (hy < -1e-6 || hy > H + 1e-6) return Infinity;

  return t;
}

/**
 * Build polygon wall segments and outline (in metres) for a room.
 * Returns null when the room is a rectangle — caller uses the fast axis-aligned path.
 */
interface PolygonScene {
  /** Wall segments (x1,z1,x2,z2) in metres */
  walls: WallSegment[];
  /** Outline vertices (x_m, z_m) for point-in-polygon test on floor/ceiling */
  outlineXZ: Array<{ x: number; z: number }>;
}

function buildPolygonScene(room: GeometryRoom): PolygonScene | null {
  if (room.shape?.kind !== 'polygon') return null;
  const pts: Point2D[] = getRoomPolygonMm(room);
  if (pts.length < 3) return null;

  // Map polygon's (x_mm, y_mm) into room-space (x_m, z_m).
  // The polygon's y_mm axis runs from top of bounding box downward,
  // matching the room's Z axis from 0 (front/W3) → length_m (back/W1).
  const outlineXZ = pts.map(p => ({ x: p.x_mm / 1000, z: p.y_mm / 1000 }));
  const walls: WallSegment[] = [];
  for (let i = 0; i < outlineXZ.length; i++) {
    const a = outlineXZ[i];
    const b = outlineXZ[(i + 1) % outlineXZ.length];
    walls.push([a.x, a.z, b.x, b.z]);
  }
  return { walls, outlineXZ };
}

/** Point-in-polygon test in metres (XZ plane). Ray-casting algorithm. */
function pointInPolygonXZ(x: number, z: number, outline: Array<{ x: number; z: number }>): boolean {
  if (outline.length < 3) return false;
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const xi = outline[i].x, zi = outline[i].z;
    const xj = outline[j].x, zj = outline[j].z;
    const intersects =
      (zi > z) !== (zj > z) &&
      x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function castRay(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  W: number, L: number, H: number,
  furnitureBoxes: FurnitureAABB[],
  fallback: number,
  polyScene: PolygonScene | null = null,
  openings: WallOpening[] = [],
): number {
  let minT = fallback;

  if (polyScene) {
    // Polygon path: N wall segments + floor/ceiling clipped to polygon outline.
    // Opening checks not applied to polygon walls (arbitrary angles) — openings are
    // sparse enough that skipping them here is a minor approximation.
    for (const [x1, z1, x2, z2] of polyScene.walls) {
      const t = segmentRayHit(ox, oy, oz, dx, dy, dz, x1, z1, x2, z2, H);
      if (t < minT) minT = t;
    }
    {
      const t = planeT(oy, dy, 0);
      if (t < minT) {
        const hx = ox + dx * t, hz = oz + dz * t;
        if (pointInPolygonXZ(hx, hz, polyScene.outlineXZ)) minT = t;
      }
    }
    {
      const t = planeT(oy, dy, H);
      if (t < minT) {
        const hx = ox + dx * t, hz = oz + dz * t;
        if (pointInPolygonXZ(hx, hz, polyScene.outlineXZ)) minT = t;
      }
    }
  } else {
    // Rectangle path: axis-aligned plane intersections.
    // Wall hits that fall inside a window or door opening are skipped so the ray
    // passes through → Infinity (sky/exterior) in the depth map, matching the
    // semantic render where openings are colored as sky blue / transparent.
    { const t = planeT(oy, dy, 0); if (t < minT) { const hx=ox+dx*t,hz=oz+dz*t; if (hx>=0&&hx<=W&&hz>=0&&hz<=L) minT=t; } }
    { const t = planeT(oy, dy, H); if (t < minT) { const hx=ox+dx*t,hz=oz+dz*t; if (hx>=0&&hx<=W&&hz>=0&&hz<=L) minT=t; } }
    { const t = planeT(oz, dz, 0); if (t < minT) { const hx=ox+dx*t,hy=oy+dy*t; if (hx>=0&&hx<=W&&hy>=0&&hy<=H&&!openingTypeAt(openings,2,0,hx,hy,0)) minT=t; } }
    { const t = planeT(oz, dz, L); if (t < minT) { const hx=ox+dx*t,hy=oy+dy*t; if (hx>=0&&hx<=W&&hy>=0&&hy<=H&&!openingTypeAt(openings,2,L,hx,hy,L)) minT=t; } }
    { const t = planeT(ox, dx, 0); if (t < minT) { const hy=oy+dy*t,hz=oz+dz*t; if (hz>=0&&hz<=L&&hy>=0&&hy<=H&&!openingTypeAt(openings,0,0,0,hy,hz)) minT=t; } }
    { const t = planeT(ox, dx, W); if (t < minT) { const hy=oy+dy*t,hz=oz+dz*t; if (hz>=0&&hz<=L&&hy>=0&&hy<=H&&!openingTypeAt(openings,0,W,W,hy,hz)) minT=t; } }
  }

  for (const box of furnitureBoxes) {
    const t = rayIntersectsAABB(ox, oy, oz, dx, dy, dz, box);
    if (t < minT) minT = t;
  }
  return minT;
}

function makeRayDir(
  px: number, py: number,
  imgW: number, imgH: number,
  aspect: number, tanHalf: number,
  cam: { fx: number; fy: number; fz: number; rx: number; ry: number; rz: number },
): [number, number, number] {
  const ndcX = ((px + 0.5) / imgW * 2 - 1) * aspect * tanHalf;
  const ndcY = (1 - (py + 0.5) / imgH * 2) * tanHalf;
  const rdx  = cam.fx + ndcX * cam.rx;
  const rdy  = cam.fy + ndcY;
  const rdz  = cam.fz + ndcX * cam.rz;
  const rlen = Math.sqrt(rdx*rdx + rdy*rdy + rdz*rdz);
  return [rdx/rlen, rdy/rlen, rdz/rlen];
}

/**
 * Pure grayscale depth map: white (255) = nearest surface, black (0) = farthest / sky.
 * Used as the depth ControlNet conditioning image for SDXL multi-controlnet.
 */
export async function generateDepthBuffer(
  room: GeometryRoom,
  options?: DepthMapOptions,
): Promise<Buffer> {
  const imgW     = options?.width       ?? 768;
  const imgH     = options?.height      ?? 768;
  const fovRad   = ((options?.fovDeg ?? 75) * Math.PI) / 180;
  const camIndex = options?.cameraIndex ?? 0;

  const scene = buildScene(room, camIndex);
  const { width_m: W, length_m: L, height_m: H, camera: cam, openings } = scene;
  const polyScene = buildPolygonScene(room);
  console.log(`[depth-map] ${room.name}: camera=${JSON.stringify({x:cam.x.toFixed(2),z:cam.z.toFixed(2)})}, openings=${openings.length}`);

  const furnitureBoxes: FurnitureAABB[] = (options?.furniture ?? [])
    .map(f => furnitureToAABB(f, W, L))
    .filter((b): b is FurnitureAABB => b !== null);

  const maxDist = Math.sqrt(W*W + H*H + L*L) * 1.1;
  const aspect  = imgW / imgH;
  const tanHalf = Math.tan(fovRad / 2);

  const rawBuf = Buffer.allocUnsafe(imgW * imgH);

  for (let py = 0; py < imgH; py++) {
    for (let px = 0; px < imgW; px++) {
      const [dx, dy, dz] = makeRayDir(px, py, imgW, imgH, aspect, tanHalf, cam);
      const t = castRay(cam.x, cam.y, cam.z, dx, dy, dz, W, L, H, furnitureBoxes, Infinity, polyScene, openings);
      rawBuf[py * imgW + px] =
        t === Infinity ? 0 : Math.round(255 * Math.max(0, 1 - t / maxDist));
    }
  }

  return sharp(rawBuf, { raw: { width: imgW, height: imgH, channels: 1 } })
    .png()
    .toBuffer();
}

/**
 * Edge-detected lineart map: white background, black lines at depth discontinuities.
 * Uses Sobel on a normalised depth buffer. Used as the lineart ControlNet conditioning
 * image for SDXL multi-controlnet alongside the grayscale depth map.
 */
export async function generateLineartBuffer(
  room: GeometryRoom,
  options?: DepthMapOptions,
): Promise<Buffer> {
  const imgW     = options?.width       ?? 768;
  const imgH     = options?.height      ?? 768;
  const fovRad   = ((options?.fovDeg ?? 75) * Math.PI) / 180;
  const camIndex = options?.cameraIndex ?? 0;

  const scene = buildScene(room, camIndex);
  const { width_m: W, length_m: L, height_m: H, camera: cam, openings } = scene;
  const polyScene = buildPolygonScene(room);

  const furnitureBoxes: FurnitureAABB[] = (options?.furniture ?? [])
    .map(f => furnitureToAABB(f, W, L))
    .filter((b): b is FurnitureAABB => b !== null);

  const maxDist = Math.sqrt(W*W + H*H + L*L) * 1.1;
  const aspect  = imgW / imgH;
  const tanHalf = Math.tan(fovRad / 2);

  // Pass 1: depth values normalised 0 (near) → 1 (far/sky)
  const depth = new Float32Array(imgW * imgH);
  for (let py = 0; py < imgH; py++) {
    for (let px = 0; px < imgW; px++) {
      const [dx, dy, dz] = makeRayDir(px, py, imgW, imgH, aspect, tanHalf, cam);
      const t = castRay(cam.x, cam.y, cam.z, dx, dy, dz, W, L, H, furnitureBoxes, Infinity, polyScene, openings);
      depth[py * imgW + px] = t === Infinity ? 1.0 : Math.min(1, t / maxDist);
    }
  }

  // Pass 2: Sobel edge detection → black edges on white background
  const rawBuf = Buffer.allocUnsafe(imgW * imgH);
  const EDGE_THRESHOLD = 0.08; // Sobel magnitude threshold (0–4 range for unit depth)

  for (let py = 0; py < imgH; py++) {
    for (let px = 0; px < imgW; px++) {
      const i = py * imgW + px;
      if (px === 0 || px === imgW-1 || py === 0 || py === imgH-1) {
        rawBuf[i] = 255;
        continue;
      }
      const gx =
        -depth[(py-1)*imgW+(px-1)] + depth[(py-1)*imgW+(px+1)]
        -2*depth[py*imgW+(px-1)]   + 2*depth[py*imgW+(px+1)]
        -depth[(py+1)*imgW+(px-1)] + depth[(py+1)*imgW+(px+1)];
      const gy =
        -depth[(py-1)*imgW+(px-1)] - 2*depth[(py-1)*imgW+px] - depth[(py-1)*imgW+(px+1)]
        +depth[(py+1)*imgW+(px-1)] + 2*depth[(py+1)*imgW+px] + depth[(py+1)*imgW+(px+1)];
      rawBuf[i] = Math.sqrt(gx*gx + gy*gy) > EDGE_THRESHOLD ? 0 : 255;
    }
  }

  return sharp(rawBuf, { raw: { width: imgW, height: imgH, channels: 1 } })
    .png()
    .toBuffer();
}
