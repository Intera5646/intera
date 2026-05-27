import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUserId } from '@/lib/supabase/session';
import { supabaseServer } from '@/lib/supabase/server';

export const revalidate = 0;

const PACKAGES = [
  {
    id: 'start',
    name: 'Старт',
    tokens: 20,
    price: 1990,
    pricePerToken: 99.5,
    description: 'Для первого знакомства с сервисом',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Профи',
    tokens: 50,
    price: 4490,
    pricePerToken: 89.8,
    description: 'Лучшее соотношение цены и количества',
    highlight: true,
  },
  {
    id: 'studio',
    name: 'Студия',
    tokens: 100,
    price: 9490,
    pricePerToken: 94.9,
    description: 'Для дизайнеров и профессионалов',
    highlight: false,
  },
];

function formatPrice(price: number) {
  return price.toLocaleString('ru-RU') + ' ₽';
}

export default async function TokensPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const [profileResult, transactionsResult] = await Promise.all([
    supabaseServer.from('profiles').select('token_balance, role').eq('id', userId).single(),
    supabaseServer
      .from('token_transactions')
      .select('id, amount, type, reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const tokenBalance = profileResult.data?.token_balance ?? 0;
  const isAdmin = profileResult.data?.role === 'admin';
  const transactions = transactionsResult.data ?? [];

  const TYPE_LABELS: Record<string, string> = {
    purchase: 'Покупка',
    generation: 'Генерация',
    refund: 'Возврат',
    manual_grant: 'Начисление',
    promo: 'Промокод',
    grant: 'Начисление',
    spend: 'Списание',
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--brand-surface)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '34px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <Link
            href="/dashboard"
            style={{
              color: 'var(--muted)',
              textDecoration: 'none',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Dashboard
          </Link>
        </div>

        <div className="serif" style={{ fontSize: 32, fontStyle: 'italic', color: 'var(--brand-primary)', marginBottom: 8 }}>
          Токены
        </div>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 32, maxWidth: 540 }}>
          1 токен = 1 помещение = 4 AI-рендера + объяснения дизайнера. Токен списывается только после
          успешной генерации.
        </p>

        {/* Balance card */}
        <div
          style={{
            padding: 28,
            borderRadius: 20,
            background: 'linear-gradient(135deg, var(--brand-primary) 0%, #1A2E40 100%)',
            color: '#fff',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.7)', marginBottom: 8 }}>
              Текущий баланс
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  color: 'var(--brand-gold)',
                  lineHeight: 1,
                }}
              >
                {isAdmin ? '∞' : tokenBalance}
              </span>
              <span style={{ fontSize: 20, color: 'rgba(245,240,232,0.85)' }}>токенов</span>
            </div>
            {isAdmin && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(245,240,232,0.6)' }}>
                Безлимитный доступ — admin аккаунт
              </div>
            )}
          </div>
          <Link
            href="/projects/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 24px',
              borderRadius: 10,
              background: 'var(--brand-accent)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Создать проект →
          </Link>
        </div>

        {/* Packages */}
        <div style={{ marginBottom: 40 }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--brand-primary)', marginBottom: 16 }}>
            Пополнить токены
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                style={{
                  padding: 24,
                  borderRadius: 20,
                  border: pkg.highlight
                    ? '2px solid var(--brand-accent)'
                    : '1px solid rgba(13,27,42,0.1)',
                  background: '#fff',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {pkg.highlight && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      padding: '4px 12px',
                      background: 'var(--brand-accent)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      borderBottomLeftRadius: 10,
                    }}
                  >
                    ВЫГОДНО
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>
                  {pkg.name}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {pkg.description}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 36,
                    fontWeight: 800,
                    color: 'var(--brand-gold)',
                    lineHeight: 1,
                  }}
                >
                  {pkg.tokens}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  токенов · {pkg.pricePerToken} ₽/токен
                </div>
                <div
                  style={{
                    marginTop: 20,
                    padding: '12px 0',
                    borderTop: '1px solid rgba(13,27,42,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-primary)' }}>
                    {formatPrice(pkg.price)}
                  </span>
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: pkg.highlight ? 'var(--brand-accent)' : 'var(--brand-primary)',
                      color: '#fff',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      opacity: 0.7,
                    }}
                  >
                    Скоро
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(201,168,76,0.1)',
              fontSize: 13,
              color: '#6D5500',
              lineHeight: 1.6,
            }}
          >
            Оплата через ЮКассу (МИР, СБП, Visa/MC) — скоро. По вопросам пополнения обратитесь к
            администратору.
          </div>
        </div>

        {/* Transaction history */}
        {transactions.length > 0 && (
          <div>
            <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--brand-primary)', marginBottom: 16 }}>
              История операций
            </div>
            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                border: '1px solid rgba(13,27,42,0.08)',
                overflow: 'hidden',
              }}
            >
              {transactions.map((tx, idx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(13,27,42,0.06)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-primary)' }}>
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {tx.reason
                        ? tx.reason
                        : tx.created_at
                          ? new Date(tx.created_at).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })
                          : '—'}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: tx.amount > 0 ? '#1B5E20' : '#B71C1C',
                    }}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
