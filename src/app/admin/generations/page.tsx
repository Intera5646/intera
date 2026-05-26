import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const STATUSES = ['all', 'pending', 'processing', 'done', 'failed'] as const;

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

type GenerationRow = {
  id: string;
  room_type: string | null;
  status: string | null;
  cost_rub: number | null;
  created_at: string | null;
  duration_seconds: number | null;
  user_id: string | null;
  email: string | null;
};

function statusBadge(status: string | null) {
  const label = status ?? 'pending';
  const palette: Record<string, { bg: string; color: string }> = {
    done: { bg: '#E5F4E7', color: '#356B35' },
    processing: { bg: '#FFF6E3', color: '#A46A13' },
    failed: { bg: '#F9E2E2', color: '#8B2727' },
    pending: { bg: '#F1F1F1', color: '#6B6B6B' },
  };
  const style = palette[label] ?? palette.pending;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      textTransform: 'capitalize',
      minWidth: 90,
    }}>
      {label}
    </span>
  );
}

function formatCost(cost: number | null) {
  if (cost == null) return '—';
  return cost.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
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

function formatDuration(value: number | null) {
  if (value == null) return '—';
  return `${value}s`;
}

async function getGenerations(statusFilter: string | null) {
  const query = supabaseAdmin
    .from('generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== 'all' && STATUSES.includes(statusFilter as any)) {
    query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const generations = (data ?? []) as Array<GenerationRow & Record<string, any>>;
  const userIds = Array.from(new Set(generations.map((row) => row.user_id).filter(Boolean)));

  const usersResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const emailMap = new Map<string, string>();
  (usersResult.data?.users ?? []).forEach((user) => {
    if (user.id && user.email) {
      emailMap.set(user.id, user.email);
    }
  });

  return generations.map((row) => ({
    ...row,
    email: row.user_id ? emailMap.get(row.user_id) ?? null : null,
  }));
}

export default async function AdminGenerationsPage({ searchParams }: { searchParams?: { status?: string } }) {
  const status = searchParams?.status ?? 'all';
  const generations = await getGenerations(status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--brand-primary)' }}>Генерации</h1>
          <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 640 }}>
            Список всех задач генерации с текущим статусом и затратами.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <form method="get" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              Фильтр по статусу
              <select
                name="status"
                defaultValue={status}
                style={{
                  minWidth: 180,
                  borderRadius: 14,
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--brand-primary)',
                  padding: '10px 14px',
                  fontSize: 14,
                }}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>{item === 'all' ? 'Все статусы' : item}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn--ghost" style={{ width: 'fit-content' }}>Применить</button>
          </form>
        </div>
      </header>

      <section style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <th style={{ padding: '16px 14px' }}>Email пользователя</th>
                <th style={{ padding: '16px 14px' }}>Комната</th>
                <th style={{ padding: '16px 14px' }}>Статус</th>
                <th style={{ padding: '16px 14px' }}>Стоимость</th>
                <th style={{ padding: '16px 14px' }}>Создано</th>
                <th style={{ padding: '16px 14px' }}>Длительность</th>
                <th style={{ padding: '16px 14px' }}>Детали</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '16px 14px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                    {row.email ?? '—'}
                  </td>
                  <td style={{ padding: '16px 14px' }}>{row.room_type ?? '—'}</td>
                  <td style={{ padding: '16px 14px' }}>{statusBadge(row.status)}</td>
                  <td style={{ padding: '16px 14px' }}>{formatCost(row.cost_rub)}</td>
                  <td style={{ padding: '16px 14px' }}>{formatDate(row.created_at)}</td>
                  <td style={{ padding: '16px 14px' }}>{formatDuration(row.duration_seconds)}</td>
                  <td style={{ padding: '16px 14px' }}>
                    <Link href={`/admin/generations/${row.id}`} style={{ color: 'var(--brand-accent)', fontWeight: 600, textDecoration: 'none' }}>
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
