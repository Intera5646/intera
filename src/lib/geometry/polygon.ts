import type { GeometryRoom, Point2D, RoomShape } from './types';

/** Shoelace area (mm²) of a closed polygon. Returns 0 if fewer than 3 points. */
export function polygonAreaMm2(points: Point2D[]): number {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x_mm * b.y_mm - b.x_mm * a.y_mm;
  }
  return Math.abs(sum) / 2;
}

/** Axis-aligned bounding box of a polygon (mm). */
export function polygonBoundingBoxMm(points: Point2D[]): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  if (!Array.isArray(points) || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x_mm < minX) minX = p.x_mm;
    if (p.x_mm > maxX) maxX = p.x_mm;
    if (p.y_mm < minY) minY = p.y_mm;
    if (p.y_mm > maxY) maxY = p.y_mm;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Ray-casting point-in-polygon test.
 * `x`, `y` and `polygon` points should share the same unit (mm or m — irrelevant).
 */
export function pointInPolygon(x: number, y: number, polygon: Point2D[]): boolean {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x_mm, yi = polygon[i].y_mm;
    const xj = polygon[j].x_mm, yj = polygon[j].y_mm;
    const intersects =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Returns true if the polygon is a perfect axis-aligned rectangle —
 * exactly 4 corners that form a closed rectangle (within `tolMm` mm).
 */
export function isPolygonAxisAlignedRectangle(points: Point2D[], tolMm = 1): boolean {
  if (!Array.isArray(points) || points.length !== 4) return false;
  const { minX, minY, maxX, maxY } = polygonBoundingBoxMm(points);
  const corners = new Set<string>([
    `${minX},${minY}`, `${maxX},${minY}`, `${maxX},${maxY}`, `${minX},${maxY}`,
  ]);
  for (const p of points) {
    const matches = [...corners].some(c => {
      const [cx, cy] = c.split(',').map(Number);
      return Math.abs(p.x_mm - cx) <= tolMm && Math.abs(p.y_mm - cy) <= tolMm;
    });
    if (!matches) return false;
  }
  return true;
}

/**
 * Normalise a parsed shape value. Returns:
 *   - { kind:'rectangle' } when input is missing/rectangle or polygon collapses to a rect
 *   - { kind:'polygon', points } for valid polygons (3+ points)
 *   - { kind:'rectangle' } as a safe fallback for malformed input
 */
export function normalizeRoomShape(raw: unknown): RoomShape {
  if (!raw || typeof raw !== 'object') return { kind: 'rectangle' };
  const shape = raw as Record<string, unknown>;
  const kind = String(shape.kind ?? '').toLowerCase();

  if (kind === 'polygon' && Array.isArray(shape.points)) {
    const pts: Point2D[] = (shape.points as unknown[])
      .map((p): Point2D | null => {
        if (!p || typeof p !== 'object') return null;
        const pp = p as Record<string, unknown>;
        const x = Number(pp.x_mm ?? pp.x);
        const y = Number(pp.y_mm ?? pp.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x_mm: Math.max(0, x), y_mm: Math.max(0, y) };
      })
      .filter((p): p is Point2D => p !== null);

    if (pts.length < 4) return { kind: 'rectangle' };
    if (isPolygonAxisAlignedRectangle(pts)) return { kind: 'rectangle' };
    return { kind: 'polygon', points: pts };
  }

  return { kind: 'rectangle' };
}

/** Returns room area in m². Polygon → shoelace; rectangle → width × length. */
export function getRoomArea(room: GeometryRoom): number {
  if (room.shape?.kind === 'polygon') {
    return polygonAreaMm2(room.shape.points) / 1_000_000;
  }
  return room.dimensions.width_m * room.dimensions.length_m;
}

/** Polygon outline of the room in mm (rectangle bbox if no polygon). */
export function getRoomPolygonMm(room: GeometryRoom): Point2D[] {
  if (room.shape?.kind === 'polygon') return room.shape.points;
  const w = room.dimensions.width_m * 1000;
  const l = room.dimensions.length_m * 1000;
  return [
    { x_mm: 0, y_mm: 0 },
    { x_mm: w, y_mm: 0 },
    { x_mm: w, y_mm: l },
    { x_mm: 0, y_mm: l },
  ];
}
