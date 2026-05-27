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
  { id: 'studio', label: 'Студия' },
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

const RESIDENTS_OPTS: SelectOption[] = [
  { id: '1', label: '1 человек' },
  { id: '2', label: '2 человека' },
  { id: 'family', label: 'Семья с детьми' },
  { id: 'multi', label: 'Несколько жильцов' },
];
const PETS_OPTS: SelectOption[] = [
  { id: 'none', label: 'Нет' },
  { id: 'cat', label: 'Кошка/кот' },
  { id: 'dog', label: 'Собака' },
  { id: 'multi', label: 'Несколько животных' },
];
const WORKSPACE_OPTS: SelectOption[] = [
  { id: 'none', label: 'Нет' },
  { id: 'desk', label: 'Да — один стол' },
  { id: 'full', label: 'Да — полноценный кабинет' },
];
const LIGHTING_OPTS: SelectOption[] = [
  { id: 'warm', label: 'Тёплый свет' },
  { id: 'cool', label: 'Холодный свет' },
  { id: 'mixed', label: 'Смешанный' },
  { id: 'natural', label: 'Много естественного света' },
];

const TOTAL_STEPS = 5; // 4 main + 1 confirmation
const MAIN_STEPS = 4;

// ── Shared storage upload ─────────────────────────────────────────────────────

async function uploadToStorage(file: File): Promise<string> {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { data, error } = await supabase.storage.from('floor-plans').upload(name, file);
  if (error || !data) throw error ?? new Error('upload failed');
  const { data: pub } = supabase.storage.from('floor-plans').getPublicUrl(name);
  return pub?.publicUrl ?? '';
}

function makeEntry(file: File): FileEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    uploadedUrl: null,
    uploading: true,
    uploadError: false,
  };
}

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
  onChange: (v: string) => void;
  placeholder?: string;
  errorHighlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sel = value ? (options.find((o) => o.id === value) ?? null) : null;
  return (
    <div>
      {label && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>}
      <button
        type="button"
        className="pill"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          background: sel ? 'var(--ink)' : 'transparent',
          color: sel ? 'var(--paper)' : 'var(--muted)',
          border: errorHighlight && !sel ? '1.5px solid #B14A3F' : sel ? '1px solid transparent' : '1px solid var(--line)',
        }}
      >
        <span>{sel ? sel.label : placeholder}</span>
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

// ── FileThumb (photo card in grid) ────────────────────────────────────────────

function FileThumb({ entry, onRemove }: { entry: FileEntry; onRemove: () => void }) {
  const isPdf = entry.file.type === 'application/pdf' || entry.file.name.toLowerCase().endsWith('.pdf');
  const isImg = entry.file.type.startsWith('image/');
  const name = entry.file.name.length > 20 ? entry.file.name.slice(0, 17) + '...' : entry.file.name;
  const size = `${(entry.file.size / 1024 / 1024).toFixed(1)} МБ`;
  return (
    <div style={{
      position: 'relative',
      width: 110,
      borderRadius: 12,
      border: entry.uploadError ? '1.5px solid rgba(177,74,63,0.45)' : '1px solid rgba(34,30,26,0.1)',
      background: '#fff',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{ position: 'relative', width: '100%', height: 80, background: '#f4f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {isImg && <img src={entry.previewUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {isPdf && !isImg && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: '#B14A3F' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700 }}>PDF</span>
          </div>
        )}
        {!isImg && !isPdf && <span style={{ fontSize: 24 }}>📄</span>}
        {entry.uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Загрузка...</span>
          </div>
        )}
        {entry.uploadError && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(177,74,63,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#B14A3F' }}>Ошибка</span>
          </div>
        )}
      </div>
      <div style={{ padding: '5px 7px 7px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{name}</div>
        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{size}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute', top: 4, right: 4,
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(20,16,12,0.55)', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
      >×</button>
    </div>
  );
}

// ── UploadBlock ───────────────────────────────────────────────────────────────

function UploadBlock({
  id,
  label,
  subtitle,
  accept,
  multiple,
  isDragging,
  hasError,
  onDragOver,
  onDragLeave,
  onDrop,
  onChange,
  children,
}: {
  id: string;
  label: string;
  subtitle: string;
  accept: string;
  multiple: boolean;
  isDragging: boolean;
  hasError: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      <label
        htmlFor={id}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          padding: '14px 10px',
          borderRadius: 14,
          border: isDragging ? '2px dashed var(--ink)' : hasError ? '1.5px dashed #B14A3F' : '1.5px dashed rgba(34,30,26,0.25)',
          background: isDragging ? 'rgba(34,30,26,0.04)' : 'transparent',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          textAlign: 'center',
          minHeight: 80,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Нажмите или перетащите</span>
      </label>
      <input id={id} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }} onChange={onChange} />
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // ── Step 1: uploads + apartment type ──────────────────────────────────────

  const [photoEntries, setPhotoEntries] = useState<FileEntry[]>([]);
  const [btiEntry, setBtiEntry] = useState<FileEntry | null>(null);
  const [btiAnalyzing, setBtiAnalyzing] = useState(false);
  const [btiRoomCount, setBtiRoomCount] = useState<number | null>(null);
  const [btiRooms, setBtiRooms] = useState<string[]>([]);
  const [btiRoomsJson, setBtiRoomsJson] = useState('');
  const [btiAnalysisError, setBtiAnalysisError] = useState(false);
  const [dragPhoto, setDragPhoto] = useState(false);
  const [dragBti, setDragBti] = useState(false);
  const [apartmentType, setApartmentType] = useState('');
  const [step1Attempted, setStep1Attempted] = useState(false);

  // ── Step 2: room types per photo ──────────────────────────────────────────

  const [photoRoomTypes, setPhotoRoomTypes] = useState<Record<string, string>>({});

  // ── Step 3: style + budget + personalization ──────────────────────────────

  const [style, setStyle] = useState('Скандинавский');
  const [budget, setBudget] = useState('Средний');
  const [wishes, setWishes] = useState('');
  const [residents, setResidents] = useState('');
  const [hasPets, setHasPets] = useState('');
  const [needsWorkspace, setNeedsWorkspace] = useState('');
  const [lightingPref, setLightingPref] = useState('');
  const [dislikedColors, setDislikedColors] = useState('');

  // ── Step 4: ceiling height ────────────────────────────────────────────────

  const [height, setHeight] = useState('2.7 м');
  const [customHeight, setCustomHeight] = useState('2.7');

  // ── Confirmation ──────────────────────────────────────────────────────────

  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  const uploadedPhotos = photoEntries.filter((e) => e.uploadedUrl && !e.uploadError);
  const hasBtiFile = !!(btiEntry?.uploadedUrl && !btiEntry.uploadError);
  const anyUploading = photoEntries.some((e) => e.uploading) || btiEntry?.uploading === true;

  const photoCost = uploadedPhotos.length;
  const btiCost = hasBtiFile ? (btiRoomCount ?? 1) : 0;
  const tokenCost = photoCost + btiCost;

  // Which actual step numbers exist in the flow (step 2 skipped when BTI present)
  const hasBtiFlow = hasBtiFile;
  const skipStep2 = hasBtiFlow;

  // Visual progress 1–4 regardless of skipped steps
  const visualProgress = (() => {
    if (step >= TOTAL_STEPS) return MAIN_STEPS;
    const map = skipStep2 ? [1, 3, 4] : [1, 2, 3, 4];
    const idx = map.indexOf(step);
    return idx >= 0 ? idx + 1 : 1;
  })();

  // ── Cleanup object URLs on unmount ────────────────────────────────────────

  useEffect(() => {
    return () => {
      photoEntries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
      if (btiEntry) URL.revokeObjectURL(btiEntry.previewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch balance on confirmation step ────────────────────────────────────

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

  // ── Initialise room type defaults for newly uploaded photos ──────────────

  useEffect(() => {
    setPhotoRoomTypes((prev) => {
      const next = { ...prev };
      uploadedPhotos.forEach((e) => {
        if (!next[e.id]) next[e.id] = 'living_room';
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedPhotos.map((e) => e.id).join(',')]);

  // ── Photo upload handlers ─────────────────────────────────────────────────

  const addPhotoFiles = async (files: File[]) => {
    const entries = files.map(makeEntry);
    setPhotoEntries((prev) => [...prev, ...entries]);
    setError(null);
    for (const entry of entries) {
      try {
        const url = await uploadToStorage(entry.file);
        setPhotoEntries((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, uploadedUrl: url, uploading: false } : e)
        );
      } catch {
        setPhotoEntries((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, uploading: false, uploadError: true } : e)
        );
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotoEntries((prev) => {
      const e = prev.find((x) => x.id === id);
      if (e) URL.revokeObjectURL(e.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    setPhotoRoomTypes((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  // ── BTI upload handler ────────────────────────────────────────────────────

  const handleBtiFile = async (file: File) => {
    if (btiEntry) URL.revokeObjectURL(btiEntry.previewUrl);
    setBtiRoomCount(null);
    setBtiRooms([]);
    setBtiAnalysisError(false);
    setBtiAnalyzing(false);
    const entry = makeEntry(file);
    setBtiEntry(entry);
    setError(null);

    try {
      const url = await uploadToStorage(file);
      setBtiEntry((prev) => prev ? { ...prev, uploadedUrl: url, uploading: false } : null);

      // Immediately start floor-plan analysis
      setBtiAnalyzing(true);
      try {
        const r = await fetch('/api/analyze-floor-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: url }),
        });
        const d = await r.json() as { success: boolean; roomCount?: number; rooms?: unknown[]; room_names?: string[] };
        if (d.success && d.roomCount && d.roomCount > 0) {
          setBtiRoomCount(Math.max(1, d.roomCount));
          setBtiRooms(Array.isArray(d.room_names) ? d.room_names : []);
          setBtiRoomsJson(JSON.stringify(d.rooms ?? []));
        } else {
          setBtiRoomCount(1);
          setBtiRooms([]);
          setBtiRoomsJson('');
          if (!d.success) setBtiAnalysisError(true);
        }
      } catch {
        setBtiRoomCount(1);
        setBtiRooms([]);
        setBtiAnalysisError(true);
      } finally {
        setBtiAnalyzing(false);
      }
    } catch {
      setBtiEntry((prev) => prev ? { ...prev, uploading: false, uploadError: true } : null);
    }
  };

  const removeBti = () => {
    if (btiEntry) URL.revokeObjectURL(btiEntry.previewUrl);
    setBtiEntry(null);
    setBtiRoomCount(null);
    setBtiRooms([]);
    setBtiRoomsJson('');
    setBtiAnalyzing(false);
    setBtiAnalysisError(false);
  };

  // ── Drag helpers ──────────────────────────────────────────────────────────

  const mkDrag = (setDrag: (v: boolean) => void, onFiles: (fs: File[]) => void) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDrag(true); },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); setDrag(false); },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault(); setDrag(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) await onFiles(files);
    },
  });

  const photoDrag = mkDrag(setDragPhoto, addPhotoFiles);
  const btiDragHandlers = mkDrag(setDragBti, (files) => handleBtiFile(files[0]));

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 1) {
      setStep1Attempted(true);
      const hasAnyFile = uploadedPhotos.length > 0 || hasBtiFile;
      if (!hasAnyFile || !apartmentType || btiAnalyzing) return;
    }
    const nextStep = step === 1 && skipStep2 ? 3
      : step < TOTAL_STEPS ? step + 1
      : null;
    if (nextStep) setStep(nextStep);
    else void confirmGeneration();
  };

  const handleBack = () => {
    if (step === 3 && skipStep2) setStep(1);
    else setStep((s) => Math.max(1, s - 1));
  };

  // ── Confirm generation ────────────────────────────────────────────────────

  const confirmGeneration = async () => {
    setError(null);
    setSubmitting(true);
    const ceilVal =
      height === 'Указать вручную' ? Number(customHeight) : Number(height.replace(' м', ''));
    const base = {
      apartment_type: apartmentType,
      style,
      budget,
      user_wishes: wishes,
      ceiling_height: ceilVal,
      residents: residents || undefined,
      has_pets: hasPets || undefined,
      needs_workspace: needsWorkspace || undefined,
      lighting_preference: lightingPref || undefined,
      disliked_colors: dislikedColors || undefined,
    };

    try {
      const ids: string[] = [];

      // One call per photo
      for (const entry of uploadedPhotos) {
        const room_type = photoRoomTypes[entry.id] || 'living_room';
        const r = await fetch('/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, room_type, upload_type: hasBtiFile ? 'combined' : 'photo', plan_image_url: entry.uploadedUrl }),
        });
        const d = await r.json();
        if (!r.ok || !d.generationId) throw new Error(d.error?.message ?? 'Ошибка генерации.');
        ids.push(d.generationId);
      }

      // One call for BTI
      if (btiEntry?.uploadedUrl) {
        const r = await fetch('/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...base,
            room_type: 'auto',
            upload_type: uploadedPhotos.length > 0 ? 'combined' : 'bti',
            plan_image_url: btiEntry.uploadedUrl,
            room_count: btiCost,
            detected_rooms_json: btiRoomsJson || undefined,
          }),
        });
        const d = await r.json();
        if (!r.ok || !d.generationId) throw new Error(d.error?.message ?? 'Ошибка генерации.');
        ids.push(d.generationId);
      }

      router.push(ids.length === 1 ? `/projects/${ids[0]}` : '/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании проекта.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const insufficientBalance = tokenBalance !== null && tokenBalance !== -1 && tokenBalance < tokenCost;
  const nextDisabled = anyUploading || submitting || btiAnalyzing || (step === TOTAL_STEPS && insufficientBalance);
  const plural = (n: number) => n === 1 ? 'токен' : n < 5 ? 'токена' : 'токенов';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={() => router.back()}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Новый проект</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        position: 'absolute', top: 120, left: 22, right: 22,
        bottom: step === 1 ? 172 : 84,
        overflow: 'auto',
      }}>
        {/* Progress */}
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--muted)' }}>
          {step === TOTAL_STEPS ? 'Подтверждение генерации' : `Шаг ${visualProgress} из ${MAIN_STEPS}`}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {Array.from({ length: MAIN_STEPS }, (_, i) => i + 1).map((v) => (
            <div key={v} style={{ flex: 1, height: 6, borderRadius: 999, background: v <= visualProgress ? 'var(--ink)' : 'rgba(34,30,26,0.12)' }} />
          ))}
        </div>

        {/* ── STEP 1: Upload blocks + apartment type ─────────────────────────── */}
        {step === 1 && (
          <section style={{ display: 'grid', gap: 20 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>
                Загрузите фото или план
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                Добавьте фото комнат или план квартиры — мы определим всё автоматически
              </div>
            </div>

            {/* Two upload blocks side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Photo block */}
              <UploadBlock
                id="photo-upload"
                label="Фото комнат"
                subtitle="Загрузите фото каждой комнаты отдельно"
                accept="image/jpeg,image/png,image/webp"
                multiple
                isDragging={dragPhoto}
                hasError={step1Attempted && uploadedPhotos.length === 0 && !hasBtiFile}
                {...photoDrag}
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) await addPhotoFiles(files);
                  e.target.value = '';
                }}
              />

              {/* BTI block */}
              <UploadBlock
                id="bti-upload"
                label="План квартиры"
                subtitle="Загрузите план — комнаты определятся автоматически"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple={false}
                isDragging={dragBti}
                hasError={false}
                {...btiDragHandlers}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handleBtiFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Photo thumbnails grid */}
            {photoEntries.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {photoEntries.map((entry) => (
                  <FileThumb key={entry.id} entry={entry} onRemove={() => removePhoto(entry.id)} />
                ))}
              </div>
            )}

            {/* BTI preview + analysis result */}
            {btiEntry && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(34,30,26,0.1)',
                background: '#fff',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: '#f4f2ee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {btiEntry.file.type.startsWith('image/') ? (
                    <img src={btiEntry.previewUrl} alt="plan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 22 }}>📄</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                    {btiEntry.file.name.length > 24 ? btiEntry.file.name.slice(0, 21) + '...' : btiEntry.file.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                    {btiEntry.uploading && 'Загрузка...'}
                    {btiEntry.uploading && 'Загрузка...'}
                    {!btiEntry.uploading && btiAnalyzing && '🔍 Анализируем план...'}
                    {!btiEntry.uploading && !btiAnalyzing && btiRoomCount !== null && (
                      <span style={{ color: '#1B5E20' }}>
                        ✅ Обнаружено {btiRoomCount} {btiRoomCount === 1 ? 'комната' : btiRoomCount < 5 ? 'комнаты' : 'комнат'}
                        {btiRooms.length > 0 && (
                          <span style={{ color: '#2E7D32' }}>: {btiRooms.join(', ')}</span>
                        )}
                      </span>
                    )}
                    {btiEntry.uploadError && <span style={{ color: '#B14A3F' }}>Ошибка загрузки</span>}
                    {!btiEntry.uploading && !btiAnalyzing && btiAnalysisError && btiRoomCount === null && (
                      <span style={{ color: '#B14A3F' }}>Анализ не удался — используем 1 комнату</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeBti}
                  disabled={btiEntry.uploading || btiAnalyzing}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: '0 4px', opacity: (btiEntry.uploading || btiAnalyzing) ? 0.4 : 1 }}
                >×</button>
              </div>
            )}

            {/* Validation hints */}
            {step1Attempted && !anyUploading && uploadedPhotos.length === 0 && !hasBtiFile && (
              <div style={{ fontSize: 13, color: '#B14A3F' }}>Добавьте хотя бы одно фото или план.</div>
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
              <div style={{ fontSize: 13, color: '#B14A3F', marginTop: -12 }}>Укажите тип квартиры.</div>
            )}
          </section>
        )}

        {/* ── STEP 2: Room types (skipped if BTI present) ───────────────────── */}
        {step === 2 && !skipStep2 && (
          <section style={{ display: 'grid', gap: 20 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Тип помещения</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                {uploadedPhotos.length > 1
                  ? 'Укажите тип для каждого загруженного фото.'
                  : 'Выберите помещение, которое будет визуализировано.'}
              </div>
            </div>

            {uploadedPhotos.length <= 1 ? (
              // Single selector
              <AccordionSelect
                options={ROOM_TYPES}
                value={photoRoomTypes[uploadedPhotos[0]?.id] ?? 'living_room'}
                onChange={(v) => uploadedPhotos[0] && setPhotoRoomTypes((p) => ({ ...p, [uploadedPhotos[0].id]: v }))}
              />
            ) : (
              // Multiple selectors with thumbnails
              <div style={{ display: 'grid', gap: 14 }}>
                {uploadedPhotos.map((entry, idx) => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(34,30,26,0.1)', background: '#fff' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: '#f4f2ee', flexShrink: 0 }}>
                      <img src={entry.previewUrl} alt={`Фото ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Фото {idx + 1}</div>
                      <AccordionSelect
                        options={ROOM_TYPES}
                        value={photoRoomTypes[entry.id] ?? 'living_room'}
                        onChange={(v) => setPhotoRoomTypes((p) => ({ ...p, [entry.id]: v }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STEP 3: Style + budget + personalization ──────────────────────── */}
        {step === 3 && (
          <section style={{ display: 'grid', gap: 20 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Стиль и предпочтения</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Помогите нам подобрать идеальный дизайн.</div>
            </div>
            <AccordionSelect label="Стиль" options={STYLES.map((s) => ({ id: s, label: s }))} value={style} onChange={setStyle} />
            <AccordionSelect label="Бюджет" options={BUDGETS.map((b) => ({ id: b, label: b }))} value={budget} onChange={setBudget} />

            <div style={{ height: 1, background: 'rgba(34,30,26,0.08)', margin: '4px 0' }} />
            <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Уточнения (необязательно)</div>

            <AccordionSelect label="Количество проживающих" options={RESIDENTS_OPTS} value={residents} onChange={setResidents} placeholder="Не указано" />
            <AccordionSelect label="Есть ли домашние животные?" options={PETS_OPTS} value={hasPets} onChange={setHasPets} placeholder="Не указано" />
            <AccordionSelect label="Нужно ли рабочее место?" options={WORKSPACE_OPTS} value={needsWorkspace} onChange={setNeedsWorkspace} placeholder="Не указано" />
            <AccordionSelect label="Предпочтения по освещению" options={LIGHTING_OPTS} value={lightingPref} onChange={setLightingPref} placeholder="Не указано" />

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Есть ли цвета, которые не нравятся?</span>
              <input
                type="text"
                value={dislikedColors}
                onChange={(e) => setDislikedColors(e.target.value.slice(0, 200))}
                placeholder="Например: не люблю оранжевый, тёмно-коричневый..."
                style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', background: 'var(--white)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Пожелания к дизайну (необязательно)</span>
              <textarea
                value={wishes}
                onChange={(e) => setWishes(e.target.value.slice(0, 500))}
                placeholder="Например: светлые стены, деревянный пол, больше растений..."
                rows={3}
                style={{ width: '100%', minHeight: 80, borderRadius: 14, border: '1px solid var(--line)', padding: 14, resize: 'vertical', background: 'var(--white)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{wishes.length}/500</div>
            </label>
          </section>
        )}

        {/* ── STEP 4: Ceiling height ────────────────────────────────────────── */}
        {step === 4 && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Высота потолка</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Чем точнее укажете, тем стабильнее геометрия рендера.</div>
            </div>
            <AccordionSelect options={HEIGHTS.map((h) => ({ id: h, label: h }))} value={height} onChange={setHeight} />
            {height === 'Указать вручную' && (
              <div className="input">
                <input type="number" min="2.0" step="0.05" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} placeholder="Высота в метрах" />
              </div>
            )}
          </section>
        )}

        {/* ── STEP 5: Confirmation ──────────────────────────────────────────── */}
        {step === TOTAL_STEPS && (
          <section style={{ display: 'grid', gap: 18 }}>
            <div>
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', color: 'var(--ink)' }}>Подтверждение генерации</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>Проверьте параметры перед запуском.</div>
            </div>

            {[
              { label: 'Тип квартиры', value: APARTMENT_TYPES.find((a) => a.id === apartmentType)?.label ?? apartmentType },
              { label: 'Стиль', value: style },
              { label: 'Бюджет', value: budget },
              { label: 'Высота потолка', value: height === 'Указать вручную' ? `${customHeight} м` : height },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(34,30,26,0.07)' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}

            <div style={{ padding: 18, borderRadius: 18, background: 'rgba(34,30,26,0.04)', border: '1px solid var(--line)', display: 'grid', gap: 10 }}>
              {uploadedPhotos.length > 0 && <ConfRow label="Фото комнат" value={String(uploadedPhotos.length)} />}
              {hasBtiFile && <ConfRow label="Комнат по плану" value={String(btiCost)} />}
              <ConfRow label="Визуализаций" value={String(tokenCost)} />
              <ConfRow label="Стоимость" value={`${tokenCost} ${plural(tokenCost)}`} />
              {balanceLoading
                ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Загружаем баланс...</div>
                : tokenBalance !== null && (
                  <>
                    <ConfRow label="Ваш баланс" value={tokenBalance === -1 ? '∞ токенов' : `${tokenBalance} токенов`} />
                    {tokenBalance !== -1 && <ConfRow label="Останется" value={`${tokenBalance - tokenCost} токенов`} valueColor={tokenBalance - tokenCost < 0 ? '#B14A3F' : undefined} />}
                  </>
                )}
            </div>

            {insufficientBalance && (
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(177,74,63,0.07)', border: '1px solid rgba(177,74,63,0.2)', fontSize: 13, color: '#B14A3F' }}>
                Недостаточно токенов. Нужно {tokenCost}, у вас {tokenBalance}.{' '}
                <a href="/tokens" style={{ color: '#B14A3F', fontWeight: 700, textDecoration: 'underline' }}>Пополнить →</a>
              </div>
            )}
          </section>
        )}

        {error && <div style={{ marginTop: 18, color: '#B14A3F', fontSize: 13 }}>{error}</div>}
      </div>

      {/* Cost summary — step 1 only */}
      {step === 1 && (
        <div style={{ position: 'absolute', left: 22, right: 22, bottom: 92, padding: '11px 16px', borderRadius: 14, background: '#F5F0E8', border: '1px solid rgba(34,30,26,0.1)' }}>
          {tokenCost === 0 && !anyUploading && !btiAnalyzing ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Добавьте хотя бы одно фото для расчёта стоимости</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>📁 Файлов: <b style={{ color: 'var(--ink)' }}>{(anyUploading || btiAnalyzing) ? '...' : String(photoEntries.filter(e => !e.uploadError).length + (hasBtiFile ? 1 : 0))}</b></span>
              <span style={{ color: 'rgba(34,30,26,0.2)' }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>🖼 Визуализаций: <b style={{ color: 'var(--ink)' }}>{(anyUploading || btiAnalyzing) ? '...' : String(tokenCost)}</b></span>
              <span style={{ color: 'rgba(34,30,26,0.2)' }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>💎 Стоимость: <b style={{ color: 'var(--ink)' }}>{(anyUploading || btiAnalyzing) ? '...' : `${tokenCost} ${plural(tokenCost)}`}</b></span>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28, display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn--ghost" style={{ flex: 1, height: 52 }} onClick={handleBack} disabled={step === 1 || submitting}>Назад</button>
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

// ── Helper components ─────────────────────────────────────────────────────────

function ConfRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? 'var(--ink)' }}>{value}</span>
    </div>
  );
}
