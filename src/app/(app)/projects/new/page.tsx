'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileEntry {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  uploading: boolean;
  uploadError: boolean;
}

interface SelectOption { id: string; label: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const APARTMENT_TYPES: SelectOption[] = [
  { id: 'studio', label: 'Студия' },
  { id: '1k', label: '1-комнатная' },
  { id: '2k', label: '2-комнатная' },
  { id: '3k', label: '3-комнатная' },
  { id: '4k_plus', label: '4+ комнатная' },
  { id: 'house', label: 'Частный дом' },
];

const ROOM_TYPES: SelectOption[] = [
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

// 4 main steps + 1 confirmation
const TOTAL_STEPS = 5;
const MAIN_STEPS = 4;

// ── AccordionSelect ───────────────────────────────────────────────────────────

function AccordionSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  errorHighlight = false,
}: {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  errorHighlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? (options.find((o) => o.id === value) ?? null) : null;

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
          background: selected ? 'var(--ink)' : 'transparent',
          color: selected ? 'var(--paper)' : 'var(--muted)',
          border: errorHighlight && !selected
            ? '1.5px solid #B14A3F'
            : selected ? '1px solid transparent' : '1px solid var(--line)',
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
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

// ── FileCard ──────────────────────────────────────────────────────────────────

function FileCard({ entry, onRemove }: { entry: FileEntry; onRemove: () => void }) {
  const isPdf = entry.file.type === 'application/pdf'
    || entry.file.name.toLowerCase().endsWith('.pdf');
  const isImage = entry.file.type.startsWith('image/');
  const sizeStr = `${(entry.file.size / 1024 / 1024).toFixed(1)} МБ`;
  const rawName = entry.file.name;
  const displayName = rawName.length > 20 ? rawName.slice(0, 17) + '...' : rawName;

  return (
    <div style={{
      position: 'relative',
      width: 120,
      borderRadius: 14,
      border: entry.uploadError
        ? '1.5px solid rgba(177,74,63,0.45)'
        : '1px solid rgba(34,30,26,0.1)',
      background: '#fff',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Thumbnail */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 90,
        background: '#f4f2ee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {isImage && (
          <img
            src={entry.previewUrl}
            alt={rawName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {isPdf && !isImage && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#B14A3F' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="13" x2="15" y2="13"/>
              <line x1="9" y1="17" x2="13" y2="17"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>PDF</span>
          </div>
        )}
        {!isImage && !isPdf && (
          <span style={{ fontSize: 28 }}>📄</span>
        )}

        {/* Uploading overlay */}
        {entry.uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,255,255,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Загрузка...</span>
          </div>
        )}

        {/* Error overlay */}
        {entry.uploadError && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(177,74,63,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#B14A3F' }}>Ошибка</span>
          </div>
        )}
      </div>

      {/* File info */}
      <div style={{ padding: '6px 8px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
          {displayName}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sizeStr}</div>
      </div>

      {/* Remove × */}
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute',
          top: 5,
          right: 5,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(20,16,12,0.55)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [apartmentType, setApartmentType] = useState('');
  const [step1Attempted, setStep1Attempted] = useState(false);

  // Step 2 state
  const [roomType, setRoomType] = useState('living_room');

  // Step 3 state
  const [style, setStyle] = useState('Скандинавский');
  const [budget, setBudget] = useState('Средний');
  const [wishes, setWishes] = useState('');

  // Step 4 state
  const [height, setHeight] = useState('2.7 м');
  const [customHeight, setCustomHeight] = useState('2.7');

  // Confirmation
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived
  const anyUploading = fileEntries.some((e) => e.uploading);
  const uploadedFiles = fileEntries.filter((e) => e.uploadedUrl && !e.uploadError);
  const tokenCost = uploadedFiles.length;

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { fileEntries.forEach((e) => URL.revokeObjectURL(e.previewUrl)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch balance on confirmation step
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

  // ── File handling ────────────────────────────────────────────────────────────

  const addFiles = async (files: File[]) => {
    const entries: FileEntry[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      uploadedUrl: null,
      uploading: true,
      uploadError: false,
    }));
    setFileEntries((prev) => [...prev, ...entries]);
    setError(null);

    for (const entry of entries) {
      try {
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}-${entry.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { data, error: upErr } = await supabase.storage.from('floor-plans').upload(name, entry.file);
        if (upErr || !data) throw upErr ?? new Error('upload failed');
        const { data: pub } = supabase.storage.from('floor-plans').getPublicUrl(name);
        const uploadedUrl = pub?.publicUrl ?? null;
        setFileEntries((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, uploadedUrl, uploading: false } : e)
        );
      } catch {
        setFileEntries((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, uploading: false, uploadError: true } : e)
        );
      }
    }
  };

  const removeFile = (id: string) => {
    setFileEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  };

  // ── Drag and drop ────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await addFiles(files);
  };
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) await addFiles(files);
    e.target.value = '';
  };

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 1) {
      setStep1Attempted(true);
      if (uploadedFiles.length === 0 || !apartmentType) return;
    }
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      void confirmGeneration();
    }
  };

  // ── Generation ───────────────────────────────────────────────────────────────

  const confirmGeneration = async () => {
    setError(null);
    setSubmitting(true);
    const ceilingHeightValue =
      height === 'Указать вручную' ? Number(customHeight) : Number(height.replace(' м', ''));

    const base = {
      room_type: roomType,
      apartment_type: apartmentType,
      style,
      budget,
      user_wishes: wishes,
      ceiling_height: ceilingHeightValue,
    };

    try {
      const ids: string[] = [];
      for (const entry of uploadedFiles) {
        const isPdf =
          entry.file.type === 'application/pdf' ||
          entry.file.name.toLowerCase().endsWith('.pdf');
        const r = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...base,
            upload_type: isPdf ? 'bti' : 'photo',
            plan_image_url: entry.uploadedUrl,
          }),
        });
        const d = await r.json();
        if (!r.ok || !d.generationId)
          throw new Error(d.error?.message ?? 'Не удалось запустить генерацию.');
        ids.push(d.generationId);
      }
      router.push(ids.length === 1 ? `/projects/${ids[0]}` : '/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании проекта.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Computed validation ───────────────────────────────────────────────────────

  const insufficientBalance =
    tokenBalance !== null && tokenBalance !== -1 && tokenBalance < tokenCost;

  const nextDisabled =
    anyUploading ||
    submitting ||
    (step === TOTAL_STEPS && insufficientBalance);

  // Progress bar fills up to the current main step (capped at MAIN_STEPS)
  const barFilled = Math.min(step, MAIN_STEPS);

  // ── Token plural helper ───────────────────────────────────────────────────────

  const plural = (n: number) => n === 1 ? 'токен' : n < 5 ? 'токена' : 'токенов';

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={() => router.back()}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Новый проект</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Scrollable content — shorter on step 1 to leave room for cost summary */}
      <div style={{
        position: 'absolute',
        top: 120,
        left: 22,
        right: 22,
        bottom: step === 1 ? 172 : 84,
        overflow: 'auto',
      }}>
        {/* Step label + progress bar */}
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--muted)' }}>
          {step === TOTAL_STEPS ? 'Подтверждение генерации' : `Шаг ${step} из ${MAIN_STEPS}`}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {Array.from({ length: MAIN_STEPS }, (_, i) => i + 1).map((v) => (
            <div key={v} style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: v <= barFilled ? 'var(--ink)' : 'rgba(34,30,26,0.12)',
            }} />
          ))}
        </div>

        {/* ── Step 1: Upload + apartment type ─────────────────────────────────── */}
        {step === 1 && (
          <section style={{ display: 'grid', gap: 20 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                Загрузите фото или план
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Добавьте фото комнат или план квартиры — мы определим всё автоматически
              </div>
            </div>

            {/* Drop zone */}
            <label
              htmlFor="file-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 24,
                borderRadius: 20,
                border: isDragging
                  ? '2px dashed var(--ink)'
                  : step1Attempted && uploadedFiles.length === 0
                    ? '1.5px dashed #B14A3F'
                    : '1.5px dashed rgba(34,30,26,0.25)',
                background: isDragging ? 'rgba(34,30,26,0.04)' : 'transparent',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 30, lineHeight: 1 }}>+</div>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>
                Перетащите файлы сюда или нажмите для выбора
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>JPG, PNG, PDF — до 20 МБ каждый</div>
            </label>
            <input
              id="file-upload"
              type="file"
              accept="image/*,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />

            {/* File cards grid */}
            {fileEntries.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {fileEntries.map((entry) => (
                  <FileCard key={entry.id} entry={entry} onRemove={() => removeFile(entry.id)} />
                ))}
              </div>
            )}

            {/* Validation hints */}
            {step1Attempted && !anyUploading && uploadedFiles.length === 0 && (
              <div style={{ fontSize: 13, color: '#B14A3F', marginTop: -6 }}>
                Добавьте хотя бы один файл для продолжения.
              </div>
            )}

            {/* Apartment type */}
            <AccordionSelect
              label="Тип квартиры"
              options={APARTMENT_TYPES}
              value={apartmentType}
              onChange={setApartmentType}
              placeholder="Выберите тип..."
              errorHighlight={step1Attempted && !apartmentType}
            />
            {step1Attempted && !apartmentType && (
              <div style={{ fontSize: 13, color: '#B14A3F', marginTop: -12 }}>
                Укажите тип квартиры.
              </div>
            )}
          </section>
        )}

        {/* ── Step 2: Room type ────────────────────────────────────────────────── */}
        {step === 2 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Тип помещения</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Выберите помещение, которое будет визуализировано. Тип влияет на планировку и мебель.</div>
            </div>
            <AccordionSelect options={ROOM_TYPES} value={roomType} onChange={setRoomType} />
          </section>
        )}

        {/* ── Step 3: Style + budget ───────────────────────────────────────────── */}
        {step === 3 && (
          <section style={{ display: 'grid', gap: 22 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Стиль и бюджет</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Выберите атмосферу и ценовой сегмент.</div>
            </div>
            <AccordionSelect
              label="Стиль"
              options={STYLES.map((s) => ({ id: s, label: s }))}
              value={style}
              onChange={setStyle}
            />
            <AccordionSelect
              label="Бюджет"
              options={BUDGETS.map((b) => ({ id: b, label: b }))}
              value={budget}
              onChange={setBudget}
            />
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Пожелания к дизайну (необязательно)</span>
              <textarea
                value={wishes}
                onChange={(e) => setWishes(e.target.value.slice(0, 500))}
                placeholder="Например: светлые стены, деревянный пол, больше растений..."
                rows={4}
                style={{
                  width: '100%',
                  minHeight: 100,
                  borderRadius: 16,
                  border: '1px solid var(--line)',
                  padding: 14,
                  resize: 'vertical',
                  background: 'var(--white)',
                  color: 'var(--ink)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{wishes.length}/500</div>
            </label>
          </section>
        )}

        {/* ── Step 4: Ceiling height ───────────────────────────────────────────── */}
        {step === 4 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Высота потолка</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Чем точнее вы укажете высоту, тем стабильнее будет геометрия рендера.</div>
            </div>
            <AccordionSelect
              options={HEIGHTS.map((h) => ({ id: h, label: h }))}
              value={height}
              onChange={setHeight}
            />
            {height === 'Указать вручную' && (
              <div className="input">
                <input
                  type="number"
                  min="2.0"
                  step="0.05"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder="Высота в метрах"
                  aria-label="Высота потолка"
                />
              </div>
            )}
          </section>
        )}

        {/* ── Step 5: Confirmation ─────────────────────────────────────────────── */}
        {step === TOTAL_STEPS && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Подтверждение генерации</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Проверьте параметры перед запуском.</div>
            </div>

            {[
              { label: 'Тип квартиры', value: APARTMENT_TYPES.find((a) => a.id === apartmentType)?.label ?? apartmentType },
              { label: 'Помещение', value: ROOM_TYPES.find((r) => r.id === roomType)?.label ?? roomType },
              { label: 'Стиль', value: style },
              { label: 'Бюджет', value: budget },
              { label: 'Высота потолка', value: height === 'Указать вручную' ? `${customHeight} м` : height },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(34,30,26,0.07)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 4,
              padding: 18,
              borderRadius: 18,
              background: 'rgba(34,30,26,0.04)',
              border: '1px solid var(--line)',
              display: 'grid',
              gap: 10,
            }}>
              <SummaryRow label="Файлов загружено" value={String(uploadedFiles.length)} />
              <SummaryRow label="Визуализаций" value={String(tokenCost)} />
              <SummaryRow label="Стоимость" value={`${tokenCost} ${plural(tokenCost)}`} />
              {balanceLoading
                ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Загружаем баланс...</div>
                : tokenBalance !== null && (
                  <>
                    <SummaryRow
                      label="Ваш баланс"
                      value={tokenBalance === -1 ? '∞ токенов' : `${tokenBalance} токенов`}
                    />
                    {tokenBalance !== -1 && (
                      <SummaryRow
                        label="Останется"
                        value={`${tokenBalance - tokenCost} токенов`}
                        valueColor={tokenBalance - tokenCost < 0 ? '#B14A3F' : undefined}
                      />
                    )}
                  </>
                )}
            </div>

            {insufficientBalance && (
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(177,74,63,0.07)',
                border: '1px solid rgba(177,74,63,0.2)',
                fontSize: 13,
                color: '#B14A3F',
              }}>
                Недостаточно токенов. Нужно {tokenCost}, у вас {tokenBalance}.{' '}
                <a href="/tokens" style={{ color: '#B14A3F', fontWeight: 700, textDecoration: 'underline' }}>
                  Пополнить токены →
                </a>
              </div>
            )}
          </section>
        )}

        {error && (
          <div style={{ marginTop: 18, color: '#B14A3F', fontSize: 13 }}>{error}</div>
        )}
      </div>

      {/* ── Cost summary — sticky above buttons, step 1 only ─────────────────── */}
      {step === 1 && (
        <div style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 92,
          padding: '12px 16px',
          borderRadius: 14,
          background: '#F5F0E8',
          border: '1px solid rgba(34,30,26,0.1)',
        }}>
          {fileEntries.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Добавьте хотя бы одно фото для расчёта стоимости
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 7 }}>
              <CostLine icon="📁" text="Загружено файлов" value={fileEntries.length} loading={anyUploading} />
              <CostLine icon="🖼" text="Визуализаций будет создано" value={tokenCost} loading={anyUploading} />
              <CostLine icon="💎" text="Стоимость" value={anyUploading ? '...' : `${tokenCost} ${plural(tokenCost)}`} loading={false} />
            </div>
          )}
        </div>
      )}

      {/* ── Navigation buttons ───────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        left: 22,
        right: 22,
        bottom: 28,
        display: 'flex',
        gap: 10,
      }}>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ flex: 1, height: 52 }}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || submitting}
        >
          Назад
        </button>
        <button
          type="button"
          className="btn btn--dark btn--block"
          style={{ flex: 1, height: 52 }}
          disabled={nextDisabled}
          onClick={handleNext}
        >
          {submitting ? 'Запуск...' : step < TOTAL_STEPS ? 'Далее' : 'Запустить генерацию'}
        </button>
      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function CostLine({
  icon,
  text,
  value,
  loading,
}: {
  icon: string;
  text: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>{text}:</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', opacity: loading ? 0.45 : 1 }}>
        {loading ? '...' : value}
      </span>
    </div>
  );
}
