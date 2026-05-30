'use client';

import { useState } from 'react';
import type { GeneralPreferences } from '../lib/geometry/types';

const STYLE_OPTIONS: Array<{ id: GeneralPreferences['style']; label: string; icon: string }> = [
  { id: 'modern',       label: 'Современный',  icon: '◻' },
  { id: 'scandinavian', label: 'Скандинавский', icon: '❄' },
  { id: 'classic',      label: 'Классика',      icon: '🏛' },
  { id: 'loft',         label: 'Лофт',          icon: '🔩' },
  { id: 'minimalist',   label: 'Минимализм',    icon: '▪' },
  { id: 'eclectic',     label: 'Эклектика',     icon: '🎨' },
];

const BUDGET_OPTIONS: Array<{ id: GeneralPreferences['budget']; label: string; sub: string }> = [
  { id: 'economy',  label: 'Эконом',  sub: 'до 500 тыс. ₽' },
  { id: 'standard', label: 'Средний', sub: '500 тыс. — 1.5 млн ₽' },
  { id: 'premium',  label: 'Премиум', sub: 'от 1.5 млн ₽' },
];

export default function GeneralPrefs({
  planImageUrl,
  roomCount,
  onConfirm,
  onBack,
}: {
  planImageUrl: string;
  roomCount: number;
  onConfirm: (prefs: GeneralPreferences) => void;
  onBack: () => void;
}) {
  const [style, setStyle] = useState<GeneralPreferences['style'] | ''>('');
  const [budget, setBudget] = useState<GeneralPreferences['budget'] | ''>('');
  const [ceilingHeight, setCeilingHeight] = useState('2.7');
  const [colorPreferences, setColorPreferences] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');

  const canConfirm = style !== '' && budget !== '';

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      style: style as GeneralPreferences['style'],
      budget: budget as GeneralPreferences['budget'],
      defaultCeilingHeight: Math.min(5, Math.max(2, parseFloat(ceilingHeight) || 2.7)),
      colorPreferences: colorPreferences.trim() || undefined,
      generalNotes: generalNotes.trim() || undefined,
    });
  };

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={onBack}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Параметры дизайна</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Scrollable content */}
      <div style={{ position: 'absolute', top: 120, left: 22, right: 22, bottom: 84, overflowY: 'auto' }}>
        {/* Step progress: step 2 of 3 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: n === 2 ? 'var(--ink)' : n < 2 ? 'var(--ink)' : 'rgba(34,30,26,0.15)',
                color: n <= 2 ? '#fff' : 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {n < 2 ? '✓' : n}
              </div>
              {n < 3 && <div style={{ width: 24, height: 2, borderRadius: 1, background: n < 2 ? 'var(--ink)' : 'rgba(34,30,26,0.15)' }} />}
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>Шаг 2 из 3</div>
        </div>

        {/* Plan thumbnail */}
        {planImageUrl && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(34,30,26,0.1)', marginBottom: 20, background: '#f9f7f4' }}>
            <img src={planImageUrl} alt="План" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          Помещений: <b style={{ color: 'var(--ink)' }}>{roomCount}</b>
        </div>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 20 }}>
          Стиль и бюджет
        </div>

        {/* Style pills */}
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Стиль интерьера</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStyle(opt.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 14px', borderRadius: 14, flexShrink: 0,
                border: style === opt.id ? '2px solid var(--ink)' : '1.5px solid rgba(34,30,26,0.15)',
                background: style === opt.id ? 'var(--ink)' : '#fff',
                color: style === opt.id ? '#fff' : 'var(--ink)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 20 }}>{opt.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Budget */}
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Бюджет</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setBudget(opt.id)}
              style={{
                padding: '12px 8px', borderRadius: 14,
                border: budget === opt.id ? '2px solid var(--ink)' : '1.5px solid rgba(34,30,26,0.15)',
                background: budget === opt.id ? 'var(--ink)' : '#fff',
                color: budget === opt.id ? '#fff' : 'var(--ink)',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, lineHeight: 1.3 }}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* Ceiling height */}
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Высота потолков, м</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['2.5', '2.7', '3.0'].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setCeilingHeight(h)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: ceilingHeight === h ? '2px solid var(--ink)' : '1.5px solid rgba(34,30,26,0.15)',
                background: ceilingHeight === h ? 'var(--ink)' : '#fff',
                color: ceilingHeight === h ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {h} м
            </button>
          ))}
          <input
            type="number"
            min="2.0"
            max="5.0"
            step="0.05"
            value={['2.5','2.7','3.0'].includes(ceilingHeight) ? '' : ceilingHeight}
            onChange={(e) => setCeilingHeight(e.target.value)}
            placeholder="Другое"
            style={{
              flex: 1, borderRadius: 12, padding: '10px 8px', textAlign: 'center',
              border: !['2.5','2.7','3.0'].includes(ceilingHeight) ? '2px solid var(--ink)' : '1.5px solid rgba(34,30,26,0.15)',
              background: '#fff', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Color preferences */}
        <label style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Предпочтения по цвету (необязательно)</span>
          <input
            type="text"
            value={colorPreferences}
            onChange={(e) => setColorPreferences(e.target.value.slice(0, 200))}
            placeholder="Например: светлые тона, нейтральные цвета..."
            style={{ borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', background: 'var(--white)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit' }}
          />
        </label>

        {/* General notes */}
        <label style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Пожелания к дизайну (необязательно)</span>
          <textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value.slice(0, 500))}
            placeholder="Например: больше естественного света, открытое хранение..."
            rows={3}
            style={{ borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', resize: 'vertical', background: 'var(--white)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', minHeight: 76 }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{generalNotes.length}/500</div>
        </label>
      </div>

      {/* Navigation */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28, display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn--ghost" style={{ flex: 1, height: 52 }} onClick={onBack}>Назад</button>
        <button
          type="button"
          className="btn btn--dark btn--block"
          style={{ flex: 1, height: 52, opacity: canConfirm ? 1 : 0.45 }}
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          Далее →
        </button>
      </div>
    </div>
  );
}
