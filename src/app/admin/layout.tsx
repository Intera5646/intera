import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { parseSessionCookie, verifySessionToken } from '../../lib/auth';

export const metadata = {
  title: 'INTERA Admin',
};

function AdminSidebar({ active = 'dashboard' }: { active?: string }) {
  const items = [
    { id: 'dashboard', label: 'Дашборд', href: '/admin' },
    { id: 'users', label: 'Пользователи', href: '/admin/users' },
    { id: 'generations', label: 'Генерации', href: '/admin/generations' },
    { id: 'tokens', label: 'Токены', href: '/admin/tokens' },
    { id: 'finance', label: 'Финансы', href: '/admin/finance' },
    { id: 'settings', label: 'Настройки', href: '/admin/settings' },
  ];

  return (
    <aside style={{
      width: 280,
      minWidth: 280,
      background: 'var(--brand-primary)',
      color: '#F5F0E8',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      minHeight: '100vh',
    }}>
      <div style={{ padding: '28px 28px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: 'var(--brand-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 800,
          color: '#fff',
        }}>I</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.16em' }}>INTERA</div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(245, 240, 232, 0.75)', letterSpacing: '0.08em' }}>ADMIN PANEL</div>
        </div>
      </div>

      <div style={{ padding: '0 24px', marginBottom: 18 }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <nav style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 14,
                color: isActive ? 'var(--brand-primary)' : '#F5F0E8',
                background: isActive ? 'rgba(201, 168, 120, 0.18)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 500,
                transition: 'background 0.2s ease',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? 'var(--brand-primary)' : 'rgba(255,255,255,0.45)' }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '22px 22px 28px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #E85D3A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0D1B2A',
            fontWeight: 700,
            fontSize: 18,
          }}>A</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Admin User</div>
            <div style={{ fontSize: 12, color: 'rgba(245, 240, 232, 0.75)' }}>Управление системой</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie') ?? null;
  const sessionToken = parseSessionCookie(cookieHeader);
  const session = sessionToken ? verifySessionToken(sessionToken) : null;

  if (!session || session.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <AdminSidebar active="dashboard" />
      <main style={{ flex: 1, padding: '24px 28px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
