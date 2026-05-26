import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUserId } from '@/lib/supabase/session';
import { supabaseServer } from '@/lib/supabase/server';

export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  uploading: 'Загрузка',
  processing: 'В процессе',
  done: 'Готово',
  error: 'Ошибка',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'rgba(34,30,26,0.08)',
  uploading: 'rgba(201,168,76,0.2)',
  processing: 'rgba(201,168,76,0.2)',
  done: 'rgba(56,142,60,0.15)',
  error: 'rgba(183,28,28,0.1)',
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  draft: 'var(--muted)',
  uploading: '#6D5500',
  processing: '#6D5500',
  done: '#1B5E20',
  error: '#B71C1C',
};

export default async function ProjectsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const { data: projects, error } = await supabaseServer
    .from('projects')
    .select('id, room_type, style, status, budget_level, created_at, generations(id, status, render_urls)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[ProjectsPage] Query error:', error.message);
  }

  const list = (projects ?? []).map((project) => {
    const gen = Array.isArray(project.generations) ? project.generations[0] : null;
    const thumbnail = Array.isArray(gen?.render_urls) && gen.render_urls.length > 0
      ? (gen.render_urls[0] as string)
      : null;
    const genId = gen?.id ?? null;
    return {
      ...project,
      thumbnail,
      genId,
      statusLabel: STATUS_LABELS[project.status] ?? project.status,
      statusColor: STATUS_COLORS[project.status] ?? 'rgba(34,30,26,0.08)',
      statusTextColor: STATUS_TEXT_COLORS[project.status] ?? 'var(--muted)',
      date: project.created_at
        ? new Date(project.created_at).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : '',
    };
  });

  return (
    <main style={{ minHeight: '100vh', background: 'var(--brand-surface)' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '34px 24px 80px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 28,
          }}
        >
          <div>
            <div
              className="serif"
              style={{ fontSize: 32, fontStyle: 'italic', color: 'var(--brand-primary)' }}
            >
              Мои проекты
            </div>
            <p style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 540 }}>
              Все созданные визуализации. Нажмите на проект, чтобы просмотреть рендеры и детали.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 10,
                border: '1px solid rgba(13,27,42,0.12)',
                color: 'var(--brand-primary)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              ← Dashboard
            </Link>
            <Link
              href="/projects/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 22px',
                borderRadius: 10,
                background: 'var(--brand-accent)',
                color: '#fff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              + Новый проект
            </Link>
          </div>
        </div>

        {list.length === 0 ? (
          <div
            style={{
              padding: 48,
              borderRadius: 20,
              background: 'rgba(34,30,26,0.04)',
              textAlign: 'center',
              color: 'var(--muted)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 8 }}>
              Пока нет проектов
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
              Создайте первый проект — загрузите план БТИ или фото комнаты и получите AI-визуализацию
              интерьера.
            </div>
            <Link
              href="/projects/new"
              style={{
                display: 'inline-flex',
                marginTop: 20,
                padding: '12px 28px',
                borderRadius: 10,
                background: 'var(--brand-primary)',
                color: '#fff',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Создать проект
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {list.map((project) => {
              const href = project.genId ? `/projects/${project.genId}` : '#';
              return (
                <Link
                  key={project.id}
                  href={href}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    gap: 16,
                    alignItems: 'center',
                    padding: 18,
                    borderRadius: 20,
                    border: '1px solid rgba(13,27,42,0.08)',
                    background: '#fff',
                    textDecoration: 'none',
                    transition: 'box-shadow 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 16,
                      overflow: 'hidden',
                      background: 'rgba(34,30,26,0.06)',
                      flexShrink: 0,
                    }}
                  >
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.style}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          fontSize: 28,
                        }}
                      >
                        🏠
                      </div>
                    )}
                  </div>

                  <div>
                    <div
                      style={{ fontSize: 17, fontWeight: 700, color: 'var(--brand-primary)' }}
                    >
                      {project.style}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
                      {project.room_type} · {project.budget_level ?? '—'}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: project.statusColor,
                          color: project.statusTextColor,
                        }}
                      >
                        {project.statusLabel}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{project.date}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
