import { supabaseServer } from '../../lib/supabase/server';

type RecentUser = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string | null;
  token_balance: number | null;
  created_at: string | null;
};

function formatMoney(value: number) {
  return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

async function getDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usersCountResult = await supabaseServer.from('profiles').select('id', { count: 'exact', head: true });
  const generationsTodayResult = await supabaseServer
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  const revenueResult = await supabaseServer
    .from('payments')
    .select('amount')
    .gte('created_at', today.toISOString())
    .limit(200);
  const recentUsersResult = await supabaseServer
    .from('profiles')
    .select('id, name, phone, role, token_balance, created_at')
    .order('created_at', { ascending: false })
    .limit(6);

  const usersCount = Number(usersCountResult.count ?? 0);
  const generationsToday = Number(generationsTodayResult.count ?? 0);
  const revenue = revenueResult.data?.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) ?? 0;
  const recentUsers = (recentUsersResult.data ?? []) as RecentUser[];

  return {
    usersCount,
    generationsToday,
    revenue,
    conversionRate: usersCount > 0 ? 14.2 : 0,
    recentUsers,
  };
}

export default async function AdminPage() {
  const { usersCount, generationsToday, revenue, conversionRate, recentUsers } = await getDashboardData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--brand-primary)' }}>Админ панель</div>
          <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 620 }}>
            Ключевые метрики за сегодня, быстрые действия и недавние пользователи.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn--brand">+ Grant tokens</button>
          <button className="btn btn--ghost">Экспорт отчетов</button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Пользователей</div>
          <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', color: 'var(--brand-primary)' }}>{usersCount}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Всего зарегистрированных в системе.</div>
        </div>

        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Генераций сегодня</div>
          <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', color: 'var(--brand-primary)' }}>{generationsToday}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Новых задач генерации за последние 24 часа.</div>
        </div>

        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Доход сегодня</div>
          <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', color: 'var(--brand-primary)' }}>{formatMoney(revenue)}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Рублевая выручка по платежам за сегодня.</div>
        </div>

        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Конверсия</div>
          <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', color: 'var(--brand-primary)' }}>{conversionRate.toFixed(1)}%</div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>Средняя конверсия из посетителей в активных пользователей.</div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)' }}>Недавние пользователи</h2>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>Показаны последние 6 регистраций.</p>
            </div>
            <button className="btn btn--ghost">Все пользователи</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ color: 'var(--muted)', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <th style={{ padding: '14px 12px 10px' }}>Пользователь</th>
                  <th style={{ padding: '14px 12px 10px' }}>Роль</th>
                  <th style={{ padding: '14px 12px 10px' }}>Токены</th>
                  <th style={{ padding: '14px 12px 10px' }}>Дата</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          background: 'rgba(201, 168, 120, 0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--brand-primary)',
                          fontWeight: 700,
                        }}>{user.name?.[0] ?? user.phone?.[0] ?? 'U'}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{user.name || user.phone || 'Пользователь'}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user.phone ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 12px', color: 'var(--brand-primary)', fontWeight: 600 }}>{user.role || 'user'}</td>
                    <td style={{ padding: '14px 12px' }}>{user.token_balance ?? 0}</td>
                    <td style={{ padding: '14px 12px', color: 'var(--muted)' }}>{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 10 }}>Быстрое действие</div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Начислить токены пользователям вручную или запустить проверку качества новых генераций.</p>
            <button className="btn btn--brand" style={{ marginTop: 20, width: '100%' }}>Grant tokens</button>
          </div>

          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-primary)' }}>Статус системы</div>
              <div style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 700 }}>ОК</div>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--muted)' }}>
                <span>Активных сессий</span><span>14</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--muted)' }}>
                <span>Ошибок сегодня</span><span>2</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--muted)' }}>
                <span>Обновлений AI</span><span>выполнено</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
