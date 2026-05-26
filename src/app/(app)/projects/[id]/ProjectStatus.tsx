'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProjectStatusProps = {
  generationId: string;
  initialStatus: string;
  initialRenderUrls: string[];
  initialError: string | null;
};

export default function ProjectStatus({ generationId, initialStatus, initialRenderUrls, initialError }: ProjectStatusProps) {
  const router = useRouter();
  const normalizeRenderUrls = (renders: any[]) => {
    const urls = (renders ?? []).map((r) => (typeof r === 'string' ? r : typeof r?.url === 'function' ? r.url() : r?.url ?? ''));
    return urls.filter(Boolean);
  };

  const [status, setStatus] = useState(initialStatus);
  const [renderUrls, setRenderUrls] = useState<string[]>(normalizeRenderUrls(initialRenderUrls as any));
  const [progress, setProgress] = useState(status === 'done' ? 100 : status === 'failed' ? 0 : 20);
  const [errorMessage, setErrorMessage] = useState(initialError);

  useEffect(() => {
    if (status === 'processing') {
      const interval = window.setInterval(async () => {
        const response = await fetch(`/api/status/${generationId}`);
        if (!response.ok) return;

        const result = await response.json();
        if (result.success) {
          console.log('render_urls:', JSON.stringify(result.render_urls));
          setStatus(result.status);
          setProgress(result.progress ?? (result.status === 'done' ? 100 : 60));
          setRenderUrls(normalizeRenderUrls(result.render_urls ?? []));
          if (result.status === 'failed') {
            setErrorMessage(result.error_message ?? 'Генерация завершилась ошибкой.');
            window.clearInterval(interval);
          }
          if (result.status === 'done') {
            window.clearInterval(interval);
          }
        }
      }, 3000);

      return () => window.clearInterval(interval);
    }
    return undefined;
  }, [generationId, status]);

  return (
    <div className="scr paper" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn" type="button" onClick={() => router.back()}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>
            Проект #{generationId}
          </div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ position: 'absolute', top: 120, left: 22, right: 22, bottom: 20, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Статус генерации</div>
            <div className="serif" style={{ fontSize: 20, color: status === 'done' ? 'var(--ink)' : status === 'failed' ? '#8B2727' : 'var(--mocha)' }}>
              {status === 'done' ? 'Готово' : status === 'processing' ? 'В процессе' : 'Ошибка'}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'right' }}>
            Прогресс: {progress}%
          </div>
        </div>

        <div style={{ height: 12, borderRadius: 999, background: 'rgba(34,30,26,0.1)', marginBottom: 24 }}>
          <div style={{ width: `${Math.min(100, Math.max(0, progress))}%`, height: '100%', borderRadius: 999, background: 'var(--ink)' }} />
        </div>

        {status === 'processing' && (
          <div style={{ padding: 18, borderRadius: 20, background: 'rgba(34,30,26,0.05)', marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
              Мы продолжаем обрабатывать ваш проект. Обычно это занимает около 30–60 секунд.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Анализ плана', 'Создание depth map', 'Генерация рендеров', 'Формирование отчёта'].map((item) => (
                <span key={item} className="pill" style={{ padding: '8px 12px', fontSize: 12, background: 'rgba(255,255,255,0.72)' }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ padding: 18, borderRadius: 20, background: '#F9E2E2', marginBottom: 24, color: '#8B2727' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Генерация не удалась</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>{errorMessage ?? 'Произошла ошибка при обработке запроса.'}</div>
          </div>
        )}

        {status === 'done' && (
          <section style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
            <div className="serif" style={{ fontSize: 22, color: 'var(--ink)', fontStyle: 'italic' }}>
              Готовые рендеры
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {renderUrls.length > 0 ? renderUrls.map((url, index) => (
                <div key={`${url}-${index}`} style={{ position: 'relative', minHeight: 170, borderRadius: 20, overflow: 'hidden', background: '#f4f2ee' }}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`Рендер ${index + 1}`}
                      style={{ width: '100%', cursor: 'pointer' }}
                      onError={() => console.error('Image load error:', url)}
                    />
                  </a>
                  <div style={{ position: 'absolute', left: 14, top: 14, fontSize: 12.5, color: '#fff', textShadow: '0 0 8px rgba(0,0,0,0.4)' }}>Вариант {index + 1}</div>
                </div>
              )) : (
                <div style={{ padding: 18, borderRadius: 20, background: 'rgba(34,30,26,0.05)' }}>
                  Нет готовых рендеров для отображения.
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 28, display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn--ghost" style={{ flex: 1, height: 52 }} onClick={() => router.push('/projects/new')}>
          Изменить параметры
        </button>
        <button type="button" className="btn btn--dark btn--block" style={{ flex: 1, height: 52 }} onClick={() => router.push('/dashboard')}>
          На главную
        </button>
      </div>
    </div>
  );
}
