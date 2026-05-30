'use client';

import { useState } from 'react';
import type { GeometryRoom, GeneralPreferences, RoomPreference } from '../lib/geometry/types';

const ROOM_TYPE_ICONS: Record<string, string> = {
  living: '🛋',
  bedroom: '🛏',
  kitchen: '🍳',
  bathroom: '🛁',
  wc: '🚽',
  hallway: '🚪',
  balcony: '🌿',
  storage: '📦',
  studio_zone: '🏠',
  unknown: '❓',
};

export default function RoomPrefs({
  planImageUrl,
  rooms,
  generalPrefs,
  onConfirm,
  onBack,
}: {
  planImageUrl: string;
  rooms: GeometryRoom[];
  generalPrefs: GeneralPreferences;
  onConfirm: (prefs: RoomPreference[]) => void;
  onBack: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roomPrefs, setRoomPrefs] = useState<RoomPreference[]>(() =>
    rooms.map((r) => ({
      roomId: r.id,
      inheritFromGeneral: true,
      ceilingHeightOverride: undefined,
      styleNotes: '',
      specialRequirements: '',
    }))
  );
  const [fading, setFading] = useState(false);

  const navigate = (toIndex: number) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => {
      setCurrentIndex(toIndex);
      setFading(false);
    }, 120);
  };

  const updatePref = (patch: Partial<RoomPreference>) => {
    setRoomPrefs((prev) =>
      prev.map((p, i) => (i === currentIndex ? { ...p, ...patch } : p))
    );
  };

  const room = rooms[currentIndex];
  const pref = roomPrefs[currentIndex];
  const isLast = currentIndex === rooms.length - 1;

  if (!room || !pref) return null;

  const icon = ROOM_TYPE_ICONS[room.type] ?? '🏠';
  const area = (room.dimensions.width_m * room.dimensions.length_m).toFixed(1);

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={onBack}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Настройка комнат</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Scrollable content */}
      <div style={{ position: 'absolute', top: 120, left: 22, right: 22, bottom: 84, overflowY: 'auto' }}>
        {/* Step progress: step 3 of 3 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: n <= 2 ? 'var(--ink)' : 'var(--ink)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {n < 3 ? '✓' : n}
              </div>
              {n < 3 && <div style={{ width: 24, height: 2, borderRadius: 1, background: 'var(--ink)' }} />}
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>Шаг 3 из 3</div>
        </div>

        {/* Per-room dot progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {rooms.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => navigate(i)}
              style={{
                width: i === currentIndex ? 20 : 8, height: 8, borderRadius: 4,
                background: i === currentIndex ? 'var(--ink)' : i < currentIndex ? 'rgba(34,30,26,0.4)' : 'rgba(34,30,26,0.15)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'width 0.2s, background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Plan thumbnail */}
        {planImageUrl && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(34,30,26,0.1)', marginBottom: 16, background: '#f9f7f4' }}>
            <img src={planImageUrl} alt="План" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        {/* Room card */}
        <div
          style={{
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.12s ease',
          }}
        >
          {/* Room header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{room.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {room.dimensions.width_m.toFixed(1)} × {room.dimensions.length_m.toFixed(1)} м · {area} м²
              </div>
            </div>
          </div>

          {/* Inherit toggle */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 14,
              border: '1px solid rgba(34,30,26,0.1)', background: '#fff',
              marginBottom: 14, cursor: 'pointer',
            }}
            onClick={() => updatePref({ inheritFromGeneral: !pref.inheritFromGeneral })}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Как общий стиль</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {generalPrefs.style} · {generalPrefs.budget}
              </div>
            </div>
            <div style={{
              width: 44, height: 26, borderRadius: 13,
              background: pref.inheritFromGeneral ? 'var(--ink)' : 'rgba(34,30,26,0.15)',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: pref.inheritFromGeneral ? 21 : 3,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          {/* Per-room overrides */}
          {!pref.inheritFromGeneral && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Высота потолков, м (переопределить)</span>
                <input
                  type="number"
                  min="2.0"
                  max="5.0"
                  step="0.05"
                  value={pref.ceilingHeightOverride ?? ''}
                  onChange={(e) => updatePref({ ceilingHeightOverride: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder={String(generalPrefs.defaultCeilingHeight)}
                  style={{ borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', background: 'var(--white)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Стилевые заметки для этой комнаты</span>
                <textarea
                  value={pref.styleNotes ?? ''}
                  onChange={(e) => updatePref({ styleNotes: e.target.value.slice(0, 300) })}
                  placeholder="Например: акцент на тёмное дерево, матовые поверхности..."
                  rows={2}
                  style={{ borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', resize: 'vertical', background: 'var(--white)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </label>
            </div>
          )}

          {/* Special requirements — always shown */}
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Особые требования (необязательно)</span>
            <textarea
              value={pref.specialRequirements ?? ''}
              onChange={(e) => updatePref({ specialRequirements: e.target.value.slice(0, 300) })}
              placeholder="Например: нужно место для детской кроватки, встроенный шкаф..."
              rows={2}
              style={{ borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', resize: 'vertical', background: 'var(--white)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit' }}
            />
          </label>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28, display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ flex: 1, height: 52, opacity: currentIndex === 0 ? 0.4 : 1 }}
          disabled={currentIndex === 0}
          onClick={() => navigate(currentIndex - 1)}
        >
          ← Назад
        </button>
        {isLast ? (
          <button
            type="button"
            className="btn btn--dark btn--block"
            style={{ flex: 2, height: 52, background: '#2E7D32', borderColor: '#2E7D32' }}
            onClick={() => onConfirm(roomPrefs)}
          >
            Готово →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--dark btn--block"
            style={{ flex: 2, height: 52 }}
            onClick={() => navigate(currentIndex + 1)}
          >
            Следующая →
          </button>
        )}
      </div>
    </div>
  );
}
