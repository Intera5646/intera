// INTERA — Admin Web Panel · Part 2: Users, Generations, Finance, Settings

// ─────────────────────────────────────────────────────────────
// ADMIN C — USERS
// ─────────────────────────────────────────────────────────────
function AdminUsers() {
  const rows = [
    { name: 'Анна Иванова',       email: 'anna.i@mail.ru',          plan: 'Premium', tokens: 22, gens: 12, last: '23.05',  reg: '14.04.2026', src: 'Google' },
    { name: 'Михаил Соколов',     email: 'mikh.sokol@gmail.com',    plan: 'Активен', tokens: 3,  gens: 8,  last: '23.05',  reg: '02.05.2026', src: 'Apple'  },
    { name: 'Екатерина Петрова',  email: 'kate.p@yandex.ru',        plan: 'Триал',   tokens: 0,  gens: 4,  last: '23.05',  reg: '18.05.2026', src: 'Email'  },
    { name: 'Дмитрий Орлов',      email: 'd.orlov@inbox.ru',        plan: 'Premium', tokens: 47, gens: 23, last: '22.05',  reg: '11.03.2026', src: 'Apple'  },
    { name: 'Светлана Новикова',  email: 'sveta.n@mail.ru',         plan: 'Активен', tokens: 5,  gens: 2,  last: '21.05',  reg: '20.05.2026', src: 'Google' },
    { name: 'Алексей Зайцев',     email: 'a.zaytsev@yandex.ru',     plan: 'Активен', tokens: 12, gens: 7,  last: '21.05',  reg: '06.04.2026', src: 'Apple'  },
    { name: 'Марина Ковалёва',    email: 'm.kov@inbox.ru',          plan: 'Premium', tokens: 38, gens: 19, last: '20.05',  reg: '24.02.2026', src: 'Google' },
    { name: 'Игорь Беляев',       email: 'belyaev.i@mail.ru',       plan: 'Триал',   tokens: 1,  gens: 1,  last: '20.05',  reg: '19.05.2026', src: 'Email'  },
    { name: 'Ольга Лебедева',     email: 'o.lebedeva@yandex.ru',    plan: 'Заблок.', tokens: 0,  gens: 6,  last: '15.05',  reg: '08.01.2026', src: 'Email'  },
    { name: 'Павел Громов',       email: 'p.gromov@gmail.com',      plan: 'Активен', tokens: 8,  gens: 4,  last: '19.05',  reg: '01.05.2026', src: 'Google' },
  ];
  const statusColor = {
    'Premium': { bg: 'rgba(201,168,120,0.18)', fg: '#8E7044' },
    'Активен': { bg: 'rgba(110,139,90,0.16)',  fg: '#566F45' },
    'Триал':   { bg: 'rgba(34,30,26,0.07)',    fg: 'var(--muted)' },
    'Заблок.': { bg: 'rgba(176,90,43,0.14)',   fg: '#B05A2B' },
  };
  return (
    <div style={{ display: 'flex', width: 1440, height: 1000, background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>
      <AdminSidebar active="users" />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminPageHeader
          title="Пользователи"
          sub="Всего 1 248 · активных 842 · сегодня +47"
          right={
            <React.Fragment>
              <button style={btnGhost}>↓ Экспорт CSV</button>
              <button style={btnDark}>+ Добавить</button>
            </React.Fragment>
          }
        />

        {/* Mini-stats row */}
        <div style={{ padding: '0 36px 18px', display: 'flex', gap: 12 }}>
          <MiniStat label="Всего"    value="1 248" />
          <MiniStat label="Premium"  value="216"   accent />
          <MiniStat label="Триал"    value="184"   />
          <MiniStat label="Активных за 7 дней" value="412" />
          <MiniStat label="Конверсия в Premium" value="14.4%" />
        </div>

        {/* Filters bar */}
        <div style={{
          padding: '0 36px 18px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <SearchBox placeholder="Поиск по имени или email…" width={360} />
          <SegPills items={['Все', 'Premium', 'Активен', 'Триал', 'Заблок.']} sel={0} />
          <div style={{ flex: 1 }} />
          <button style={btnGhost}>Фильтры</button>
          <button style={btnGhost}>Сортировка: новые</button>
        </div>

        {/* Table */}
        <div style={{ padding: '0 36px 36px', flex: 1, overflow: 'auto' }}>
          <div style={tableCard}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(34,30,26,0.025)', textAlign: 'left' }}>
                  {['Пользователь', 'Тариф', 'Токены', 'Генераций', 'Активность', 'Регистрация', 'Источник', ''].map((h, i) => (
                    <th key={i} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={tableAvatar(r.name)}>{r.name[0]}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--muted)' }}>
                            {r.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 999,
                        background: statusColor[r.plan].bg, color: statusColor[r.plan].fg,
                        fontSize: 11, fontWeight: 700,
                      }}>{r.plan}</span>
                    </td>
                    <td style={td}>
                      <span className="serif" style={{ fontSize: 17, color: 'var(--ink)', fontStyle: 'italic' }}>{r.tokens}</span>
                    </td>
                    <td style={td}>{r.gens}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{r.last}</td>
                    <td style={{ ...td, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.reg}</td>
                    <td style={{ ...td, color: 'var(--ink-2)' }}>{r.src}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'transparent', border: '1px solid var(--line-2)',
                        color: 'var(--muted)', cursor: 'pointer',
                      }}>⋯</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={paginator}>
              <span>Показано 1–10 из 1 248</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['‹', '1', '2', '3', '…', '125', '›'].map((p, i) => (
                  <span key={i} style={{
                    minWidth: 30, padding: '6px 10px', borderRadius: 6, textAlign: 'center',
                    background: p === '1' ? 'var(--ink)' : 'transparent',
                    color: p === '1' ? 'var(--paper)' : 'var(--ink-2)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>{p}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN D — GENERATIONS
// ─────────────────────────────────────────────────────────────
function AdminGenerations() {
  const cards = [
    { id: 'GEN-2451', user: 'Анна Иванова',    room: 'Гостиная',   style: 'Скандинавский',    status: 'Готово',    time: '23.05 · 14:42', dur: '52 c', tone: 1 },
    { id: 'GEN-2450', user: 'Михаил Соколов',  room: 'Спальня',    style: 'Минимализм',       status: 'В работе',  time: '23.05 · 14:30', dur: '—',    tone: 2, progress: 72 },
    { id: 'GEN-2449', user: 'Дмитрий Орлов',   room: 'Кухня',      style: 'Современный',      status: 'Готово',    time: '23.05 · 13:18', dur: '48 c', tone: 3 },
    { id: 'GEN-2448', user: 'Екатерина Петр.', room: 'Ванная',     style: 'Классика',         status: 'Ошибка',    time: '23.05 · 12:50', dur: '—',    tone: 4, error: true },
    { id: 'GEN-2447', user: 'Анна Иванова',    room: 'Студия',     style: 'Лофт',             status: 'Готово',    time: '23.05 · 11:42', dur: '61 c', tone: 1 },
    { id: 'GEN-2446', user: 'Светлана Нов.',   room: 'Гостиная',   style: 'Эклектика',        status: 'Готово',    time: '23.05 · 11:05', dur: '57 c', tone: 2 },
    { id: 'GEN-2445', user: 'Алексей Зайцев',  room: 'Спальня',    style: 'Скандинавский',    status: 'Готово',    time: '22.05 · 22:14', dur: '49 c', tone: 3 },
    { id: 'GEN-2444', user: 'Марина Ковалёва', room: 'Гостиная',   style: 'Минимализм',       status: 'Готово',    time: '22.05 · 20:00', dur: '55 c', tone: 4 },
  ];
  const tones = [
    'linear-gradient(135deg, #EFE0C4, #C5A87E)',
    'linear-gradient(135deg, #F2E5CD, #D7BD93)',
    'linear-gradient(135deg, #E5D2B2, #B49770)',
    'linear-gradient(135deg, #F7EBD3, #CFB58A)',
  ];
  const statusColors = {
    'Готово':   { bg: 'rgba(110,139,90,0.16)',   fg: '#566F45' },
    'В работе': { bg: 'rgba(201,168,120,0.20)',  fg: '#8E7044' },
    'Ошибка':   { bg: 'rgba(176,90,43,0.16)',    fg: '#B05A2B' },
  };

  return (
    <div style={{ display: 'flex', width: 1440, height: 1000, background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>
      <AdminSidebar active="gen" />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminPageHeader
          title="Генерации"
          sub="Все рендеры пользователей · мониторинг очереди"
          right={
            <React.Fragment>
              <button style={btnGhost}>Лента · 24 ч</button>
              <button style={btnDark}>Очередь · 4</button>
            </React.Fragment>
          }
        />

        {/* Stats */}
        <div style={{ padding: '0 36px 18px', display: 'flex', gap: 12 }}>
          <MiniStat label="Сегодня"          value="183"   accent />
          <MiniStat label="В очереди"        value="4"     />
          <MiniStat label="Среднее время"    value="52 с"  />
          <MiniStat label="Ошибок (24ч)"     value="2"     />
          <MiniStat label="Успех"            value="98.4%" />
        </div>

        {/* Filters */}
        <div style={{
          padding: '0 36px 18px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <SearchBox placeholder="ID, email, тип комнаты…" width={360} />
          <SegPills items={['Все', 'Готово', 'В работе', 'Ошибка']} sel={0} />
          <div style={{ flex: 1 }} />
          <button style={btnGhost}>Стиль: все</button>
          <button style={btnGhost}>Период: 24 ч</button>
        </div>

        {/* Grid of generation cards */}
        <div style={{ padding: '0 36px 36px', flex: 1, overflow: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
          }}>
            {cards.map(c => (
              <div key={c.id} style={{
                background: 'var(--white)', borderRadius: 14,
                border: '1px solid var(--line)', overflow: 'hidden',
              }}>
                <div className="room flat" style={{
                  aspectRatio: '4 / 3',
                  background: tones[c.tone - 1] || tones[0],
                  position: 'relative',
                  opacity: c.error ? 0.55 : 1,
                  filter: c.status === 'В работе' ? 'blur(2px) saturate(0.7)' : 'none',
                }}>
                  {c.status === 'В работе' && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.10)',
                    }}>
                      <div className="serif" style={{
                        fontSize: 28, color: '#FBF7F0', fontStyle: 'italic',
                        textShadow: '0 2px 8px rgba(0,0,0,0.30)',
                      }}>{c.progress}%</div>
                    </div>
                  )}
                  {c.error && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(176,90,43,0.95)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800,
                    }}>!</div>
                  )}
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    padding: '3px 8px', borderRadius: 999,
                    background: statusColors[c.status].bg, color: statusColors[c.status].fg,
                    fontSize: 10.5, fontWeight: 700, backdropFilter: 'blur(6px)',
                  }}>{c.status}</div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{
                    fontSize: 10.5, color: 'var(--muted)',
                    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em',
                  }}>{c.id}</div>
                  <div className="serif" style={{
                    fontSize: 17, color: 'var(--ink)', marginTop: 2, fontStyle: 'italic', lineHeight: 1.15,
                  }}>{c.room}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{c.style}</div>
                  <div style={{
                    marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 11.5, color: 'var(--muted)',
                  }}>
                    <span>{c.user}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.dur}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN E — FINANCE
// ─────────────────────────────────────────────────────────────
function AdminFinance() {
  const payments = [
    { id: 'P-8821', user: 'Анна Иванова',    plan: 'Проект',  amount: '790 ₽',   method: 'СБП',    status: 'Оплачено', date: '23.05 · 14:22' },
    { id: 'P-8820', user: 'Дмитрий Орлов',   plan: 'Студия',  amount: '1 490 ₽', method: 'Карта',  status: 'Оплачено', date: '23.05 · 12:08' },
    { id: 'P-8819', user: 'Светлана Нов.',   plan: 'Эскиз',   amount: '249 ₽',   method: 'СБП',    status: 'Оплачено', date: '23.05 · 09:44' },
    { id: 'P-8818', user: 'Алексей Зайцев',  plan: 'Проект',  amount: '790 ₽',   method: 'Apple',  status: 'Оплачено', date: '22.05 · 21:30' },
    { id: 'P-8817', user: 'Марина Ковалёва', plan: 'Студия',  amount: '1 490 ₽', method: 'Карта',  status: 'Возврат',  date: '22.05 · 18:00' },
    { id: 'P-8816', user: 'Павел Громов',    plan: 'Эскиз',   amount: '249 ₽',   method: 'СБП',    status: 'Оплачено', date: '22.05 · 16:12' },
    { id: 'P-8815', user: 'Игорь Беляев',    plan: 'Проект',  amount: '790 ₽',   method: 'Карта',  status: 'Ошибка',   date: '22.05 · 11:08' },
  ];
  const statusColors = {
    'Оплачено': { bg: 'rgba(110,139,90,0.16)', fg: '#566F45' },
    'Возврат':  { bg: 'rgba(34,30,26,0.07)',   fg: 'var(--muted)' },
    'Ошибка':   { bg: 'rgba(176,90,43,0.16)',  fg: '#B05A2B' },
  };
  return (
    <div style={{ display: 'flex', width: 1440, height: 1000, background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>
      <AdminSidebar active="finance" />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminPageHeader
          title="Финансы"
          sub="Май 2026 · все операции через ЮКассу"
          right={
            <React.Fragment>
              <button style={btnGhost}>↓ Экспорт</button>
              <button style={btnDark}>Период: май 2026</button>
            </React.Fragment>
          }
        />

        {/* Top KPIs */}
        <div style={{ padding: '0 36px 18px', display: 'flex', gap: 16 }}>
          <MetricCard label="Выручка за месяц"  value="284 920 ₽" delta="+38% vs апрель" dir="up" />
          <MetricCard label="MRR"               value="142 600 ₽" delta="+12%"           dir="up" />
          <MetricCard label="Средний чек"       value="612 ₽"     delta="−4%"            dir="down" />
          <MetricCard label="Возвраты"          value="3 970 ₽"   delta="1.4% от оборота" dir="flat" />
        </div>

        {/* Charts row */}
        <div style={{ padding: '0 36px 18px', display: 'flex', gap: 16 }}>
          <div style={{ flex: 6, ...cardBox, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)' }}>
                Выручка по дням
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>пик 28.05 · 18 200 ₽</div>
            </div>
            <RevenueArea />
          </div>
          <div style={{ flex: 4, ...cardBox, padding: 22 }}>
            <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 14 }}>
              Способы оплаты
            </div>
            <PaymentsBars />
          </div>
        </div>

        {/* Payments table */}
        <div style={{ padding: '0 36px 36px', flex: 1, overflow: 'auto' }}>
          <div style={tableCard}>
            <div style={tableHeader}>
              <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)' }}>
                Последние платежи
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
                <span style={{ color: 'var(--muted)' }}>Сегодня: <b style={{ color: '#5E8B4A' }}>+3 029 ₽</b></span>
                <span style={{ color: 'var(--mocha-2)', fontWeight: 600 }}>Все →</span>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(34,30,26,0.025)', textAlign: 'left' }}>
                  {['№', 'Пользователь', 'Тариф', 'Сумма', 'Способ', 'Статус', 'Дата'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)', fontSize: 12 }}>{p.id}</td>
                    <td style={{ ...td, color: 'var(--ink)', fontWeight: 600 }}>{p.user}</td>
                    <td style={td}>{p.plan}</td>
                    <td style={td}>
                      <span className="serif" style={{ fontSize: 17, color: 'var(--ink)', fontStyle: 'italic' }}>
                        {p.amount}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--ink-2)' }}>{p.method}</td>
                    <td style={td}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 999,
                        background: statusColors[p.status].bg, color: statusColors[p.status].fg,
                        fontSize: 11, fontWeight: 700,
                      }}>{p.status}</span>
                    </td>
                    <td style={{ ...td, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function RevenueArea() {
  const w = 700, h = 220;
  // 14 days of revenue (deterministic pattern)
  const data = [60, 82, 95, 70, 110, 130, 118, 102, 145, 168, 142, 156, 182, 165];
  const max = 200;
  const padL = 32, padR = 8, padT = 10, padB = 24;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const stepX = innerW / (data.length - 1);
  const points = data.map((v, i) => [padL + i * stepX, padT + innerH - (v / max) * innerH]);
  const pathLine = 'M ' + points.map(p => p.join(' ')).join(' L ');
  const pathArea = pathLine + ` L ${padL + innerW} ${padT + innerH} L ${padL} ${padT + innerH} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="revArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#D9BD86" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#D9BD86" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(t => (
        <line key={t} x1={padL} x2={w - padR}
          y1={padT + innerH - innerH * t} y2={padT + innerH - innerH * t}
          stroke="rgba(34,30,26,0.06)" />
      ))}
      <path d={pathArea} fill="url(#revArea)" />
      <path d={pathLine} fill="none" stroke="#9F7E45" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 4 : 0}
          fill="#9F7E45" />
      ))}
      <text x={points[points.length - 1][0] - 6} y={points[points.length - 1][1] - 10}
        fontSize="11" textAnchor="end" fill="var(--ink)"
        fontFamily="'Cormorant Garamond', serif" fontStyle="italic">18 200 ₽</text>
      {['10', '15', '20', '23'].map((lab, i) => (
        <text key={lab} x={padL + (innerW / 3) * i} y={h - 6}
          fontSize="10" fill="var(--muted)" fontFamily="Manrope" textAnchor="start">{lab} мая</text>
      ))}
    </svg>
  );
}

function PaymentsBars() {
  const data = [
    { name: 'СБП',       value: 42, color: '#9F7E45' },
    { name: 'Карта',     value: 31, color: '#B89A6B' },
    { name: 'Apple Pay', value: 18, color: '#D6BC95' },
    { name: 'Прочее',    value:  9, color: 'rgba(34,30,26,0.18)' },
  ];
  return (
    <div className="col gap-14">
      {data.map(d => (
        <div key={d.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{d.name}</span>
            <span className="serif" style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink)' }}>{d.value}%</span>
          </div>
          <div style={{
            height: 8, borderRadius: 4, background: 'rgba(34,30,26,0.05)', overflow: 'hidden',
          }}>
            <div style={{ width: d.value + '%', height: '100%', background: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN F — SETTINGS
// ─────────────────────────────────────────────────────────────
function AdminSettings() {
  const team = [
    { name: 'Александр',  email: 'alex@intera.ru',  role: 'Главный админ', online: true },
    { name: 'Анастасия',  email: 'nastya@intera.ru', role: 'Поддержка',     online: true },
    { name: 'Виктор',     email: 'vik@intera.ru',    role: 'Финансы',       online: false },
    { name: 'Илья',       email: 'ilya@intera.ru',   role: 'Просмотр',      online: false },
  ];
  return (
    <div style={{ display: 'flex', width: 1440, height: 1000, background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>
      <AdminSidebar active="settings" />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminPageHeader
          title="Настройки"
          sub="Конфигурация платформы, команда, интеграции"
          right={<button style={btnDark}>Сохранить</button>}
        />

        {/* Sub-nav */}
        <div style={{ padding: '0 36px 22px' }}>
          <SegPills items={['Общие', 'Тарифы', 'AI движок', 'Команда', 'Интеграции', 'Безопасность']} sel={3} />
        </div>

        {/* Body: two columns */}
        <div style={{ padding: '0 36px 36px', flex: 1, overflow: 'auto', display: 'flex', gap: 16 }}>
          {/* Left: tariffs editor */}
          <div style={{ flex: 5, ...cardBox, padding: 22 }}>
            <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 14 }}>
              Тарифы токенов
            </div>
            <div className="col gap-10">
              {[
                { name: 'Эскиз',  tokens: 5,  price: 249,  popular: false },
                { name: 'Проект', tokens: 20, price: 790,  popular: true },
                { name: 'Студия', tokens: 50, price: 1490, popular: false, gold: true },
              ].map(t => (
                <div key={t.name} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--paper)', border: '1px solid var(--line)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: t.gold
                      ? 'linear-gradient(135deg, #DCBE85, #A88A56)'
                      : t.popular
                        ? 'linear-gradient(135deg, #CFB694, #9F8460)'
                        : 'rgba(184,160,131,0.16)',
                    color: t.popular || t.gold ? 'var(--paper)' : 'var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span className="serif" style={{ fontSize: 18, fontStyle: 'italic' }}>{t.tokens}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="serif" style={{ fontSize: 17, color: 'var(--ink)', fontStyle: 'italic' }}>
                      {t.name}
                      {t.popular && (
                        <span style={{
                          marginLeft: 8, padding: '2px 8px', borderRadius: 999,
                          background: 'rgba(159,126,69,0.16)', color: '#8E7044',
                          fontSize: 10, fontWeight: 700, verticalAlign: 'middle',
                          fontFamily: 'Manrope', fontStyle: 'normal', letterSpacing: '0.02em',
                        }}>Популярный</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {t.tokens} токенов · ~{Math.round(t.price / t.tokens)} ₽ за комнату
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--white)', border: '1px solid var(--line)',
                    borderRadius: 10, padding: '8px 14px', minWidth: 110,
                  }}>
                    <span className="serif" style={{ fontSize: 18, color: 'var(--ink)', fontStyle: 'italic' }}>
                      {t.price.toLocaleString('ru')}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>₽</span>
                  </div>
                  <button style={{
                    padding: '8px 14px', borderRadius: 8,
                    background: 'transparent', border: '1px solid var(--line-2)',
                    color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Редактировать</button>
                </div>
              ))}
            </div>

            <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)', marginTop: 26, marginBottom: 14 }}>
              AI движок
            </div>
            <div className="col gap-10">
              <Toggle label="Активный движок"
                value="Stable Diffusion XL · v3.2"
                action="Сменить" />
              <Toggle label="Среднее время генерации"
                value="~52 секунды"
                action="Метрики" />
              <Toggle label="Параллельных задач"
                value="8"
                action="Изменить" />
            </div>
          </div>

          {/* Right: team */}
          <div style={{ flex: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...cardBox, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)' }}>
                  Команда
                </div>
                <button style={btnGold}>+ Пригласить</button>
              </div>
              <div className="col gap-8">
                {team.map(t => (
                  <div key={t.email} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'var(--paper)', border: '1px solid var(--line)',
                  }}>
                    <div style={{ position: 'relative' }}>
                      <div style={tableAvatar(t.name)}>{t.name[0]}</div>
                      <div style={{
                        position: 'absolute', right: -2, bottom: -2,
                        width: 10, height: 10, borderRadius: '50%',
                        background: t.online ? '#5E8B4A' : 'rgba(34,30,26,0.2)',
                        border: '2px solid var(--paper)',
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.name}</div>
                      <div style={{
                        fontSize: 11.5, color: 'var(--muted)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{t.email}</div>
                    </div>
                    <div style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: 'rgba(34,30,26,0.06)', color: 'var(--ink-2)',
                      fontSize: 11.5, fontWeight: 600,
                    }}>{t.role}</div>
                    <span style={{ color: 'var(--muted)', cursor: 'pointer' }}>⋯</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cardBox, padding: 22 }}>
              <div className="serif" style={{ fontSize: 20, fontStyle: 'italic', color: 'var(--ink)', marginBottom: 14 }}>
                Уведомления
              </div>
              <div className="col gap-10">
                <CheckRow label="Новые регистрации" sub="email главному админу"     on />
                <CheckRow label="Платежи > 1 000 ₽"  sub="Telegram канал #payments"  on />
                <CheckRow label="Ошибки генерации"   sub="мгновенно в Slack"          on />
                <CheckRow label="Еженедельный отчёт" sub="по понедельникам в 10:00" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Toggle({ label, value, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 10,
      background: 'var(--paper)', border: '1px solid var(--line)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>{value}</div>
      </div>
      <button style={{
        padding: '7px 14px', borderRadius: 8,
        background: 'transparent', border: '1px solid var(--line-2)',
        color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>{action}</button>
    </div>
  );
}

function CheckRow({ label, sub, on }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        width: 38, height: 22, borderRadius: 999,
        background: on ? 'var(--mocha)' : 'rgba(34,30,26,0.18)',
        position: 'relative', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 18 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--paper)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 0.15s',
        }} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared admin atoms (used by all part-2 screens)
// ─────────────────────────────────────────────────────────────

const btnDark = {
  padding: '10px 18px', borderRadius: 10,
  background: 'var(--ink)', color: 'var(--paper)',
  border: 0, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnGhost = {
  padding: '10px 16px', borderRadius: 10,
  background: 'var(--white)', border: '1px solid var(--line-2)',
  color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnGold = {
  padding: '8px 16px', borderRadius: 10,
  background: 'linear-gradient(135deg, #D9BD86, #B79556)',
  color: '#1F1B16', border: 0,
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
};
const cardBox = {
  background: 'var(--white)', borderRadius: 14,
  border: '1px solid var(--line)',
};
const tableCard = {
  ...cardBox, overflow: 'hidden',
};
const tableHeader = {
  padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  borderBottom: '1px solid var(--line)',
};
const th = {
  padding: '12px 22px', fontWeight: 600, fontSize: 11,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
};
const td = { padding: '14px 22px', color: 'var(--ink-2)' };

const paginator = {
  padding: '14px 22px',
  borderTop: '1px solid var(--line)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  fontSize: 12, color: 'var(--muted)',
};

function tableAvatar(name) {
  // hash to one of 4 palettes
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 4;
  const palettes = [
    ['#E8D5B5', '#8E7044'],
    ['#D6BC95', '#7A5C32'],
    ['#C9A878', '#5E482A'],
    ['#B89A6B', '#3D2F1B'],
  ];
  const p = palettes[h];
  return {
    width: 36, height: 36, borderRadius: '50%',
    background: `linear-gradient(135deg, ${p[0]}, ${p[1]})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#FBF7F0', fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontWeight: 600, fontSize: 16, flexShrink: 0,
  };
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{
      ...cardBox, padding: '14px 18px', flex: 1,
      borderColor: accent ? 'rgba(201,168,120,0.5)' : 'var(--line)',
      background: accent ? 'rgba(201,168,120,0.10)' : 'var(--white)',
    }}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '0.02em' }}>{label}</div>
      <div className="serif" style={{
        marginTop: 4, fontSize: 26, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function SearchBox({ placeholder, width }) {
  return (
    <div style={{
      width, display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--white)', border: '1px solid var(--line)',
      borderRadius: 12, padding: '0 14px', height: 44,
    }}>
      <span style={{ color: 'var(--muted)' }}>⌕</span>
      <input
        placeholder={placeholder}
        style={{
          flex: 1, border: 0, background: 'transparent', outline: 'none',
          fontFamily: 'Manrope', fontSize: 13.5, color: 'var(--ink)',
        }}
      />
    </div>
  );
}

function SegPills({ items, sel = 0 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(34,30,26,0.05)', borderRadius: 999, padding: 4,
    }}>
      {items.map((it, i) => (
        <span key={it} style={{
          padding: '7px 14px', borderRadius: 999,
          background: i === sel ? 'var(--white)' : 'transparent',
          color: i === sel ? 'var(--ink)' : 'var(--ink-2)',
          fontSize: 12.5, fontWeight: 600,
          boxShadow: i === sel ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
          cursor: 'pointer',
        }}>{it}</span>
      ))}
    </div>
  );
}

Object.assign(window, { AdminUsers, AdminGenerations, AdminFinance, AdminSettings });
