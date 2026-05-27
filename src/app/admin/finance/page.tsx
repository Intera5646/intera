import { supabaseServer } from '../../../lib/supabase/server';

export const revalidate = 0;

function formatMoney(value: number) {
  return value.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'rgba(201,168,76,0.2)',
  succeeded: 'rgba(56,142,60,0.15)',
  canceled: 'rgba(34,30,26,0.08)',
  refunded: 'rgba(183,28,28,0.1)',
};

const STATUS_TEXT: Record<string, string> = {
  pending: '#6D5500',
  succeeded: '#1B5E20',
  canceled: 'var(--muted)',
  refunded: '#B71C1C',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  succeeded: 'Успешно',
  canceled: 'Отменён',
  refunded: 'Возврат',
};

export default async function AdminFinancePage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    allPaymentsResult,
    todayPaymentsResult,
    monthPaymentsResult,
    recentPaymentsResult,
  ] = await Promise.all([
    supabaseServer
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded'),
    supabaseServer
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded')
      .gte('created_at', today.toISOString()),
    supabaseServer
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded')
      .gte('created_at', thisMonthStart),
    supabaseServer
      .from('payments')
      .select('id, user_id, yukassa_id, amount, tokens_granted, package_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const totalRevenue = (allPaymentsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const todayRevenue = (todayPaymentsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const monthRevenue = (monthPaymentsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  const recentPayments = recentPaymentsResult.data ?? [];
  const successCount = recentPayments.filter((p) => p.status === 'succeeded').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header>
        <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--brand-primary)' }}>
          Финансы
        </div>
        <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 620 }}>
          Платежи через ЮКассу, история транзакций и выручка.
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        {[
          { label: 'Выручка всего', value: formatMoney(totalRevenue) },
          { label: 'Сегодня', value: formatMoney(todayRevenue) },
          { label: 'Текущий месяц', value: formatMoney(monthRevenue) },
          { label: 'Успешных платежей', value: String(successCount) },
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
            <div style={{ fontSize: 28, fontFamily: 'Cormorant Garamond, serif', color: 'var(--brand-primary)', fontWeight: 700 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 18 }}>
          Последние платежи
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
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
                <th style={{ padding: '12px 14px 10px' }}>ID платежа</th>
                <th style={{ padding: '12px 14px 10px' }}>Пакет</th>
                <th style={{ padding: '12px 14px 10px' }}>Сумма</th>
                <th style={{ padding: '12px 14px 10px' }}>Токены</th>
                <th style={{ padding: '12px 14px 10px' }}>Статус</th>
                <th style={{ padding: '12px 14px 10px' }}>Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((payment) => (
                <tr key={payment.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '14px 14px', fontSize: 12, fontFamily: 'monospace', color: 'var(--muted)' }}>
                    {payment.yukassa_id
                      ? payment.yukassa_id.slice(0, 12) + '…'
                      : payment.id.slice(0, 8) + '…'}
                  </td>
                  <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--brand-primary)' }}>
                    {payment.package_id ?? '—'}
                  </td>
                  <td style={{ padding: '14px 14px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                    {formatMoney(Number(payment.amount ?? 0))}
                  </td>
                  <td style={{ padding: '14px 14px', color: 'var(--muted)', fontSize: 13 }}>
                    {payment.tokens_granted ?? '—'}
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: STATUS_COLORS[payment.status] ?? 'rgba(34,30,26,0.08)',
                        color: STATUS_TEXT[payment.status] ?? 'var(--muted)',
                      }}
                    >
                      {STATUS_LABELS[payment.status] ?? payment.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px', color: 'var(--muted)', fontSize: 12 }}>
                    {formatDate(payment.created_at)}
                  </td>
                </tr>
              ))}
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                    Платежей нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px',
          borderRadius: 14,
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.2)',
          fontSize: 13,
          color: '#6D5500',
          lineHeight: 1.7,
        }}
      >
        Интеграция с ЮКассой готовится. Вебхуки: <code>/api/webhooks/yukassa</code>. Для тестового
        начисления токенов используйте раздел «Токены».
      </div>
    </div>
  );
}
