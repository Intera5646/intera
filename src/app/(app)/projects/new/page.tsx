'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROOM_TYPES = [
  { id: 'living_room', label: 'Гостиная' },
  { id: 'bedroom', label: 'Спальня' },
  { id: 'kitchen', label: 'Кухня' },
  { id: 'bathroom', label: 'Ванная' },
  { id: 'office', label: 'Кабинет' },
  { id: 'balcony', label: 'Балкон' },
];

const STYLES = ['Скандинавский', 'Минимализм', 'Лофт', 'Классика', 'Современный'];
const BUDGETS = ['Эконом', 'Средний', 'Премиум'];
const HEIGHTS = ['2.5 м', '2.7 м', '3.0 м', 'Указать вручную'];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [roomType, setRoomType] = useState('living_room');
  const [style, setStyle] = useState('Скандинавский');
  const [budget, setBudget] = useState('Средний');
  const [wishes, setWishes] = useState('');
  const [height, setHeight] = useState('2.7 м');
  const [customHeight, setCustomHeight] = useState('2.7');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenCost = useMemo(() => 1, []);

  const uploadFloorPlan = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('floor-plans')
        .upload(fileName, file);

      if (uploadError || !uploadData) {
        throw uploadError || new Error('Ошибка загрузки файла.');
      }

      const { data: publicData, error: publicUrlError } = supabase.storage
        .from('floor-plans')
        .getPublicUrl(fileName);

      if (publicUrlError || !publicData?.publicUrl) {
        throw publicUrlError || new Error('Не удалось получить URL файла.');
      }

      setImageUrl(publicData.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла.');
      setImageUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    if (selectedFile) {
      await uploadFloorPlan(selectedFile);
    }
  };

  const confirmGeneration = async () => {
    setError(null);
    setSubmitting(true);

    try {
      if (!imageUrl) {
        throw new Error('Сначала загрузите файл плана.');
      }

      const ceilingHeightValue = height === 'Указать вручную' ? Number(customHeight) : Number(height.replace(' м', ''));

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_image_url: imageUrl,
          room_type: roomType,
          style,
          budget,
          user_wishes: wishes,
          ceiling_height: ceilingHeightValue,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.generationId) {
        throw new Error(result.error?.message || 'Не удалось запустить генерацию.');
      }

      router.push(`/projects/${result.generationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании проекта.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={() => router.back()}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
            Новый проект
          </div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ position: 'absolute', top: 120, left: 22, right: 22, bottom: 20, overflow: 'auto' }}>
        <div style={{ marginBottom: 18, fontSize: 13, color: 'var(--muted)' }}>
          Шаг {step} из 4 — создайте проект по плану БТИ или фото комнаты.
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {[1, 2, 3, 4].map((value) => (
            <div
              key={value}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 999,
                background: value <= step ? 'var(--ink)' : 'rgba(34,30,26,0.12)',
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                Загрузите план или фото
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Отправьте скан плана БТИ или фотографию комнаты. Чем лучше качество, тем аккуратнее будет визуализация.
              </div>
            </div>

            <label
              htmlFor="floor-plan"
              style={{
                borderRadius: 20,
                border: '1px dashed var(--line)',
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 22,
                cursor: 'pointer',
                background: file ? 'rgba(40,30,18,0.03)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 54, lineHeight: 1 }}>&#x2B07;</div>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Выберите файл</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', maxWidth: 260 }}>
                JPG, PNG, PDF — до 20 МБ
              </div>
              {file ? (
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-2)' }}>{file.name}</div>
              ) : null}
            </label>
            <input
              id="floor-plan"
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {uploading ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Загрузка файла...</div>
            ) : imageUrl ? (
              <div style={{ color: 'var(--brand-primary)', fontSize: 13 }}>Файл загружен и готов к генерации.</div>
            ) : null}
          </section>
        )}

        {step === 2 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                Тип помещения
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                Выберите помещение, которое будет визуализировано. Тип влияет на планировку и мебель.
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {ROOM_TYPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoomType(item.id)}
                  className="pill"
                  style={{
                    justifyContent: 'space-between',
                    background: roomType === item.id ? 'var(--ink)' : 'var(--white)',
                    color: roomType === item.id ? 'var(--paper)' : 'var(--ink)',
                    border: roomType === item.id ? '1px solid transparent' : '1px solid var(--line)',
                  }}
                >
                  <span>{item.label}</span>
                  {roomType === item.id ? '✓' : null}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                Стиль и бюджет
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                Выберите атмосферу и ценовой сегмент, чтобы рендеры соответствовали вашему вкусу.
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Стиль</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {STYLES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStyle(value)}
                      className="pill"
                      style={{
                        background: style === value ? 'var(--ink)' : 'var(--white)',
                        color: style === value ? 'var(--paper)' : 'var(--ink)',
                        justifyContent: 'flex-start',
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Бюджет</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {BUDGETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBudget(value)}
                      className="pill"
                      style={{
                        background: budget === value ? 'var(--ink)' : 'var(--white)',
                        color: budget === value ? 'var(--paper)' : 'var(--ink)',
                        justifyContent: 'flex-start',
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Пожелания к дизайну (необязательно)</span>
                <textarea
                  value={wishes}
                  onChange={(event) => setWishes(event.target.value.slice(0, 500))}
                  placeholder="Например: хочу светлые стены, деревянный пол, больше растений, без лишних деталей..."
                  rows={5}
                  style={{
                    width: '100%',
                    minHeight: 120,
                    borderRadius: 16,
                    border: '1px solid var(--line)',
                    padding: 14,
                    resize: 'vertical',
                    background: 'var(--white)',
                    color: 'var(--ink)',
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                  {wishes.length}/500
                </div>
              </label>
            </div>
          </section>
        )}

        {step === 4 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                Высота потолка
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                Чем точнее вы укажете высоту, тем стабильнее будет геометрия рендера.
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {HEIGHTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHeight(value)}
                  className="pill"
                  style={{
                    background: height === value ? 'var(--ink)' : 'var(--white)',
                    color: height === value ? 'var(--paper)' : 'var(--ink)',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{value}</span>
                  {height === value ? '✓' : null}
                </button>
              ))}
            </div>
            {height === 'Указать вручную' && (
              <div className="input">
                <input
                  type="number"
                  min="2.0"
                  step="0.05"
                  value={customHeight}
                  onChange={(event) => setCustomHeight(event.target.value)}
                  placeholder="Высота в метрах"
                  aria-label="Высота потолка"
                />
              </div>
            )}
          </section>
        )}

        <div style={{ marginTop: 24, padding: 18, borderRadius: 20, background: 'rgba(34,30,26,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Стоимость</div>
              <div className="serif" style={{ fontSize: 22, color: 'var(--ink)' }}>{tokenCost} токен</div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'right' }}>
              Включает 4 рендера и дизайнерские пояснения
            </div>
          </div>
        </div>

        {error ? (
          <div style={{ marginTop: 18, color: '#B14A3F', fontSize: 13 }}>{error}</div>
        ) : null}
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28, display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ flex: 1, height: 52 }}
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1 || uploading || submitting}
        >
          Назад
        </button>
        <button
          type="button"
          className="btn btn--dark btn--block"
          style={{ flex: 1, height: 52 }}
          onClick={() => {
            if (step < 4) {
              setStep(step + 1);
            } else {
              confirmGeneration();
            }
          }}
          disabled={submitting || uploading || (step === 1 && !imageUrl)}
        >
          {submitting ? 'Генерация...' : step < 4 ? 'Далее' : 'Сгенерировать'}
        </button>
      </div>
    </div>
  );
}
