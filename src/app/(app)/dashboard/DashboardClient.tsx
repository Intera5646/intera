'use client'

import { useRouter } from 'next/navigation'

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  uploading: 'Загрузка',
  processing: 'В процессе',
  done: 'Готово',
  failed: 'Ошибка',
}

interface Project {
  id: string
  room_type: string
  style: string
  status: string
  created_at: string
  generations?: Array<{
    id: string
    status: string
    render_urls?: string[]
  }>
}

interface DashboardClientProps {
  initialTokenBalance: number
  initialProjects: Project[]
  userName?: string
  userEmail?: string
}

export default function DashboardClient({ initialTokenBalance, initialProjects, userName, userEmail }: DashboardClientProps) {
  const router = useRouter()

  const processedProjects = initialProjects.map((project) => ({
    ...project,
    thumbnail: project.generations?.[0]?.render_urls?.[0] ?? null,
    statusLabel: statusLabels[project.status] ?? project.status,
    date: project.created_at ? new Date(project.created_at).toLocaleDateString('ru-RU') : '',
  }))

  const userIdentifier = userName || userEmail || ''

  return (
    <main className="dashboard-screen" style={{ minHeight: '100vh', background: 'var(--brand-surface)' }}>
      <div className="dashboard-shell" style={{ padding: '34px 24px 60px', maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="serif" style={{ fontSize: 32, fontStyle: 'italic', color: 'var(--brand-primary)' }}>
              Dashboard
            </div>
            <p style={{ marginTop: 10, color: 'var(--muted)', maxWidth: 540, lineHeight: 1.7 }}>
              Ваши проекты и баланс токенов находятся здесь. Начните новый интерьерный проект прямо сейчас.
            </p>
          </div>
          <div>
            <button className="btn btn--brand" style={{ width: 220 }} onClick={() => router.push('/projects/new')}>
              Создать новый проект
            </button>
            {userIdentifier && (
              <div style={{ marginTop: 8, textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                {userIdentifier}{' '}
                <span>·</span>{' '}
                <a href="/api/auth/logout" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Выйти</a>
              </div>
            )}
          </div>
        </div>

        <section style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
          <div className="card" style={{ borderColor: 'rgba(13,27,42,0.08)', background: 'linear-gradient(180deg, #F5F0E8 0%, rgba(245,240,232,0.95) 100%)', padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted)' }}>
                Баланс токенов
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 54, fontWeight: 800, color: 'var(--brand-gold)', lineHeight: 1 }}>
                  {initialTokenBalance}
                </div>
                <div style={{ fontSize: 18, color: 'var(--ink)' }}>токенов</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Баланс обновляется автоматически. Используйте токены для новых генераций.
              </div>
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(13,27,42,0.08)', background: '#fff', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted)' }}>
                  Последние проекты
                </div>
                <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, color: 'var(--brand-primary)' }}>
                  {processedProjects.length}
                </div>
              </div>
              <div className="pill gold" style={{ padding: '10px 16px' }}>
                Последние 6
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--brand-primary)' }}>
                Последние проекты
              </div>
              <p style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.6 }}>
                Быстрый доступ к вашим последним генерациям и результатам.
              </p>
            </div>
            <button
              className="btn btn--ghost"
              style={{ color: 'var(--brand-primary)', borderColor: 'rgba(13,27,42,0.12)' }}
              onClick={() => router.push('/projects')}
            >
              Смотреть все
            </button>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
            {processedProjects.length === 0 ? (
              <div style={{ padding: 24, borderRadius: 20, background: 'rgba(34,30,26,0.05)', color: 'var(--muted)', textAlign: 'center' }}>
                <div>Ваши визуализации появятся здесь.</div>
                <button
                  style={{
                    marginTop: 14,
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'var(--brand-primary)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  onClick={() => router.push('/projects/new')}
                >
                  Создать первый проект
                </button>
              </div>
            ) : (
              processedProjects.map((project: any) => (
                <div
                  key={project.id}
                  className="card"
                  style={{ borderColor: 'rgba(13,27,42,0.08)', padding: '18px', cursor: 'pointer' }}
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 90, height: 90, borderRadius: 18, overflow: 'hidden', background: '#f4f2ee' }}>
                      {project.thumbnail ? (
                        <img src={project.thumbnail} alt={project.style} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--muted)', fontSize: 12 }}>
                          Нет превью
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>{project.style}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>{project.room_type}</div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="pill" style={{ background: 'rgba(13,27,42,0.05)', color: 'var(--ink)' }}>{project.statusLabel}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{project.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
