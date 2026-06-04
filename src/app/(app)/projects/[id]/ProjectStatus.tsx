'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AIDisclaimer from '../../../../components/shared/AIDisclaimer';

type DesignerText = {
  furniture_placement?: string;
  color_solution?: string;
  lighting?: string;
  style_explanation?: string;
  budget_range?: {
    min?: number;
    max?: number;
    currency?: string;
    description?: string;
  };
  shopping_highlights?: Array<{
    category: string;
    item: string;
    price_range: string;
  }>;
};

type CameraMetaEntry = {
  room_name?: string;
  room_dimensions?: string;
  camera_index?: number;
  room_id?: string;
};

type RoomCostEntry = {
  name: string;
  type: string;
  area_m2: number;
};

type ProjectStatusProps = {
  generationId: string;
  initialStatus: string;
  initialRenderUrls: string[];
  initialError: string | null;
  initialDesignerText: DesignerText | null;
  initialCameraMetadata?: CameraMetaEntry[] | null;
  initialRooms?: RoomCostEntry[];
  initialBudget?: string | null;
};

function formatPrice(value: number) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

// ── Renovation cost estimate ──────────────────────────────────────────────────

const RENO_RATES: Record<string, { min: number; max: number }> = {
  bedroom:           { min: 15000, max: 25000 },
  kids_room:         { min: 15000, max: 25000 },
  living:            { min: 15000, max: 25000 },
  studio_zone:       { min: 15000, max: 25000 },
  kitchen_living:    { min: 20000, max: 35000 },
  kitchen:           { min: 20000, max: 35000 },
  bathroom:          { min: 30000, max: 50000 },
  combined_bathroom: { min: 30000, max: 50000 },
  wc:                { min: 30000, max: 50000 },
  corridor:          { min: 12000, max: 20000 },
  hallway:           { min: 12000, max: 20000 },
  vestibule:         { min: 12000, max: 20000 },
};
const RENO_DEFAULT = { min: 14000, max: 22000 };

function computeRoomCost(room: RoomCostEntry, budget: string): { min: number; max: number } {
  const rates = RENO_RATES[room.type] ?? RENO_DEFAULT;
  const area = Math.max(1, room.area_m2);
  const bud = budget.toLowerCase();
  if (bud.includes('эконом') || bud.includes('economy')) {
    const v = Math.round(rates.min * 0.8 * area / 1000) * 1000;
    return { min: v, max: Math.round(v * 1.15 / 1000) * 1000 };
  }
  if (bud.includes('премиум') || bud.includes('premium')) {
    const v = Math.round(rates.max * 1.3 * area / 1000) * 1000;
    return { min: Math.round(v * 0.88 / 1000) * 1000, max: v };
  }
  // Средний / standard / default
  const mid = Math.round((rates.min + rates.max) / 2 * area / 1000) * 1000;
  return { min: Math.round(mid * 0.88 / 1000) * 1000, max: Math.round(mid * 1.12 / 1000) * 1000 };
}

export default function ProjectStatus({
  generationId,
  initialStatus,
  initialRenderUrls,
  initialError,
  initialDesignerText,
  initialCameraMetadata,
  initialRooms = [],
  initialBudget,
}: ProjectStatusProps) {
  const router = useRouter();

  const normalizeRenderUrls = (renders: unknown[]) =>
    (renders ?? [])
      .map((r) => {
        if (typeof r === 'string') return r;
        const obj = r as Record<string, unknown>;
        if (typeof obj?.url === 'function') return (obj.url as () => string)();
        if (typeof obj?.url === 'string') return obj.url;
        return String(r);
      })
      .filter(Boolean);

  const [status, setStatus] = useState(initialStatus);
  const [renderUrls, setRenderUrls] = useState<string[]>(
    normalizeRenderUrls(initialRenderUrls as unknown[])
  );
  const [progress, setProgress] = useState(
    initialStatus === 'done' ? 100 : initialStatus === 'failed' ? 0 : 20
  );
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [designerText, setDesignerText] = useState<DesignerText | null>(initialDesignerText);
  const [activeTab, setActiveTab] = useState<'renders' | 'designer' | 'shopping'>('renders');
  const [cameraMetadata, setCameraMetadata] = useState<CameraMetaEntry[] | null>(initialCameraMetadata ?? null);

  useEffect(() => {
    if (status !== 'processing' && status !== 'pending') return;

    const interval = window.setInterval(async () => {
      const res = await fetch(`/api/status/${generationId}`);
      if (!res.ok) return;
      const result = await res.json();
      if (!result.success) return;

      setStatus(result.status);
      setProgress(result.progress ?? (result.status === 'done' ? 100 : 60));
      setRenderUrls(normalizeRenderUrls(result.render_urls ?? []));
      if (result.designer_text) setDesignerText(result.designer_text);
      if (result.camera_metadata) setCameraMetadata(result.camera_metadata as CameraMetaEntry[]);
      if (result.status === 'failed') {
        setErrorMessage(result.error_message ?? 'Генерация завершилась ошибкой.');
        window.clearInterval(interval);
      }
      if (result.status === 'done') {
        window.clearInterval(interval);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [generationId, status]);

  const isDone = status === 'done';
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing' || status === 'pending';

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={() => router.back()}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 20, fontStyle: 'italic' }}>
            {isDone ? 'Готово' : isProcessing ? 'Генерация...' : 'Ошибка'}
          </div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ position: 'absolute', top: 120, left: 22, right: 22, bottom: 86, overflow: 'auto' }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {isDone ? 'Рендеры готовы' : isProcessing ? 'Обрабатывается...' : 'Произошла ошибка'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{progress}%</div>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: 'rgba(34,30,26,0.1)' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                height: '100%',
                borderRadius: 999,
                background: isFailed
                  ? '#B71C1C'
                  : isDone
                    ? 'var(--brand-gold)'
                    : 'var(--ink)',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>

        {/* Processing state */}
        {isProcessing && (
          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: 'rgba(34,30,26,0.04)',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
              Обрабатываем ваш проект. Обычно это занимает 30–90 секунд.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Анализ плана', 'Depth map', 'AI-генерация', 'Объяснения'].map((step) => (
                <span
                  key={step}
                  className="pill"
                  style={{ padding: '7px 12px', fontSize: 12, background: 'rgba(255,255,255,0.7)' }}
                >
                  {step}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {isFailed && (
          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: '#FEF2F2',
              marginBottom: 20,
              border: '1px solid rgba(183,28,28,0.2)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#B71C1C', marginBottom: 6 }}>
              Генерация не удалась
            </div>
            <div style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.7 }}>
              {errorMessage ?? 'Произошла ошибка при обработке запроса. Токен возвращён на баланс.'}
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <>
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderRadius: 12,
                background: 'rgba(34,30,26,0.06)',
                padding: 4,
                marginBottom: 20,
              }}
            >
              {([
                ['renders', 'Рендеры'],
                designerText ? ['designer', 'Дизайнер'] : null,
                designerText?.shopping_highlights?.length ? ['shopping', 'Покупки'] : null,
              ].filter(Boolean) as [string, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 9,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: activeTab === tab ? '#fff' : 'transparent',
                    color: activeTab === tab ? 'var(--brand-primary)' : 'var(--muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Renders tab */}
            {activeTab === 'renders' && (
              <section style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  {renderUrls.length > 0 ? (
                    renderUrls.map((url, idx) => {
                      const meta = cameraMetadata?.[idx];
                      const roomLabel = meta?.room_name
                        ? meta.room_dimensions
                          ? `${meta.room_name} — ${meta.room_dimensions}`
                          : meta.room_name
                        : null;
                      return (
                      <div
                        key={`${url}-${idx}`}
                        style={{
                          position: 'relative',
                          borderRadius: 18,
                          overflow: 'hidden',
                          background: '#f4f2ee',
                          minHeight: 160,
                        }}
                      >
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={roomLabel ?? `Рендер ${idx + 1}`}
                            style={{ width: '100%', display: 'block' }}
                          />
                        </a>
                        {/* AI badge — top-right so it never overlaps the room label */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.85)',
                            background: 'rgba(0,0,0,0.4)',
                            borderRadius: 4,
                            padding: '2px 7px',
                          }}
                        >
                          Создано с помощью ИИ
                        </div>
                        {/* Room name + dimensions overlay bar at the bottom */}
                        {roomLabel && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              padding: '8px 12px',
                              background: 'rgba(0,0,0,0.55)',
                              color: '#fff',
                              fontSize: 14,
                              fontWeight: 600,
                              letterSpacing: '0.01em',
                              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                            }}
                          >
                            {roomLabel}
                          </div>
                        )}
                      </div>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        gridColumn: '1/-1',
                        padding: 24,
                        borderRadius: 18,
                        background: 'rgba(34,30,26,0.05)',
                        color: 'var(--muted)',
                        textAlign: 'center',
                      }}
                    >
                      Нет готовых рендеров
                    </div>
                  )}
                </div>
                <AIDisclaimer />

                {/* Отчёт дизайнера */}
                {designerText && (
                  <div style={{ maxWidth: 680, margin: '28px auto 0' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: 'var(--brand-primary)' }}>
                      Отчёт дизайнера
                    </h2>
                    {[
                      { key: 'style_explanation', label: 'Стиль и концепция' },
                      { key: 'furniture_placement', label: 'Планировка и зонирование' },
                      { key: 'color_solution', label: 'Цветовая палитра' },
                      { key: 'lighting', label: 'Освещение' },
                    ].map(({ key, label }) => {
                      const text = designerText[key as keyof DesignerText] as string | undefined;
                      if (!text) return null;
                      return (
                        <div key={key} style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                            {label}
                          </div>
                          <p style={{ fontSize: 15, lineHeight: 1.75, color: '#444', margin: 0 }}>
                            {text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Приблизительная смета */}
                {initialRooms.length > 0 && (
                  <div style={{ maxWidth: 680, margin: '32px auto 0' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, color: 'var(--brand-primary)' }}>
                      Приблизительная смета
                    </h2>
                    <p style={{ color: '#888', fontSize: 13, marginBottom: 16, marginTop: 0, lineHeight: 1.5 }}>
                      Ориентировочная стоимость ремонта «под ключ» без мебели и техники
                    </p>
                    {(() => {
                      const budget = initialBudget ?? 'Средний';
                      const roomCosts = initialRooms.map(r => ({ ...r, cost: computeRoomCost(r, budget) }));
                      const totalMin = roomCosts.reduce((s, r) => s + r.cost.min, 0);
                      const totalMax = roomCosts.reduce((s, r) => s + r.cost.max, 0);
                      return (
                        <>
                          {roomCosts.map((room, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 0',
                                borderBottom: '1px solid #f0f0f0',
                                fontSize: 14,
                              }}
                            >
                              <span style={{ color: 'var(--brand-primary)' }}>
                                {room.name} <span style={{ color: '#aaa', fontWeight: 400 }}>({room.area_m2} м²)</span>
                              </span>
                              <span style={{ color: '#555', whiteSpace: 'nowrap' }}>
                                от {formatPrice(room.cost.min)}
                              </span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14, fontSize: 17, fontWeight: 700, color: 'var(--brand-primary)' }}>
                            <span>Итого:</span>
                            <span>{formatPrice(totalMin)} – {formatPrice(totalMax)}</span>
                          </div>
                          <p style={{ fontSize: 12, color: '#aaa', marginTop: 10, lineHeight: 1.5 }}>
                            * Смета является ориентировочной. Точная стоимость зависит от отделочных материалов, региона и подрядчика.
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </section>
            )}

            {/* Designer tab */}
            {activeTab === 'designer' && designerText && (
              <section style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
                {[
                  { key: 'style_explanation', label: 'Стиль и атмосфера' },
                  { key: 'furniture_placement', label: 'Расстановка мебели' },
                  { key: 'color_solution', label: 'Цветовое решение' },
                  { key: 'lighting', label: 'Освещение' },
                ].map(({ key, label }) => {
                  const text = designerText[key as keyof DesignerText] as string | undefined;
                  if (!text) return null;
                  return (
                    <div
                      key={key}
                      style={{
                        padding: 18,
                        borderRadius: 16,
                        background: '#fff',
                        border: '1px solid rgba(13,27,42,0.08)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--brand-primary)', lineHeight: 1.75 }}>
                        {text}
                      </div>
                    </div>
                  );
                })}

                {designerText.budget_range && (
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.06))',
                      border: '1px solid rgba(201,168,76,0.25)',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#6D5500', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Ориентировочный бюджет
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {designerText.budget_range.min
                        ? `${formatPrice(designerText.budget_range.min)} — ${formatPrice(designerText.budget_range.max ?? 0)}`
                        : '—'}
                    </div>
                    {designerText.budget_range.description && (
                      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                        {designerText.budget_range.description}
                      </div>
                    )}
                  </div>
                )}

                <AIDisclaimer />
              </section>
            )}

            {/* Shopping tab */}
            {activeTab === 'shopping' && designerText?.shopping_highlights && (
              <section style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.6 }}>
                  Ключевые позиции — ориентировочные ценовые диапазоны. Цены актуальны для
                  российского рынка 2026 года.
                </div>
                {designerText.shopping_highlights.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 18px',
                      borderRadius: 14,
                      background: '#fff',
                      border: '1px solid rgba(13,27,42,0.08)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                        {item.category}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-primary)' }}>
                        {item.item}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#6D5500',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.price_range}
                    </div>
                  </div>
                ))}
                <AIDisclaimer />
              </section>
            )}
          </>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 20,
          display: 'flex',
          gap: 10,
        }}
      >
        <button
          type="button"
          className="btn btn--ghost"
          style={{ flex: 1, height: 50 }}
          onClick={() => router.push('/projects/new')}
        >
          Новый проект
        </button>
        <button
          type="button"
          className="btn btn--dark btn--block"
          style={{ flex: 1, height: 50 }}
          onClick={() => router.push('/dashboard')}
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
