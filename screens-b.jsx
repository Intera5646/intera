// INTERA v2 — Screens B: Project Params, Preferences, Loading

// ─────────────────────────────────────────────────────────────
// 5) PROJECT PARAMETERS
// ─────────────────────────────────────────────────────────────
function ScreenParams() {
  const rooms = [
    { Icon: IconKitchen, label: 'Кухня' },
    { Icon: IconSofa,    label: 'Гостиная', sel: true },
    { Icon: IconBed,     label: 'Спальня' },
    { Icon: IconBath,    label: 'Ванная' },
    { Icon: IconStudio,  label: 'Студия' },
    { Icon: IconDots4,   label: 'Другое' },
  ];
  const stages = [
    { label: 'Косметическое обновление' },
    { label: 'Редизайн существующего интерьера', sel: true },
    { label: 'Капитальный ремонт с нуля' },
    { label: 'Новостройка / пустая комната' },
  ];

  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Параметры проекта</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Body */}
      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 96,
        overflow: 'auto', padding: '0 22px 30px',
      }}>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Расскажите о вашем пространстве
        </div>

        {/* Тип помещения */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Тип помещения</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {rooms.map(({ Icon, label, sel }) => (
            <div key={label} style={{
              background: sel ? 'var(--mocha)' : 'var(--white)',
              color: sel ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid ' + (sel ? 'var(--mocha)' : 'var(--line)'),
              borderRadius: 14, padding: '14px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <Icon size={22} sw={1.6} color={sel ? 'var(--paper)' : 'var(--mocha-2)'} />
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Тип недвижимости */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Тип недвижимости</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PropertyChip Icon={IconApt}   label="Квартира"   selected />
          <PropertyChip Icon={IconHouse} label="Частный дом" />
        </div>

        {/* Этап ремонта */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Этап ремонта</div>
        <div className="col gap-8">
          {stages.map(s => (
            <div key={s.label} style={{
              background: 'var(--white)',
              borderRadius: 12, padding: '12px 14px',
              border: '1px solid ' + (s.sel ? 'var(--mocha-l)' : 'var(--line)'),
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '1.6px solid ' + (s.sel ? 'var(--mocha)' : 'var(--line-2)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {s.sel && <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--mocha)',
                }} />}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: s.sel ? 600 : 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        position: 'absolute', left: 22, right: 22, bottom: 38,
      }}>
        <button className="btn btn--mocha btn--block" style={{ height: 54 }}>
          Продолжить
        </button>
      </div>
    </div>
  );
}

function PropertyChip({ Icon, label, selected }) {
  return (
    <div style={{
      background: selected ? 'var(--mocha-l)' : 'var(--white)',
      border: '1px solid ' + (selected ? 'var(--mocha)' : 'var(--line)'),
      borderRadius: 14, padding: '14px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      color: 'var(--ink-2)',
    }}>
      <Icon size={20} sw={1.6} color={selected ? 'var(--mocha-2)' : 'var(--ink-2)'} />
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 6) PREFERENCES
// ─────────────────────────────────────────────────────────────
function ScreenPreferences() {
  const styles = [
    { label: 'Минимализм', sel: true, bg: 'linear-gradient(135deg, #EEDEC2, #C7AC86)' },
    { label: 'Скандинавский', bg: 'linear-gradient(135deg, #F5EBD9, #D6C2A4)' },
    { label: 'Современная классика', bg: 'linear-gradient(135deg, #DDC9A8, #A6896A)' },
  ];

  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Ваши предпочтения</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 96,
        overflow: 'auto', padding: '0 22px 30px',
      }}>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Помогите AI создать интерьер мечты
        </div>

        {/* Стиль интерьера */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Стиль интерьера</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {styles.map(s => (
            <div key={s.label} style={{
              borderRadius: 14, overflow: 'hidden',
              border: s.sel ? '2px solid var(--mocha)' : '1px solid var(--line)',
              background: 'var(--white)',
            }}>
              <div className="room flat" style={{
                height: 74, background: s.bg,
              }} />
              <div style={{
                padding: '8px 8px 9px', textAlign: 'center',
                background: s.sel ? 'var(--mocha)' : 'var(--white)',
                color: s.sel ? 'var(--paper)' : 'var(--ink-2)',
                fontSize: 11.5, fontWeight: 600, lineHeight: 1.2,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Бюджет */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Бюджет</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['Эконом', 'Средний', 'Премиум'].map((b, i) => (
            <div key={b} style={{
              padding: '11px 8px', borderRadius: 12,
              background: i === 1 ? 'var(--mocha)' : 'var(--white)',
              color: i === 1 ? 'var(--paper)' : 'var(--ink-2)',
              border: '1px solid ' + (i === 1 ? 'var(--mocha)' : 'var(--line)'),
              textAlign: 'center', fontSize: 13.5, fontWeight: 600,
            }}>{b}</div>
          ))}
        </div>

        {/* Цветовая палитра */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Цветовая палитра</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--white)', borderRadius: 14, padding: '12px 14px',
          border: '1px solid var(--line)',
        }}>
          {[
            { c: '#FBF7F0', ring: 'var(--line-2)' },
            { c: '#1A1614' },
            { c: '#A28969' },
            { c: '#D6BC95' },
          ].map((p, i) => (
            <div key={i} style={{
              width: 30, height: 30, borderRadius: '50%',
              background: p.c, border: p.ring ? '1px solid ' + p.ring : 'none',
              boxShadow: i === 2 ? '0 0 0 2px var(--mocha), 0 0 0 4px var(--paper)' : 'none',
            }} />
          ))}
          <div style={{ flex: 1 }} />
          <IconChev size={18} color="var(--muted)" />
        </div>

        {/* Пожелания */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>
          Ваши пожелания <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(опционально)</span>
        </div>
        <div style={{
          background: 'var(--white)', borderRadius: 14, padding: '12px 14px',
          border: '1px solid var(--line)', position: 'relative',
        }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, minHeight: 60 }}>
            Например: больше мест хранения, натуральные материалы, тёплый свет…
          </div>
          <div style={{
            position: 'absolute', right: 12, bottom: 8,
            fontSize: 11, color: 'var(--muted-2)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>0/200</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 38 }}>
        <button className="btn btn--mocha btn--block" style={{ height: 54 }}>
          Продолжить
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 7) LOADING
// ─────────────────────────────────────────────────────────────
function ScreenLoading() {
  const pct = 65;
  const r = 64;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);

  return (
    <div className="scr" style={{
      overflow: 'hidden',
      background:
        'radial-gradient(60% 50% at 50% 30%, #F1E2C7 0%, #E0CCA9 60%, #C7AB82 100%)',
    }}>
      {/* botanical accents */}
      <Botanical side="left" />
      <Botanical side="right" />

      {/* Back */}
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} color="var(--ink-2)" /></button>
        <div style={{ width: 38 }} />
      </div>

      {/* Centered logo */}
      <div style={{
        position: 'absolute', top: 110, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <LogoMark size={60} />
      </div>

      {/* Progress ring */}
      <div style={{
        position: 'absolute', top: 300, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', width: 156, height: 156 }}>
          <svg width="156" height="156" viewBox="0 0 156 156" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="78" cy="78" r={r} stroke="rgba(34,30,26,0.10)" strokeWidth="3" fill="none" />
            <circle cx="78" cy="78" r={r}
              stroke="var(--ink)" strokeWidth="3.2" fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="serif" style={{
              fontSize: 38, color: 'var(--ink)', fontStyle: 'italic',
              fontVariantNumeric: 'tabular-nums',
            }}>{pct}%</div>
          </div>
        </div>

        <div className="serif" style={{
          marginTop: 22, fontSize: 18, fontStyle: 'italic',
          color: 'var(--ink)', textAlign: 'center', lineHeight: 1.3, maxWidth: 280,
        }}>
          AI анализирует фото<br/>и создаёт концепцию
        </div>
      </div>

      {/* Status */}
      <div style={{
        position: 'absolute', top: 568, left: 30, right: 30,
      }}>
        <StatusRow done label="Анализ пространства" />
        <StatusRow done label="Распознавание стиля" />
        <StatusRow pending label="Подбор материалов и мебели" />
        <StatusRow pending label="Генерация дизайна" />
      </div>

      {/* Bottom tip card */}
      <div style={{
        position: 'absolute', left: 22, right: 22, bottom: 42,
        background: 'rgba(251,247,240,0.7)',
        backdropFilter: 'blur(10px) saturate(160%)',
        WebkitBackdropFilter: 'blur(10px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: 14, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>✦</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          Это может занять до 60 секунд.<br/>Спасибо за ожидание!
        </div>
      </div>
    </div>
  );
}

function StatusRow({ done, pending, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '7px 0',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        background: done ? 'var(--ink)' : 'transparent',
        border: done ? 'none' : '1.5px solid rgba(34,30,26,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {done && <IconCheck size={11} sw={3} color="var(--paper)" />}
      </div>
      <div style={{
        fontSize: 13.5, color: done ? 'var(--ink)' : 'var(--muted)',
        fontWeight: done ? 600 : 500,
      }}>{label}</div>
    </div>
  );
}

function Botanical({ side }) {
  // Soft branch silhouette, drawn as a single curved path
  const flip = side === 'right';
  return (
    <svg
      width="160" height="240"
      viewBox="0 0 160 240"
      style={{
        position: 'absolute',
        top: side === 'right' ? 240 : 380,
        [side]: -30,
        opacity: 0.42,
        transform: flip ? 'scaleX(-1)' : 'none',
        pointerEvents: 'none',
      }}
      fill="none"
    >
      <path d="M 30 240 Q 50 180 70 130 Q 80 90 90 30"
        stroke="#7A6342" strokeWidth="1.2" strokeLinecap="round" />
      {/* leaves */}
      {[40, 70, 100, 130, 160, 195].map((y, i) => {
        const x = 30 + (240 - y) * 0.18 + (i % 2 ? -10 : 14);
        const dy = i % 2 ? -1 : 1;
        return (
          <ellipse key={i}
            cx={x} cy={y}
            rx="7" ry="3"
            transform={`rotate(${dy * 30} ${x} ${y})`}
            fill="#7A6342"
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}

Object.assign(window, { ScreenParams, ScreenPreferences, ScreenLoading, Botanical });
