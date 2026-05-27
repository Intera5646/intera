'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const APARTMENT_TYPES = [
  { id: 'studio', label: 'Студия' },
  { id: '1k', label: '1-комнатная' },
  { id: '2k', label: '2-комнатная' },
  { id: '3k', label: '3-комнатная' },
  { id: '4k_plus', label: '4+ комнатная' },
  { id: 'house', label: 'Частный дом' },
];

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

const UPLOAD_TYPES = [
  { id: 'photo', label: 'Фото комнаты' },
  { id: 'bti', label: 'План БТИ' },
];

const TOTAL_STEPS = 6;

// ── AccordionSelect component ─────────────────────────────────────────────────
interface SelectOption { id: string; label: string; }

function AccordionSelect({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? options[0];

  return (
    <div>
      {label && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      )}
      <button
        type="button"
        className="pill"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          background: 'var(--ink)',
          color: 'var(--paper)',
          border: '1px solid transparent',
        }}
      >
        <span>{selected.label}</span>
        <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="pill"
              onClick={() => { onChange(opt.id); setOpen(false); }}
              style={{
                justifyContent: 'space-between',
                background: value === opt.id ? 'rgba(34,30,26,0.08)' : 'var(--white)',
                color: 'var(--ink)',
                border: value === opt.id ? '1px solid var(--ink)' : '1px solid var(--line)',
              }}
            >
              <span>{opt.label}</span>
              {value === opt.id && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Upload
  const [uploadType, setUploadType] = useState<'photo' | 'bti'>('photo');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [btiFile, setBtiFile] = useState<File | null>(null);
  const [btiUrl, setBtiUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form fields
  const [apartmentType, setApartmentType] = useState('studio');
  const [roomType, setRoomType] = useState('living_room');
  const [style, setStyle] = useState('Скандинавский');
  const [budget, setBudget] = useState('Средний');
  const [wishes, setWishes] = useState('');
  const [height, setHeight] = useState('2.7 м');
  const [customHeight, setCustomHeight] = useState('2.7');

  // Confirmation step
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenCost = uploadType === 'photo' ? Math.max(1, photoUrls.length) : 1;

  // Fetch balance when entering confirmation step
  useEffect(() => {
    if (step === TOTAL_STEPS) {
      setBalanceLoading(true);
      fetch('/api/tokens/balance')
        .then((r) => r.json())
        .then((d) => setTokenBalance(d.tokenBalance ?? 0))
        .catch(() => setTokenBalance(null))
        .finally(() => setBalanceLoading(false));
    }
  }, [step]);

  const uploadSingleFile = async (file: File): Promise<string | null> => {
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supabase.storage.from('floor-plans').upload(name, file);
    if (error || !data) return null;
    const { data: pub } = supabase.storage.from('floor-plans').getPublicUrl(name);
    return pub?.publicUrl ?? null;
  };

  const handlePhotoFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    setError(null);
    setUploading(true);
    const newUrls: string[] = [];
    const newNames: string[] = [];
    for (const file of selected) {
      const url = await uploadSingleFile(file);
      if (url) { newUrls.push(url); newNames.push(file.name); }
    }
    setPhotoUrls((p) => [...p, ...newUrls]);
    setPhotoNames((p) => [...p, ...newNames]);
    setUploading(false);
    event.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotoUrls((p) => p.filter((_, i) => i !== idx));
    setPhotoNames((p) => p.filter((_, i) => i !== idx));
  };

  const handleBtiFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setError(null);
    setUploading(true);
    setBtiFile(file);
    setBtiUrl(await uploadSingleFile(file));
    setUploading(false);
  };

  const handleUploadTypeChange = (type: string) => {
    setUploadType(type as 'photo' | 'bti');
    setPhotoUrls([]); setPhotoNames([]);
    setBtiFile(null); setBtiUrl(null);
    setError(null);
  };

  const confirmGeneration = async () => {
    setError(null);
    setSubmitting(true);
    const ceilingHeightValue = height === 'Указать вручную'
      ? Number(customHeight)
      : Number(height.replace(' м', ''));
    const base = { room_type: roomType, apartment_type: apartmentType, upload_type: uploadType, style, budget, user_wishes: wishes, ceiling_height: ceilingHeightValue };
    try {
      if (uploadType === 'photo') {
        if (!photoUrls.length) throw new Error('Сначала загрузите хотя бы одно фото.');
        const ids: string[] = [];
        for (const url of photoUrls) {
          const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, plan_image_url: url }) });
          const d = await r.json();
          if (!r.ok || !d.generationId) throw new Error(d.error?.message || 'Не удалось запустить генерацию.');
          ids.push(d.generationId);
        }
        router.push(ids.length === 1 ? `/projects/${ids[0]}` : '/projects');
      } else {
        if (!btiUrl) throw new Error('Сначала загрузите план БТИ.');
        const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, plan_image_url: btiUrl }) });
        const d = await r.json();
        if (!r.ok || !d.generationId) throw new Error(d.error?.message || 'Не удалось запустить генерацию.');
        router.push(`/projects/${d.generationId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании проекта.');
    } finally {
      setSubmitting(false);
    }
  };

  const step1Ready = uploadType === 'photo' ? photoUrls.length > 0 : btiUrl !== null;
  const canAdvance = !uploading && !submitting && (step !== 1 || step1Ready);
  const insufficientBalance = tokenBalance !== null && tokenBalance !== -1 && uploadType === 'photo' && tokenBalance < tokenCost;

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={() => router.back()}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Новый проект</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ position: 'absolute', top: 120, left: 22, right: 22, bottom: 84, overflow: 'auto' }}>
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--muted)' }}>
          {step === TOTAL_STEPS ? 'Подтверждение генерации' : `Шаг ${step} из ${TOTAL_STEPS - 1}`}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {Array.from({ length: TOTAL_STEPS - 1 }, (_, i) => i + 1).map((v) => (
            <div key={v} style={{ flex: 1, height: 6, borderRadius: 999, background: v < step ? 'var(--ink)' : v === step && step < TOTAL_STEPS ? 'var(--ink)' : 'rgba(34,30,26,0.12)' }} />
          ))}
        </div>

        {/* Step 1 — Upload */}
        {step === 1 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                {uploadType === 'photo' ? 'Загрузите фото' : 'Загрузите план БТИ'}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                {uploadType === 'photo'
                  ? 'Загрузите фотографии комнат — по одной на каждое помещение. Стоимость: 1 токен за фото.'
                  : 'Загрузите скан плана БТИ. Комнаты будут определены автоматически.'}
              </div>
            </div>

            <AccordionSelect label="Тип загрузки" options={UPLOAD_TYPES} value={uploadType} onChange={handleUploadTypeChange} />

            {uploadType === 'bti' && (
              <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(34,30,26,0.04)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                📐 Комнаты будут определены автоматически по вашему плану.
              </div>
            )}

            {uploadType === 'photo' ? (
              <>
                <label htmlFor="upload-photos" style={{ borderRadius: 20, border: '1px dashed var(--line)', minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22, cursor: 'pointer' }}>
                  <div style={{ fontSize: 36, lineHeight: 1 }}>+</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Добавить фото</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>JPG, PNG — до 20 МБ каждое</div>
                </label>
                <input id="upload-photos" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoFilesChange} />

                {photoUrls.length > 0 && (
                  <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(34,30,26,0.05)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    Выбрано фото: {photoUrls.length} · Стоимость: {photoUrls.length} {photoUrls.length === 1 ? 'токен' : photoUrls.length < 5 ? 'токена' : 'токенов'}
                  </div>
                )}

                {photoNames.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {photoNames.map((name, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'rgba(34,30,26,0.03)', border: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>✓ {name}</span>
                        <button type="button" onClick={() => removePhoto(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <label htmlFor="upload-bti" style={{ borderRadius: 20, border: '1px dashed var(--line)', minHeight: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22, cursor: 'pointer', background: btiFile ? 'rgba(40,30,18,0.03)' : 'transparent' }}>
                  <div style={{ fontSize: 36, lineHeight: 1 }}>↓</div>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Выберите файл</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>JPG, PNG, PDF — до 20 МБ</div>
                  {btiFile && <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-2)' }}>{btiFile.name}</div>}
                </label>
                <input id="upload-bti" type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleBtiFileChange} />
              </>
            )}

            {uploading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Загрузка файлов...</div>}
            {!uploading && btiUrl && uploadType === 'bti' && <div style={{ color: 'var(--brand-primary)', fontSize: 13 }}>Файл загружен и готов к анализу.</div>}
          </section>
        )}

        {/* Step 2 — Apartment type */}
        {step === 2 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Тип квартиры</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Укажите тип жилья — это поможет AI подобрать правильную планировку.</div>
            </div>
            <AccordionSelect options={APARTMENT_TYPES} value={apartmentType} onChange={setApartmentType} />
          </section>
        )}

        {/* Step 3 — Room type */}
        {step === 3 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Тип помещения</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Выберите помещение, которое будет визуализировано. Тип влияет на планировку и мебель.</div>
            </div>
            <AccordionSelect options={ROOM_TYPES} value={roomType} onChange={setRoomType} />
          </section>
        )}

        {/* Step 4 — Style & budget */}
        {step === 4 && (
          <section style={{ display: 'grid', gap: 22 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Стиль и бюджет</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Выберите атмосферу и ценовой сегмент.</div>
            </div>
            <AccordionSelect label="Стиль" options={STYLES.map((s) => ({ id: s, label: s }))} value={style} onChange={setStyle} />
            <AccordionSelect label="Бюджет" options={BUDGETS.map((b) => ({ id: b, label: b }))} value={budget} onChange={setBudget} />
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Пожелания к дизайну (необязательно)</span>
              <textarea value={wishes} onChange={(e) => setWishes(e.target.value.slice(0, 500))} placeholder="Например: светлые стены, деревянный пол, больше растений..." rows={4} style={{ width: '100%', minHeight: 100, borderRadius: 16, border: '1px solid var(--line)', padding: 14, resize: 'vertical', background: 'var(--white)', color: 'var(--ink)' }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{wishes.length}/500</div>
            </label>
          </section>
        )}

        {/* Step 5 — Ceiling height */}
        {step === 5 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Высота потолка</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Чем точнее вы укажете высоту, тем стабильнее будет геометрия рендера.</div>
            </div>
            <AccordionSelect options={HEIGHTS.map((h) => ({ id: h, label: h }))} value={height} onChange={setHeight} />
            {height === 'Указать вручную' && (
              <div className="input">
                <input type="number" min="2.0" step="0.05" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} placeholder="Высота в метрах" aria-label="Высота потолка" />
              </div>
            )}
          </section>
        )}

        {/* Step 6 — Confirmation */}
        {step === TOTAL_STEPS && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Подтверждение генерации</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Проверьте параметры перед запуском.</div>
            </div>

            {[
              { label: 'Тип загрузки', value: uploadType === 'photo' ? 'Фото комнаты' : 'План БТИ' },
              { label: 'Тип квартиры', value: APARTMENT_TYPES.find((a) => a.id === apartmentType)?.label ?? apartmentType },
              { label: 'Помещение', value: ROOM_TYPES.find((r) => r.id === roomType)?.label ?? roomType },
              { label: 'Стиль', value: style },
              { label: 'Бюджет', value: budget },
              { label: 'Высота потолка', value: height === 'Указать вручную' ? `${customHeight} м` : height },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(34,30,26,0.07)' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}

            <div style={{ marginTop: 4, padding: 18, borderRadius: 18, background: 'rgba(34,30,26,0.04)', border: '1px solid var(--line)' }}>
              {uploadType === 'bti' ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Стоимость будет рассчитана после анализа плана
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <Row label="Визуализаций" value={String(photoUrls.length)} />
                  <Row label="Стоимость" value={`${tokenCost} ${tokenCost === 1 ? 'токен' : tokenCost < 5 ? 'токена' : 'токенов'}`} />
                  {balanceLoading
                    ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Загружаем баланс...</div>
                    : tokenBalance !== null && (
                      <>
                        <Row label="Ваш баланс" value={tokenBalance === -1 ? '∞ токенов' : `${tokenBalance} токенов`} />
                        {tokenBalance !== -1 && (
                          <Row
                            label="Останется"
                            value={`${tokenBalance - tokenCost} токенов`}
                            valueColor={tokenBalance - tokenCost < 0 ? '#B14A3F' : undefined}
                          />
                        )}
                      </>
                    )
                  }
                </div>
              )}
            </div>

            {insufficientBalance && (
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(177,74,63,0.07)', border: '1px solid rgba(177,74,63,0.2)', fontSize: 13, color: '#B14A3F' }}>
                Недостаточно токенов. Нужно {tokenCost}, у вас {tokenBalance}.{' '}
                <a href="/tokens" style={{ color: '#B14A3F', fontWeight: 700, textDecoration: 'underline' }}>Пополнить токены →</a>
              </div>
            )}
          </section>
        )}

        {error && <div style={{ marginTop: 18, color: '#B14A3F', fontSize: 13 }}>{error}</div>}
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28, display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn--ghost" style={{ flex: 1, height: 52 }} onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || uploading || submitting}>
          Назад
        </button>
        <button
          type="button" className="btn btn--dark btn--block" style={{ flex: 1, height: 52 }}
          disabled={!canAdvance || submitting || (step === TOTAL_STEPS && insufficientBalance)}
          onClick={() => { if (step < TOTAL_STEPS) setStep(step + 1); else confirmGeneration(); }}
        >
          {submitting ? 'Запуск...' : step < TOTAL_STEPS ? 'Далее' : 'Запустить генерацию'}
        </button>
      </div>
    </div>
  );
}

// Small helper to avoid repeating inline styles in the summary rows
function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? 'var(--ink)' }}>{value}</span>
    </div>
  );
}
