import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUserId } from '@/lib/supabase/session';
import { supabaseServer } from '@/lib/supabase/server';

export const revalidate = 0;

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const { data: profile, error } = await supabaseServer
    .from('profiles')
    .select('id, name, phone, role, plan, token_balance, created_at')
    .eq('id', userId)
    .single();

  if (error || !profile) redirect('/login');

  const { data: authUser } = await supabaseServer.auth.admin.getUserById(userId);
  const email = authUser?.user?.email ?? null;

  const { count: projectsCount } = await supabaseServer
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: generationsCount } = await supabaseServer
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .in(
      'project_id',
      (
        await supabaseServer
          .from('projects')
          .select('id')
          .eq('user_id', userId)
      ).data?.map((p) => p.id) ?? []
    );

  const isAdmin = profile.role === 'admin';
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <main style={{ minHeight: '100vh', background: 'var(--brand-surface)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '34px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <Link
            href="/dashboard"
            style={{
              color: 'var(--muted)',
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            ← Dashboard
          </Link>
        </div>

        <div className="serif" style={{ fontSize: 32, fontStyle: 'italic', color: 'var(--brand-primary)', marginBottom: 28 }}>
          Профиль
        </div>

        {/* Avatar + name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 28,
            padding: 24,
            borderRadius: 20,
            background: '#fff',
            border: '1px solid rgba(13,27,42,0.08)',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 28,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(profile.name?.[0] ?? email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-primary)' }}>
              {profile.name ?? 'Пользователь'}
            </div>
            {email && (
              <div style={{ marginTop: 4, fontSize: 14, color: 'var(--muted)' }}>{email}</div>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isAdmin && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: 'rgba(232,93,58,0.15)',
                    color: 'var(--brand-accent)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  ADMIN
                </span>
              )}
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: 'rgba(201,168,76,0.15)',
                  color: '#6D5500',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {profile.plan === 'admin' ? 'Безлимит' : profile.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            { label: 'Токенов', value: isAdmin ? '∞' : String(profile.token_balance ?? 0), gold: true },
            { label: 'Проектов', value: String(projectsCount ?? 0), gold: false },
            { label: 'Генераций', value: String(generationsCount ?? 0), gold: false },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '18px 16px',
                borderRadius: 16,
                background: '#fff',
                border: '1px solid rgba(13,27,42,0.08)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: stat.gold ? 'var(--brand-gold)' : 'var(--brand-primary)',
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Account info */}
        <div
          style={{
            padding: 24,
            borderRadius: 20,
            background: '#fff',
            border: '1px solid rgba(13,27,42,0.08)',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 16 }}>
            Данные аккаунта
          </div>
          {[
            { label: 'Имя', value: profile.name ?? '—' },
            { label: 'Email', value: email ?? '—' },
            { label: 'Телефон', value: profile.phone ? `+${profile.phone}` : '—' },
            { label: 'Роль', value: profile.role ?? 'user' },
            { label: 'В системе с', value: memberSince },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '11px 0',
                borderBottom: '1px solid rgba(13,27,42,0.06)',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>{row.label}</span>
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--brand-primary)',
                  fontWeight: 500,
                  textAlign: 'right',
                  wordBreak: 'break-word',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/tokens"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: 14,
              background: '#fff',
              border: '1px solid rgba(13,27,42,0.08)',
              textDecoration: 'none',
              color: 'var(--brand-primary)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Пополнить токены</span>
            <span style={{ color: 'var(--muted)' }}>→</span>
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: 14,
                background: 'rgba(232,93,58,0.05)',
                border: '1px solid rgba(232,93,58,0.15)',
                textDecoration: 'none',
                color: 'var(--brand-accent)',
              }}
            >
              <span style={{ fontWeight: 600 }}>Перейти в Admin Panel</span>
              <span>→</span>
            </Link>
          )}
          <a
            href="/api/auth/logout"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: 14,
              background: 'rgba(183,28,28,0.04)',
              border: '1px solid rgba(183,28,28,0.1)',
              textDecoration: 'none',
              color: '#B71C1C',
            }}
          >
            <span style={{ fontWeight: 600 }}>Выйти из аккаунта</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </main>
  );
}
