import GrantTokensForm from './GrantTokensForm';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? '',
  {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

type TransactionRow = {
  id: string;
  type: string | null;
  amount: number | null;
  reason: string | null;
  created_at: string | null;
  user_id: string | null;
  email: string | null;
};

async function getTokenPageData() {
  const usersResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const emails = (usersResult.data?.users ?? [])
    .map((user) => user.email)
    .filter((email): email is string => Boolean(email));

  const transactionsResult = await supabaseAdmin
    .from('token_transactions')
    .select('id, user_id, type, amount, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  const emailMap = new Map<string, string>();
  (usersResult.data?.users ?? []).forEach((user) => {
    if (user.id && user.email) {
      emailMap.set(user.id, user.email);
    }
  });

  const transactions = (transactionsResult.data ?? []).map((row: any) => ({
    ...row,
    email: row.user_id ? emailMap.get(row.user_id) ?? null : null,
  })) as TransactionRow[];

  return {
    emails,
    transactions,
  };
}

function formatAmount(amount: number | null, type: string | null) {
  if (amount == null) return '—';
  const value = amount.toLocaleString('ru-RU');
  if (type === 'spend') return `- ${value}`;
  if (type === 'grant') return `+ ${value}`;
  if (type === 'purchase') return `+ ${value}`;
  return value;
}

function statusColor(type: string | null) {
  switch (type) {
    case 'grant':
      return { color: '#27532A' };
    case 'spend':
      return { color: '#8B2727' };
    case 'purchase':
      return { color: '#264B7D' };
    default:
      return { color: 'var(--brand-primary)' };
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminTokensPage() {
  const { emails, transactions } = await getTokenPageData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--brand-primary)' }}>
            Токены
          </h1>
          <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 640 }}>
            Начисляйте токены вручную и просматривайте последние транзакции.
          </p>
        </div>
      </header>

      <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>Начисление токенов</div>
            <div style={{ marginTop: 6, color: 'var(--muted)' }}>Введите email, количество и причину для ручного начисления.</div>
          </div>
        </div>

        <GrantTokensForm emails={emails} />
      </section>

      <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>Последние транзакции</div>
            <div style={{ marginTop: 6, color: 'var(--muted)' }}>50 самых свежих операций по токенам.</div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <th style={{ padding: '16px 14px' }}>Email</th>
                <th style={{ padding: '16px 14px' }}>Тип</th>
                <th style={{ padding: '16px 14px' }}>Сумма</th>
                <th style={{ padding: '16px 14px' }}>Причина</th>
                <th style={{ padding: '16px 14px' }}>Когда</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '16px 14px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                    {row.email ?? '—'}
                  </td>
                  <td style={{ padding: '16px 14px', ...statusColor(row.type) }}>{row.type ?? '—'}</td>
                  <td style={{ padding: '16px 14px' }}>{formatAmount(row.amount, row.type)}</td>
                  <td style={{ padding: '16px 14px', color: 'var(--muted)' }}>{row.reason ?? '—'}</td>
                  <td style={{ padding: '16px 14px', color: 'var(--muted)' }}>{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
