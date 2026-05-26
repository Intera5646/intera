// INTERA — Admin Web Panel (desktop 1440px)
// Two screens: Dashboard, Token Management (with modal).

// ─────────────────────────────────────────────────────────────
// Sidebar (shared)
// ─────────────────────────────────────────────────────────────
function AdminSidebar({ active = 'dashboard' }) {
  const items = [
    { id: 'dashboard', icon: '◫', label: 'Дашборд' },
    { id: 'users',     icon: '◉', label: 'Пользователи' },
    { id: 'gen',       icon: '✦', label: 'Генерации' },
    { id: 'tokens',    icon: '◐', label: 'Токены' },
    { id: 'finance',   icon: '₽', label: 'Финансы' },
    { id: 'settings',  icon: '⚙', label: 'Настройки' },
  ];
  return (
    <aside style={{
      width: 240, background: '#1A1209', color: '#E8DAC4',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(255,253,247,0.06)',
      flexShrink: 0,
    }}>
      {/* logo */}
      <div style={{ padding: '22px 22px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ filter: 'invert(0.92) hue-rotate(-15deg) saturate(0.6) brightness(1.1)', flexShrink: 0 }}>
          <LogoMark size={34} sub={false} />
        </div>
        <div>
          <div className="wordmark" style={{ fontSize: 14, color: '#E8DAC4', letterSpacing: '0.20em' }}>INTERA</div>
          <div style={{
            display: 'inline-block', marginTop: 2,
            padding: '2px 8px', borderRadius: 4,
            background: 'rgba(201,168,120,0.18)', color: '#D4B584',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>Admin</div>
        </div>
      </div>

      <div style={{
        height: 1, background: 'rgba(255,253,247,0.06)', margin: '0 22px',
      }} />

      {/* nav */}
      <nav style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map(it => {
          const isActive = it.id === active;
          return (
            <div key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 8,
              background: isActive ? 'rgba(201,168,120,0.14)' : 'transparent',
              color: isActive ? '#E8DAC4' : 'rgba(232,218,196,0.65)',
              fontSize: 13.5, fontWeight: isActive ? 600 : 500,
              cursor: 'pointer', position: 'relative',
            }}>
              {isActive && (
                <span style={{
                  position: 'absolute', left: 0, top: 6, bottom: 6,
                  width: 3, borderRadius: 2,
                  background: 'var(--gold)',
                }} />
              )}
              <span style={{
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, opacity: 0.9, fontFamily: "'JetBrains Mono', monospace",
                color: isActive ? '#D4B584' : 'currentColor',
              }}>{it.icon}</span>
              <span>{it.label}</span>
            </div>
          );
        })}
      </nav>

      {/* admin user */}
      <div style={{
        padding: '14px 18px 22px', display: 'flex', alignItems: 'center', gap: 12,
        borderTop: '1px solid rgba(255,253,247,0.06)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, #C9A878, #8E7044)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1A1209', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 16,
          fontStyle: 'italic',
        }}>А</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8DAC4' }}>Александр</div>
          <div style={{ fontSize: 10.5, color: 'rgba(232,218,196,0.55)', letterSpacing: '0.02em' }}>Главный админ</div>
        </div>
        <span style={{ fontSize: 14, opacity: 0.5 }}>⌄</span>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Page header (shared)
// ─────────────────────────────────────────────────────────────
function AdminPageHeader({ title, sub, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '28px 36px 18px',
    }}>
      <div>
        <div className="serif" style={{ fontSize: 30, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1 }}>
          {title}
        </div>
        {sub && (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>{sub}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>{right}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Metric card
// ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, delta, dir = 'up', hint }) {
  const color = dir === 'up' ? '#5E8B4A' : dir === 'down' ? '#B05A2B' : 'var(--muted)';
  const arrow = dir === 'up' ? '↗' : dir === 'down' ? '↘' : '→';
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 14, padding: 22,
      border: '1px solid var(--line)', flex: 1, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.02em' }}>{label}</div>
      <div className="serif" style={{
        marginTop: 8, fontSize: 38, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1,
      }}>{value}</div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          color, fontSize: 13, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {arrow} {delta}
        </span>
        {hint && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{hint}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bar chart — Генерации за 7 дней
// ─────────────────────────────────────────────────────────────
function BarChart7d() {
  const data = [
    { d: 'Пн', v: 142 }, { d: 'Вт', v: 168 }, { d: 'Ср', v: 124 },
    { d: 'Чт', v: 195 }, { d: 'Пт', v: 211 }, { d: 'Сб', v: 156 }, { d: 'Вс', v: 183 },
  ];
  const max = 220;
  const w = 700, h = 220;
  const padL = 40, padR = 10, padT = 10, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const bw = innerW / data.length * 0.62;
  const gap = innerW / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={padT + innerH - innerH * t} y2={padT + innerH - innerH * t}
            stroke="rgba(34,30,26,0.08)" strokeWidth="1" />
          <text x={padL - 8} y={padT + innerH - innerH * t + 4}
            fontSize="10" fill="var(--muted)" textAnchor="end" fontFamily="JetBrains Mono">
            {Math.round(max * t)}
          </text>
        </g>
      ))}
      {/* bars */}
      {data.map((d, i) => {
        const x = padL + i * gap + (gap - bw) / 2;
        const bh = (d.v / max) * innerH;
        const y = padT + innerH - bh;
        const isToday = i === data.length - 1;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={`bg${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={isToday ? '#D9BD86' : '#D6BC95'} />
                <stop offset="100%" stopColor={isToday ? '#9F7E45' : '#B89A6B'} />
              </linearGradient>
            </defs>
            <rect x={x} y={y} width={bw} height={bh} rx="6" fill={`url(#bg${i})`} />
            {isToday && (
              <text x={x + bw / 2} y={y - 8} fontSize="11" fontWeight="700"
                textAnchor="middle" fill="var(--ink)" fontFamily="'Cormorant Garamond', serif" fontStyle="italic">
                {d.v}
              </text>
            )}
            <text x={x + bw / 2} y={padT + innerH + 18}
              fontSize="11" textAnchor="middle" fill="var(--muted)" fontFamily="Manrope">
              {d.d}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Donut chart — Пакеты токенов
// ─────────────────────────────────────────────────────────────
function DonutChart() {
  const data = [
    { name: 'Эскиз',  value: 32, color: '#D6BC95' },
    { name: 'Проект', value: 48, color: '#B89A6B' },
    { name: 'Студия', value: 20, color: '#7A5C32' },
  ];
  const r = 78, rIn = 50;
  const cx = 110, cy = 110;
  let acc = 0;
  const total = data.reduce((s, x) => s + x.value, 0);
  const arcs = data.map(d => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.value;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + rIn * Math.cos(a1), y2 = cy + rIn * Math.sin(a1);
    const x3 = cx + rIn * Math.cos(a0), y3 = cy + rIn * Math.sin(a0);
    return {
      d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rIn} ${rIn} 0 ${large} 0 ${x3} ${y3} Z`,
      color: d.color,
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg width="220" height="220" viewBox="0 0 220 220">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
        <text x="110" y="106" textAnchor="middle"
          fontSize="11" fill="var(--muted)" fontFamily="Manrope">всего</text>
        <text x="110" y="130" textAnchor="middle"
          fontSize="22" fill="var(--ink)" fontFamily="'Cormorant Garamond', serif" fontStyle="italic">
          {total}%
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
            <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{d.name}</span>
            <span className="serif" style={{ fontSize: 17, color: 'var(--ink)', fontStyle: 'italic' }}>{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Users table
// ─────────────────────────────────────────────────────────────
function UsersTable() {
  const rows = [
    { name: 'Анна Иванова',     email: 'anna.i@mail.ru',       tokens: 22, gens: 12, status: 'Premium', date: '23 мая 2026' },
    { name: 'Михаил Соколов',   email: 'mikh.sokol@gmail.com', tokens: 3,  gens: 8,  status: 'Активен', date: '22 мая 2026' },
    { name: 'Екатерина Петрова', email: 'kate.p@yandex.ru',    tokens: 0,  gens: 4,  status: 'Триал',   date: '22 мая 2026' },
    { name: 'Дмитрий Орлов',    email: 'd.orlov@inbox.ru',     tokens: 47, gens: 23, status: 'Premium', date: '21 мая 2026' },
    { name: 'Светлана Новикова', email: 'sveta.n@mail.ru',     tokens: 5,  gens: 2,  status: 'Активен', date: '21 мая 2026' },
  ];
  const statusColor = {
    'Premium':  { bg: 'rgba(201,168,120,0.18)', fg: '#8E7044' },
    'Активен':  { bg: 'rgba(110,139,90,0.16)',  fg: '#566F45' },
    'Триал':    { bg: 'rgba(34,30,26,0.07)',    fg: 'var(--muted)' },
  };
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 14,
      border: '1px solid var(--line)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--line)',
      }}>
        <div className="serif" style={{ fontSize: 20, color: 'var(--ink)', fontStyle: 'italic' }}>
          Последние пользователи
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mocha-2)', fontWeight: 600 }}>Все →</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(34,30,26,0.025)', textAlign: 'left' }}>
            {['Имя', 'Email', 'Токены', 'Генераций', 'Статус', 'Дата регистрации', ''].map(h => (
              <th key={h} style={{
                padding: '12px 22px', fontWeight: 600, fontSize: 11,
                letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '14px 22px', color: 'var(--ink)', fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: '14px 22px', color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.email}</td>
              <td style={{ padding: '14px 22px', color: 'var(--ink)' }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: 'italic' }}>{r.tokens}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>ток.</span>
              </td>
              <td style={{ padding: '14px 22px', color: 'var(--ink-2)' }}>{r.gens}</td>
              <td style={{ padding: '14px 22px' }}>
                <span style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: statusColor[r.status].bg, color: statusColor[r.status].fg,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                }}>{r.status}</span>
              </td>
              <td style={{ padding: '14px 22px', color: 'var(--muted)' }}>{r.date}</td>
              <td style={{ padding: '14px 22px', textAlign: 'right' }}>
                <button style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #D9BD86, #B79556)',
                  color: '#1F1B16', border: 0,
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                }}>+ токены</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN A — Dashboard
// ─────────────────────────────────────────────────────────────
function AdminDashboard() {
  return (
    <div style={{
      display: 'flex', width: 1440, height: 1000,
      background: 'var(--bg)', fontFamily: 'Manrope, sans-serif',
    }}>
      <AdminSidebar active="dashboard" />

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AdminPageHeader
          title="Дашборд"
          sub="23 мая 2026 · обновлено только что"
          right={
            <React.Fragment>
              <button style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'var(--white)', border: '1px solid var(--line-2)',
                color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>↓</span>
                Экспорт
              </button>
              <button style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'var(--ink)', color: 'var(--paper)',
                border: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Период: 7 дней
              </button>
            </React.Fragment>
          }
        />

        <div style={{ padding: '0 36px 36px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflow: 'auto' }}>
          {/* metrics row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <MetricCard label="Пользователей сегодня" value="47"      delta="+12% vs вчера"  dir="up" />
            <MetricCard label="Генераций сегодня"     value="183"     delta="+8%"            dir="up" />
            <MetricCard label="Выручка сегодня"       value="12 450 ₽" delta="+23%"           dir="up" />
            <MetricCard label="Конверсия"             value="4.2%"    delta="норма 2–5%"    dir="flat" hint="" />
          </div>

          {/* charts row */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{
              flex: 6, background: 'var(--white)',
              borderRadius: 14, border: '1px solid var(--line)', padding: 22,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)' }}>
                  Генерации за 7 дней
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>всего 1 179 · ср. 168 / день</div>
              </div>
              <BarChart7d />
            </div>
            <div style={{
              flex: 4, background: 'var(--white)',
              borderRadius: 14, border: '1px solid var(--line)', padding: 22,
            }}>
              <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 14 }}>
                Пакеты токенов
              </div>
              <DonutChart />
            </div>
          </div>

          {/* users table */}
          <UsersTable />
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN B — Token management
// ─────────────────────────────────────────────────────────────
function AdminTokens({ showModal = true }) {
  const txns = [
    { user: 'Анна Иванова',     type: '+',  amount: 20, reason: 'Покупка «Проект»',     by: 'Авто · ЮКасса',   date: '23.05 · 14:22', kind: 'add' },
    { user: 'Дмитрий Орлов',    type: '+',  amount: 50, reason: 'Покупка «Студия»',       by: 'Авто · ЮКасса',   date: '23.05 · 12:08', kind: 'add' },
    { user: 'Михаил Соколов',   type: '−',  amount: 1,  reason: 'Генерация · Гостиная',   by: 'Система',         date: '23.05 · 11:47', kind: 'sub' },
    { user: 'Тестовый аккаунт', type: '+',  amount: 5,  reason: 'Тестирование',           by: 'Александр (admin)', date: '23.05 · 10:30', kind: 'add' },
    { user: 'Екатерина Петрова', type: '+', amount: 10, reason: 'Компенсация · ошибка',   by: 'Александр (admin)', date: '22.05 · 18:14', kind: 'add' },
    { user: 'Алексей Зайцев',   type: '−',  amount: 1,  reason: 'Генерация · Спальня',    by: 'Система',         date: '22.05 · 16:50', kind: 'sub' },
  ];

  return (
    <div style={{
      position: 'relative',
      display: 'flex', width: 1440, height: 1000,
      background: 'var(--bg)', fontFamily: 'Manrope, sans-serif',
    }}>
      <AdminSidebar active="tokens" />

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AdminPageHeader
          title="Управление токенами"
          sub="Ручное начисление, история операций"
        />

        {/* action bar */}
        <div style={{
          padding: '0 36px 18px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            flex: 1, maxWidth: 420,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--white)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '0 14px', height: 44,
          }}>
            <span style={{ color: 'var(--muted)' }}>⌕</span>
            <input
              placeholder="Поиск по email или имени…"
              style={{
                flex: 1, border: 0, background: 'transparent', outline: 'none',
                fontFamily: 'Manrope', fontSize: 13.5, color: 'var(--ink)',
              }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <button style={{
            padding: '11px 18px', borderRadius: 10,
            background: 'var(--white)', border: '1px solid var(--line-2)',
            color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Фильтры</button>
          <button style={{
            padding: '11px 18px', borderRadius: 10,
            background: 'linear-gradient(135deg, #D9BD86, #B79556)',
            color: '#1F1B16', border: 0,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 12px rgba(184,140,80,0.30)',
          }}>+ Начислить токены</button>
        </div>

        {/* transactions table */}
        <div style={{ padding: '0 36px 36px', flex: 1, overflow: 'auto' }}>
          <div style={{
            background: 'var(--white)', borderRadius: 14,
            border: '1px solid var(--line)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--line)',
            }}>
              <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)' }}>
                История операций
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
                <span style={{ color: 'var(--muted)' }}>Сегодня: <b style={{ color: '#5E8B4A' }}>+75</b> / <b style={{ color: '#B05A2B' }}>−12</b></span>
                <span style={{ color: 'var(--mocha-2)', fontWeight: 600 }}>Экспорт CSV</span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(34,30,26,0.025)', textAlign: 'left' }}>
                  {['Пользователь', 'Тип', 'Кол-во', 'Причина', 'Кто начислил', 'Дата'].map(h => (
                    <th key={h} style={{
                      padding: '12px 22px', fontWeight: 600, fontSize: 11,
                      letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map((r, i) => {
                  const isAdd = r.kind === 'add';
                  return (
                    <tr key={i} style={{
                      borderTop: '1px solid var(--line)',
                      background: isAdd ? 'rgba(110,139,90,0.04)' : 'rgba(176,90,43,0.04)',
                    }}>
                      <td style={{ padding: '14px 22px', color: 'var(--ink)', fontWeight: 600 }}>{r.user}</td>
                      <td style={{ padding: '14px 22px' }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: isAdd ? '#5E8B4A' : '#B05A2B',
                          color: '#fff', fontWeight: 800, fontSize: 13,
                        }}>{r.type}</span>
                      </td>
                      <td style={{ padding: '14px 22px' }}>
                        <span className="serif" style={{
                          fontSize: 18, color: isAdd ? '#5E8B4A' : '#B05A2B',
                          fontStyle: 'italic',
                        }}>{r.type}{r.amount}</span>
                      </td>
                      <td style={{ padding: '14px 22px', color: 'var(--ink-2)' }}>{r.reason}</td>
                      <td style={{ padding: '14px 22px', color: 'var(--muted)', fontSize: 12.5 }}>{r.by}</td>
                      <td style={{ padding: '14px 22px', color: 'var(--muted)',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL */}
      {showModal && (
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(26,18,9,0.42)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 240, /* offset for sidebar */
      }}>
        <div style={{
          width: 480, background: 'var(--paper)',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 30px 70px rgba(26,18,9,0.35)',
          border: '1px solid rgba(255,255,255,0.5)',
        }}>
          {/* modal header */}
          <div style={{
            padding: '20px 26px 14px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}>
            <div>
              <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', color: 'var(--ink)' }}>
                Ручное начисление токенов
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                Операция будет отражена в истории и привязана к&nbsp;вашему аккаунту
              </div>
            </div>
            <button style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(34,30,26,0.06)', border: 0, color: 'var(--ink-2)',
              cursor: 'pointer', fontSize: 16,
            }}>✕</button>
          </div>

          <div style={{ padding: '8px 26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Пользователь">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--white)', border: '1px solid var(--line)',
                borderRadius: 10, padding: '0 12px', height: 44,
              }}>
                <span style={{ color: 'var(--muted)' }}>⌕</span>
                <input
                  defaultValue="Анна Иванова"
                  style={{
                    flex: 1, border: 0, background: 'transparent', outline: 'none',
                    fontSize: 13.5, color: 'var(--ink)', fontFamily: 'Manrope',
                  }}
                />
                <span style={{
                  fontSize: 11, color: 'var(--muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>anna.i@mail.ru</span>
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Количество токенов" grow>
                <div style={{
                  background: 'var(--white)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '0 12px', height: 44,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <input
                    defaultValue="20"
                    style={{
                      flex: 1, border: 0, background: 'transparent', outline: 'none',
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: 'italic', fontSize: 20, color: 'var(--ink)',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>токенов</span>
                </div>
              </Field>
              <Field label="Причина" grow>
                <div style={{
                  background: 'var(--white)', border: '1px solid var(--line)',
                  borderRadius: 10, padding: '0 12px', height: 44,
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13.5, color: 'var(--ink)',
                }}>
                  <span style={{ flex: 1 }}>Компенсация</span>
                  <span style={{ color: 'var(--muted)' }}>⌄</span>
                </div>
              </Field>
            </div>

            <Field label="Комментарий (необязательно)">
              <div style={{
                background: 'var(--white)', border: '1px solid var(--line)',
                borderRadius: 10, padding: '10px 12px', minHeight: 64,
                fontSize: 13, color: 'var(--muted-2)',
              }}>
                Сбой генерации 21 мая · возврат потраченных токенов
              </div>
            </Field>

            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4,
                background: 'var(--mocha)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--paper)',
              }}><IconCheck size={12} sw={3} color="var(--paper)" /></span>
              Уведомить пользователя по&nbsp;email
            </label>
          </div>

          <div style={{
            padding: '16px 26px',
            background: 'rgba(34,30,26,0.04)',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button style={{
              padding: '10px 18px', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--line-2)',
              color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Отмена</button>
            <button style={{
              padding: '10px 22px', borderRadius: 10,
              background: 'linear-gradient(135deg, #D9BD86, #B79556)',
              color: '#1F1B16', border: 0,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Начислить +20</button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function Field({ label, grow, children }) {
  return (
    <div style={{ flex: grow ? 1 : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.02em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

Object.assign(window, { AdminDashboard, AdminTokens });
