'use client';

import type { GeometryRoom, FurnitureItem } from '../lib/geometry/types';
import { getRoomArea } from '../lib/geometry/polygon';

const MAX_W = 340;
const PAD_T = 28;
const PAD_B = 14;
const PAD_H = 4;

const SKELETONS: [number, number, number, number][] = [
  [0.05, 0.05, 0.40, 0.28],
  [0.55, 0.05, 0.40, 0.44],
  [0.05, 0.52, 0.55, 0.28],
];

function RoomPane({
  room,
  furniture,
  skeleton,
}: {
  room: GeometryRoom;
  furniture: FurnitureItem[];
  skeleton: boolean;
}) {
  const wMm = Math.max(500, room.dimensions.width_m * 1000);
  const lMm = Math.max(500, room.dimensions.length_m * 1000);
  const sc = (MAX_W - PAD_H * 2) / wMm;
  const rW = wMm * sc;
  const rH = lMm * sc;
  const svgH = PAD_T + rH + PAD_B;
  const area = getRoomArea(room).toFixed(1);

  const isPolygon = room.shape?.kind === 'polygon';
  const polygonPoints = isPolygon && room.shape?.kind === 'polygon'
    ? room.shape.points
        .map(p => `${(PAD_H + p.x_mm * sc).toFixed(2)},${(PAD_T + p.y_mm * sc).toFixed(2)}`)
        .join(' ')
    : null;

  return (
    <svg
      width={MAX_W}
      height={svgH}
      viewBox={`0 0 ${MAX_W} ${svgH}`}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {/* Room outline */}
      {polygonPoints ? (
        <polygon
          points={polygonPoints}
          fill="white"
          stroke="#888"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <rect
          x={PAD_H} y={PAD_T}
          width={rW} height={rH}
          rx={4}
          fill="white"
          stroke="#888"
          strokeWidth="1.5"
        />
      )}

      {skeleton
        ? SKELETONS.map(([sx, sy, sw, sh], i) => (
            <rect
              key={i}
              x={PAD_H + sx * rW}
              y={PAD_T + sy * rH}
              width={sw * rW}
              height={sh * rH}
              rx={2}
              fill="rgba(34,30,26,0.07)"
              className="animate-pulse"
            />
          ))
        : furniture.map((item, i) => {
            const fx = PAD_H + item.x_mm * sc;
            const fy = PAD_T + item.y_mm * sc;
            const fw = Math.max(2, item.width_mm * sc);
            const fh = Math.max(2, item.depth_mm * sc);
            const cx = PAD_H + (item.x_mm + item.width_mm / 2) * sc;
            const cy = PAD_T + (item.y_mm + item.depth_mm / 2) * sc;
            const label = item.name.length > 8 ? item.name.slice(0, 8) : item.name;
            return (
              <g
                key={i}
                transform={
                  item.rotation !== 0
                    ? `rotate(${item.rotation},${cx.toFixed(2)},${cy.toFixed(2)})`
                    : undefined
                }
              >
                <rect
                  x={fx} y={fy}
                  width={fw} height={fh}
                  rx={2}
                  fill={item.color}
                  fillOpacity={0.8}
                  stroke={item.color}
                  strokeWidth={0.5}
                />
                {fw > 20 && fh > 10 && (
                  <text
                    x={cx} y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.min(7, (fw / Math.max(1, label.length)) * 1.1)}
                    fill="rgba(0,0,0,0.7)"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

      {/* Room name — above rect */}
      <text
        x={PAD_H + rW / 2} y={13}
        textAnchor="middle"
        fontSize={12}
        fontWeight="bold"
        fill="#1A1209"
      >
        {room.name}
      </text>

      {/* Area — subtitle */}
      <text
        x={PAD_H + rW / 2} y={24}
        textAnchor="middle"
        fontSize={10}
        fill="#8C7B6B"
      >
        {area} м²
      </text>

      {/* Dimensions — bottom-right */}
      <text
        x={PAD_H + rW - 2} y={PAD_T + rH + 11}
        textAnchor="end"
        fontSize={9}
        fill="#8C7B6B"
      >
        {room.dimensions.width_m.toFixed(1)}×{room.dimensions.length_m.toFixed(1)} м
      </text>
    </svg>
  );
}

export default function FloorPlanSVG({
  rooms,
  furnitureByRoom,
  loading = false,
}: {
  rooms: GeometryRoom[];
  furnitureByRoom: Record<string, FurnitureItem[]>;
  loading?: boolean;
}) {
  const sorted = [...rooms].sort((a, b) => getRoomArea(b) - getRoomArea(a));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: MAX_W }}>
      {sorted.map((room) => (
        <div
          key={room.id}
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid rgba(34,30,26,0.08)',
            background: '#f9f7f4',
          }}
        >
          <RoomPane
            room={room}
            furniture={furnitureByRoom[room.id] ?? []}
            skeleton={loading && !(room.id in furnitureByRoom)}
          />
        </div>
      ))}
    </div>
  );
}
