import sharp from 'sharp';
import { buildScene } from './sceneBuilder';
import type { GeometryRoom } from './types';
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
