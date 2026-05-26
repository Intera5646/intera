import { supabaseServer } from '../../../lib/supabase/server';

export const revalidate = 0;

type UserRow = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  plan: string | null;
  token_balance: number | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default async function AdminUsersPage() {
  const [usersResult, statsResult] = await Promise.all([
    supabaseServer
      .from('profiles')
      .select('id, name, phone, role, plan, token_balance, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseServer.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const users = (usersResult.data ?? []) as UserRow[];
  const totalCount = Number(statsResult.count ?? 0);

  const admins = users.filter((u) => u.role === 'admin').length;
  const activeUsers = users.filter((u) => (u.token_balance ?? 0) > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header>
        <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--brand-primary)' }}>
          Пользователи
        </div>
        <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 620 }}>
          Все зарегистрированные аккаунты. Показаны последние 100.
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {[
          { label: 'Всего пользователей', value: totalCount },
          { label: 'Активных (с токенами)', value: activeUsers },
          { label: 'Администраторов', value: admins },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              padding: 22,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{stat.label}</div>
            <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', color: 'var(--brand-primary)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 18 }}>
          Список пользователей
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead>
              <tr
                style={{
                  color: 'var(--muted)',
                  textAlign: 'left',
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                <th style={{ padding: '12px 14px 10px' }}>Пользователь</th>
                <th style={{ padding: '12px 14px 10px' }}>Телефон</th>
                <th style={{ padding: '12px 14px 10px' }}>Роль</th>
                <th style={{ padding: '12px 14px 10px' }}>Тариф</th>
                <th style={{ padding: '12px 14px 10px' }}>Токены</th>
                <th style={{ padding: '12px 14px 10px' }}>Дата</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: user.role === 'admin'
                            ? 'rgba(232,93,58,0.15)'
                            : 'rgba(201,168,120,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: user.role === 'admin' ? 'var(--brand-accent)' : 'var(--brand-primary)',
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {(user.name?.[0] ?? user.phone?.[0] ?? 'U').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--brand-primary)', fontSize: 14 }}>
                          {user.name ?? '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                          {user.id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px', color: 'var(--muted)', fontSize: 13 }}>
                    {user.phone ? `+${user.phone}` : '—'}
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: user.role === 'admin'
                          ? 'rgba(232,93,58,0.12)'
                          : 'rgba(13,27,42,0.06)',
                        color: user.role === 'admin' ? 'var(--brand-accent)' : 'var(--brand-primary)',
                      }}
                    >
                      {user.role ?? 'user'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--muted)' }}>
                    {user.plan ?? 'free'}
                  </td>
                  <td style={{ padding: '14px 14px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                    {user.token_balance === -1 ? '∞' : (user.token_balance ?? 0)}
                  </td>
                  <td style={{ padding: '14px 14px', color: 'var(--muted)', fontSize: 13 }}>
                    {formatDate(user.created_at)}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                    Пользователей нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
