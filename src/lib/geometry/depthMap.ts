import sharp from 'sharp';
import { buildScene } from './sceneBuilder';
import type { GeometryRoom, FurnitureObject } from './types';
import type { WallOpening } from './sceneBuilder';

export interface DepthMapOptions {
  /** Output width in pixels (default 512) */
  width?: number;
  /** Output height in pixels (default 512) */
  height?: number;
  /** Camera FOV in degrees (default 75) */
  fovDeg?: number;
  /** Index into room.suggested_cameras to use (default 0) */
  cameraIndex?: number;
  /** Furniture to render as solid boxes in the depth map */
  furniture?: FurnitureObject[];
}

// ── Furniture AABB helpers ─────────────────────────────────────────────────────

interface FurnitureAABB {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  zMin: number; zMax: number;
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

  switch (f.anchorWallId) {
    case 'W1': { // back wall Z = L, runs along X
      const xStart = pos * W;
      return { xMin: xStart, xMax: Math.min(W, xStart + wF), yMin: yLo, yMax: yHi, zMin: Math.max(0, L - dF), zMax: L };
    }
    case 'W3': { // front wall Z = 0, runs along X
      const xStart = pos * W;
      return { xMin: xStart, xMax: Math.min(W, xStart + wF), yMin: yLo, yMax: yHi, zMin: 0, zMax: Math.min(L, dF) };
    }
    case 'W2': { // right wall X = W, runs along Z
      const zStart = pos * L;
      return { xMin: Math.max(0, W - dF), xMax: W, yMin: yLo, yMax: yHi, zMin: zStart, zMax: Math.min(L, zStart + wF) };
    }
    case 'W4': { // left wall X = 0, runs along Z
      const zStart = pos * L;
      return { xMin: 0, xMax: Math.min(W, dF), yMin: yLo, yMax: yHi, zMin: zStart, zMax: Math.min(L, zStart + wF) };
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

// Returns true when a ray hit on a wall plane falls inside a door/window opening.
// perpAxis=0 means it's an X-wall (W2/W4) → lateral coord is hitZ
// perpAxis=2 means it's a Z-wall (W1/W3) → lateral coord is hitX
function inOpening(
  openings: WallOpening[],
  perpAxis: 0 | 2,
  perpValue: number,
  hitX: number,
  hitY: number,
  hitZ: number,
): boolean {
  const lateral = perpAxis === 0 ? hitZ : hitX;
  for (const op of openings) {
    if (op.perpAxis !== perpAxis) continue;
    if (Math.abs(op.perpValue - perpValue) > 0.02) continue;
    if (
      lateral >= op.lateralMin && lateral <= op.lateralMax &&
      hitY   >= op.yMin        && hitY   <= op.yMax
    ) return true;
  }
  return false;
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

export async function generateDepthMapBuffer(
  room: GeometryRoom,
  options?: DepthMapOptions,
): Promise<Buffer> {
  const imgW     = options?.width       ?? 512;
  const imgH     = options?.height      ?? 512;
  const fovRad   = ((options?.fovDeg ?? 75) * Math.PI) / 180;
  const camIndex = options?.cameraIndex ?? 0;

  const scene = buildScene(room, camIndex);
  const { width_m: W, length_m: L, height_m: H, camera: cam, openings } = scene;

  // Pre-compute furniture AABBs once (outside the pixel loop)
  const furnitureBoxes: FurnitureAABB[] = (options?.furniture ?? [])
    .map(f => furnitureToAABB(f, W, L))
    .filter((b): b is FurnitureAABB => b !== null);

  // Normalisation: distances beyond this map to 0 (black / far)
  const maxDist = Math.sqrt(W * W + H * H + L * L) * 1.1;

  const aspect      = imgW / imgH;
  const tanHalfFov  = Math.tan(fovRad / 2);

  // RGBA raw pixel buffer (4 bytes per pixel)
  const rawBuf = Buffer.allocUnsafe(imgW * imgH * 4);

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

      // ── Floor  (y = 0) ────────────────────────────────────────────────────
      {
        const t = planeT(oy, dy, 0);
        if (t < minT) {
          const hx = ox + dx * t, hz = oz + dz * t;
          if (hx >= 0 && hx <= W && hz >= 0 && hz <= L) minT = t;
        }
      }

      // ── Ceiling  (y = H) ──────────────────────────────────────────────────
      {
        const t = planeT(oy, dy, H);
        if (t < minT) {
          const hx = ox + dx * t, hz = oz + dz * t;
          if (hx >= 0 && hx <= W && hz >= 0 && hz <= L) minT = t;
        }
      }

      // ── Front wall  (z = 0, W3) ───────────────────────────────────────────
      {
        const t = planeT(oz, dz, 0);
        if (t < minT) {
          const hx = ox + dx * t, hy = oy + dy * t;
          if (hx >= 0 && hx <= W && hy >= 0 && hy <= H) {
            if (!inOpening(openings, 2, 0, hx, hy, 0)) minT = t;
          }
        }
      }

      // ── Back wall  (z = L, W1) ────────────────────────────────────────────
      {
        const t = planeT(oz, dz, L);
        if (t < minT) {
          const hx = ox + dx * t, hy = oy + dy * t;
          if (hx >= 0 && hx <= W && hy >= 0 && hy <= H) {
            if (!inOpening(openings, 2, L, hx, hy, L)) minT = t;
          }
        }
      }

      // ── Left wall  (x = 0, W4) ────────────────────────────────────────────
      {
        const t = planeT(ox, dx, 0);
        if (t < minT) {
          const hy = oy + dy * t, hz = oz + dz * t;
          if (hz >= 0 && hz <= L && hy >= 0 && hy <= H) {
            if (!inOpening(openings, 0, 0, 0, hy, hz)) minT = t;
          }
        }
      }

      // ── Right wall  (x = W, W2) ───────────────────────────────────────────
      {
        const t = planeT(ox, dx, W);
        if (t < minT) {
          const hy = oy + dy * t, hz = oz + dz * t;
          if (hz >= 0 && hz <= L && hy >= 0 && hy <= H) {
            if (!inOpening(openings, 0, W, W, hy, hz)) minT = t;
          }
        }
      }

      // ── Furniture boxes  (nearest AABB wins) ──────────────────────────────
      for (let fi = 0; fi < furnitureBoxes.length; fi++) {
        const t = rayIntersectsAABB(ox, oy, oz, dx, dy, dz, furnitureBoxes[fi]);
        if (t < minT) minT = t;
      }

      // ── Depth → luminance  (near=bright, far=dark) ────────────────────────
      const lum =
        minT === Infinity
          ? 0
          : Math.round(Math.max(0, Math.min(1, 1 - minT / maxDist)) * 255);

      const i = (py * imgW + px) * 4;
      rawBuf[i]     = lum;
      rawBuf[i + 1] = lum;
      rawBuf[i + 2] = lum;
      rawBuf[i + 3] = 255;
    }
  }

  return sharp(rawBuf, { raw: { width: imgW, height: imgH, channels: 4 } })
    .png()
    .toBuffer();
}
