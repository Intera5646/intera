'use client';

import { useState, useRef } from 'react';
import type { Point2D, RoomShape } from '../lib/geometry/types';
import { polygonAreaMm2, isPolygonAxisAlignedRectangle } from '../lib/geometry/polygon';

const VP_W = 320;
const VP_H = 240;
const V_R = 9;
const M_R = 5;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function segmentsIntersect(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
  const dx1 = a2.x_mm - a1.x_mm, dy1 = a2.y_mm - a1.y_mm;
  const dx2 = b2.x_mm - b1.x_mm, dy2 = b2.y_mm - b1.y_mm;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((b1.x_mm - a1.x_mm) * dy2 - (b1.y_mm - a1.y_mm) * dx2) / denom;
  const u = ((b1.x_mm - a1.x_mm) * dy1 - (b1.y_mm - a1.y_mm) * dx1) / denom;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

function hasSelfIntersection(pts: Point2D[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i], a2 = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(a1, a2, pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

export default function PolygonEditor({
  initialShape,
  boundingBox,
  roomName,
  onSave,
  onCancel,
}: {
  initialShape: RoomShape;
  boundingBox: { width_mm: number; length_mm: number };
  roomName: string;
  onSave: (shape: RoomShape) => void;
  onCancel: () => void;
}) {
  const wMm = Math.max(500, boundingBox.width_mm);
  const lMm = Math.max(500, boundingBox.length_mm);

  const rectPts = (): Point2D[] => [
    { x_mm: 0, y_mm: 0 },
    { x_mm: wMm, y_mm: 0 },
    { x_mm: wMm, y_mm: lMm },
    { x_mm: 0, y_mm: lMm },
  ];

  const [mode, setMode] = useState<'rectangle' | 'polygon'>(
    initialShape.kind === 'polygon' ? 'polygon' : 'rectangle',
  );
  const [points, setPoints] = useState<Point2D[]>(
    () => initialShape.kind === 'polygon' ? [...initialShape.points] : rectPts(),
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);

  // Scale and offset so bbox is centered in viewport
  const scale = Math.min((VP_W - 60) / wMm, (VP_H - 50) / lMm);
  const ox = (VP_W - wMm * scale) / 2;
  const oy = (VP_H - lMm * scale) / 2;

  const toX = (mm: number) => ox + mm * scale;
  const toY = (mm: number) => oy + mm * scale;

  // Grid: smallest candidate giving ≥30px cells
  const gridMm = ([100, 200, 500, 1000, 2000, 5000] as const).find(g => g * scale >= 30) ?? 5000;
  const snapMm = gridMm / 2;

  const fromClient = (cx: number, cy: number): Point2D => {
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = (cx - rect.left) * (VP_W / rect.width);
    const vy = (cy - rect.top) * (VP_H / rect.height);
    const raw_x = (vx - ox) / scale;
    const raw_y = (vy - oy) / scale;
    return {
      x_mm: clamp(Math.round(raw_x / snapMm) * snapMm, 0, wMm),
      y_mm: clamp(Math.round(raw_y / snapMm) * snapMm, 0, lMm),
    };
  };

  const onVertexDown = (e: React.PointerEvent<SVGCircleElement>, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = idx;
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onSvgMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const idx = dragging.current;
    const pt = fromClient(e.clientX, e.clientY);
    setPoints(prev => prev.map((p, i) => i === idx ? pt : p));
  };

  const onSvgUp = () => { dragging.current = null; };

  const insertAt = (i: number) => {
    const a = points[i], b = points[(i + 1) % points.length];
    const mid: Point2D = {
      x_mm: Math.round(((a.x_mm + b.x_mm) / 2) / snapMm) * snapMm,
      y_mm: Math.round(((a.y_mm + b.y_mm) / 2) / snapMm) * snapMm,
    };
    setPoints(prev => { const n = [...prev]; n.splice(i + 1, 0, mid); return n; });
  };

  const deleteAt = (i: number) => {
    if (points.length <= 4) return;
    setPoints(prev => prev.filter((_, j) => j !== i));
  };

  const activePts = mode === 'polygon' ? points : rectPts();
  const area = (polygonAreaMm2(activePts) / 1_000_000).toFixed(1);
  const selfIntersects = mode === 'polygon' && hasSelfIntersection(points);

  const handleSave = () => {
    if (mode === 'rectangle') { onSave({ kind: 'rectangle' }); return; }
    if (isPolygonAxisAlignedRectangle(points)) { onSave({ kind: 'rectangle' }); return; }
    onSave({ kind: 'polygon', points: [...points] });
  };

  const polyStr = activePts.map(p => `${toX(p.x_mm).toFixed(2)},${toY(p.y_mm).toFixed(2)}`).join(' ');

  // Grid lines
  const gxLines: number[] = [];
  for (let x = 0; x <= wMm; x += gridMm) gxLines.push(x);
  const gyLines: number[] = [];
  for (let y = 0; y <= lMm; y += gridMm) gyLines.push(y);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(20,16,12,0.72)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#F5F0E8', borderRadius: 20, width: '100%', maxWidth: 400,
        margin: '0 16px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(34,30,26,0.1)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{roomName}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Редактор формы помещения</div>
          </div>
          <button type="button" onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>
            ×
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderBottom: '1px solid rgba(34,30,26,0.08)' }}>
          {(['rectangle', 'polygon'] as const).map(m => (
            <button key={m} type="button"
              onClick={() => {
                if (m === 'polygon' && mode === 'rectangle') setPoints(rectPts());
                if (m === 'rectangle') setPoints(rectPts());
                setMode(m);
              }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
                border: mode === m ? '2px solid var(--ink)' : '1px solid rgba(34,30,26,0.2)',
                background: mode === m ? 'var(--ink)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
              }}>
              {m === 'rectangle' ? 'Прямоугольник' : 'Сложная форма'}
            </button>
          ))}
        </div>

        {/* SVG canvas */}
        <div style={{ padding: '12px 18px' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VP_W} ${VP_H}`}
            style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none', userSelect: 'none' }}
            onPointerMove={onSvgMove}
            onPointerUp={onSvgUp}
            onPointerLeave={onSvgUp}
          >
            {/* Grid lines */}
            {gxLines.map(x => (
              <line key={`gx${x}`} x1={toX(x)} y1={oy} x2={toX(x)} y2={oy + lMm * scale}
                stroke="rgba(34,30,26,0.06)" strokeWidth="0.5" />
            ))}
            {gyLines.map(y => (
              <line key={`gy${y}`} x1={ox} y1={toY(y)} x2={ox + wMm * scale} y2={toY(y)}
                stroke="rgba(34,30,26,0.06)" strokeWidth="0.5" />
            ))}

            {/* Bounding box */}
            <rect x={ox} y={oy} width={wMm * scale} height={lMm * scale}
              fill="none" stroke="rgba(34,30,26,0.15)" strokeWidth="1" strokeDasharray="4 3" />

            {/* Room polygon */}
            <polygon points={polyStr}
              fill={selfIntersects ? 'rgba(177,74,63,0.1)' : 'rgba(34,30,26,0.06)'}
              stroke={selfIntersects ? '#B14A3F' : '#221E1A'}
              strokeWidth="1.5" strokeLinejoin="round" />

            {/* Dimension labels */}
            <text x={ox + (wMm * scale) / 2} y={oy - 6}
              textAnchor="middle" fontSize="9" fill="rgba(34,30,26,0.45)">
              {(wMm / 1000).toFixed(1)} м
            </text>
            <text x={ox - 8} y={oy + (lMm * scale) / 2}
              textAnchor="middle" fontSize="9" fill="rgba(34,30,26,0.45)"
              transform={`rotate(-90 ${ox - 8} ${oy + (lMm * scale) / 2})`}>
              {(lMm / 1000).toFixed(1)} м
            </text>

            {mode === 'polygon' && (
              <>
                {/* Edge midpoints — click to insert vertex */}
                {points.map((p, i) => {
                  const q = points[(i + 1) % points.length];
                  return (
                    <circle key={`m${i}`}
                      cx={toX((p.x_mm + q.x_mm) / 2)} cy={toY((p.y_mm + q.y_mm) / 2)}
                      r={M_R}
                      fill="rgba(255,255,255,0.85)" stroke="rgba(34,30,26,0.3)" strokeWidth="1"
                      style={{ cursor: 'copy' }}
                      onClick={(e) => { e.stopPropagation(); insertAt(i); }}
                    />
                  );
                })}
                {/* Vertices — drag to move, double-click to delete */}
                {points.map((p, i) => (
                  <circle key={`v${i}`}
                    cx={toX(p.x_mm)} cy={toY(p.y_mm)} r={V_R}
                    fill="#fff" stroke="#221E1A" strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => onVertexDown(e, i)}
                    onDoubleClick={(e) => { e.stopPropagation(); deleteAt(i); }}
                  />
                ))}
              </>
            )}
          </svg>
        </div>

        {/* Info bar */}
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          padding: '8px 18px', borderTop: '1px solid rgba(34,30,26,0.08)', minHeight: 36,
        }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Площадь: <b style={{ color: 'var(--ink)' }}>{area} м²</b>
          </span>
          {mode === 'polygon' && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {points.length} вершин</span>
          )}
          {selfIntersects ? (
            <span style={{ fontSize: 12, color: '#B14A3F', fontWeight: 600, marginLeft: 'auto' }}>
              ⚠ Самопересечение
            </span>
          ) : mode === 'polygon' && (
            <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', opacity: 0.75 }}>
              тяни · ✚ на ребре · ×2 удалить
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px', borderTop: '1px solid rgba(34,30,26,0.1)' }}>
          <button type="button" onClick={onCancel}
            style={{
              flex: 1, height: 46, borderRadius: 12, fontSize: 14,
              border: '1px solid rgba(34,30,26,0.2)', background: 'transparent',
              color: 'var(--ink)', cursor: 'pointer',
            }}>
            Отмена
          </button>
          <button type="button" onClick={handleSave} disabled={selfIntersects}
            style={{
              flex: 2, height: 46, borderRadius: 12, border: 'none', fontSize: 14,
              fontWeight: 600, color: '#fff', cursor: selfIntersects ? 'not-allowed' : 'pointer',
              background: selfIntersects ? 'rgba(34,30,26,0.2)' : 'var(--ink)',
            }}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
