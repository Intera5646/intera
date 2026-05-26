// INTERA v2 — Screens A: Welcome, SignUp, Home, Upload

// Shared bottom tab
function TabBar({ active = 'home' }) {
  const items = [
    { id: 'home',     label: 'Главная',     Icon: IconHome },
    { id: 'projects', label: 'Проекты',     Icon: IconGrid },
    { id: 'inspire',  label: 'Вдохновение', Icon: IconHeart },
    { id: 'profile',  label: 'Профиль',     Icon: IconUser },
  ];
  return (
    <div className="tabbar">
      {items.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <div key={id} className={'tab' + (isActive ? ' active' : '')}>
            <Icon size={22} sw={isActive ? 1.9 : 1.5} />
            <div>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1) WELCOME — hero photo + logo overlay + black "Войти" CTA
// ─────────────────────────────────────────────────────────────
function ScreenWelcome() {
  return (
    <div className="scr" style={{ overflow: 'hidden' }}>
      {/* Full-bleed hero "photo" (placeholder beige room) */}
      <div className="room" style={{
        position: 'absolute', inset: 0,
      }} />
      {/* Subtle bottom darken so CTA reads */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(180deg, rgba(248,240,225,0.0) 30%, rgba(50,38,28,0.55) 100%)',
      }} />

      {/* Centered logo plate */}
      <div style={{
        position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
        padding: '20px 26px 18px',
        background: 'rgba(251,247,240,0.74)',
        backdropFilter: 'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: '0 8px 30px rgba(50,40,25,0.10)',
        textAlign: 'center',
      }}>
        <LogoMark size={68} />
      </div>

      {/* Title block */}
      <div style={{
        position: 'absolute', left: 28, right: 28, bottom: 178,
      }}>
        <div className="serif" style={{
          fontSize: 32, lineHeight: 1.05, color: '#FBF7F0',
          fontStyle: 'italic', fontWeight: 500,
          textShadow: '0 2px 10px rgba(0,0,0,0.30)',
        }}>
          AI Interior Design
        </div>
        <div style={{
          marginTop: 10, fontSize: 14, color: 'rgba(251,247,240,0.92)',
          lineHeight: 1.45, textShadow: '0 1px 6px rgba(0,0,0,0.30)',
          maxWidth: 270,
        }}>
          Ваш личный дизайнер<br/>интерьера на базе&nbsp;AI
        </div>
        {/* dot pager */}
        <div style={{ marginTop: 18, display: 'flex', gap: 6 }}>
          <span style={{ width: 22, height: 6, borderRadius: 3, background: '#FBF7F0' }} />
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(251,247,240,0.55)' }} />
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(251,247,240,0.55)' }} />
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', left: 22, right: 22, bottom: 56,
      }}>
        <button className="btn btn--dark btn--block" style={{ height: 58, fontSize: 16, borderRadius: 16 }}>
          Войти
        </button>
        <div style={{
          marginTop: 14, textAlign: 'center', fontSize: 13,
          color: 'rgba(251,247,240,0.92)', textShadow: '0 1px 6px rgba(0,0,0,0.25)',
        }}>
          Нет аккаунта? <u style={{ textDecorationColor: 'rgba(251,247,240,0.6)' }}>Создать аккаунт</u>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2) SIGN UP — paper bg, logo center, form, social
// ─────────────────────────────────────────────────────────────
function ScreenSignUp() {
  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      {/* Back */}
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ width: 38 }} />
      </div>

      {/* Centered logo */}
      <div style={{
        position: 'absolute', top: 92, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <LogoMark size={56} />
      </div>

      {/* Title */}
      <div style={{
        position: 'absolute', top: 232, left: 28, right: 28, textAlign: 'center',
      }}>
        <div className="serif" style={{
          fontSize: 26, color: 'var(--ink)', fontStyle: 'italic',
        }}>Создать аккаунт</div>
        <div style={{
          marginTop: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 280, margin: '8px auto 0',
        }}>
          Создайте аккаунт, чтобы сохранять проекты и получать персональные рекомендации.
        </div>
      </div>

      {/* Form */}
      <div style={{
        position: 'absolute', top: 340, left: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div className="input">
          <IconUser size={18} color="var(--muted)" sw={1.6} />
          <input placeholder="Имя" />
        </div>
        <div className="input">
          <IconMail size={18} color="var(--muted)" sw={1.6} />
          <input placeholder="E-mail" />
        </div>
        <div className="input">
          <IconLock size={18} color="var(--muted)" sw={1.6} />
          <input type="password" placeholder="Пароль" />
          <IconEye size={18} color="var(--muted)" sw={1.6} />
        </div>
        <button className="btn btn--mocha btn--block" style={{ marginTop: 6, height: 52 }}>
          Создать аккаунт
        </button>
      </div>

      {/* Divider + socials */}
      <div style={{
        position: 'absolute', bottom: 100, left: 24, right: 24, textAlign: 'center',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em' }}>или продолжить с</div>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
          <SocialDot label="Apple" />
          <SocialDot label="G" />
          <SocialDot label="Mail" />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 56, left: 0, right: 0, textAlign: 'center',
        fontSize: 13, color: 'var(--muted)',
      }}>
        Уже есть аккаунт? <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Войти</span>
      </div>
    </div>
  );
}

function SocialDot({ label }) {
  return (
    <div style={{
      width: 50, height: 50, borderRadius: '50%',
      background: 'var(--white)',
      border: '1px solid var(--line-2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'serif', fontWeight: 600, fontSize: 18, color: 'var(--ink-2)',
    }}>{label === 'Apple' ? '' : label === 'Mail' ? '✉' : label}
      {label === 'Apple' && <span style={{ fontSize: 22 }}></span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3) HOME — Привет, Анна
// ─────────────────────────────────────────────────────────────
function ScreenHome() {
  return (
    <div className="scr" style={{ overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="tophdr">
        <button className="icobtn"><IconMenu size={22} sw={1.8} /></button>
        <button className="icobtn"><IconBell2 size={22} sw={1.8} /></button>
      </div>

      {/* Hello block with floating mini-logo on right */}
      <div style={{
        position: 'absolute', top: 110, left: 22, right: 22,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div className="serif" style={{ fontSize: 30, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1 }}>
            Привет, Анна
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
            Добро пожаловать в <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>INTERA</span>
          </div>
        </div>
        <div style={{ marginTop: -8, opacity: 0.92 }}>
          <LogoMark size={44} sub={false} />
        </div>
      </div>

      {/* Body scrollable area */}
      <div style={{
        position: 'absolute', top: 196, left: 0, right: 0, bottom: 90,
        overflow: 'auto', padding: '0 22px 24px',
      }}>
        {/* Big create card */}
        <div style={{
          background: 'var(--white)',
          borderRadius: 22,
          border: '1px solid var(--line)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
        }}>
          <div style={{ flex: 1, padding: '18px 16px 18px 18px' }}>
            <div className="serif" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1.1 }}>
              Создать<br/>новый проект
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45, maxWidth: 160 }}>
              Начните преображение<br/>вашего пространства
            </div>
          </div>
          <div style={{ width: 132, position: 'relative' }}>
            <div className="room flat" style={{
              position: 'absolute', inset: 0,
              background:
                'radial-gradient(80% 60% at 60% 40%, #F1E2C9 0%, #D9C2A2 60%, #B69B78 100%)',
            }} />
            {/* Plus circle */}
            <div style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              width: 46, height: 46, borderRadius: '50%',
              background: 'var(--mocha)', color: 'var(--paper)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 14px rgba(120,90,55,0.30)',
            }}>
              <IconPlus size={22} sw={2.2} />
            </div>
          </div>
        </div>

        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginTop: 22, marginBottom: 10,
        }}>
          <div className="sec-title">Недавние проекты</div>
          <div style={{ fontSize: 12, color: 'var(--mocha-2)', fontWeight: 600 }}>
            Смотреть все
          </div>
        </div>

        {/* Project cards */}
        <div className="col gap-10">
          <HomeProject title="Квартира в центре" sub="Гостиная · 24 м²" date="Обновлено 2 дня назад" tone="" />
          <HomeProject title="Загородный дом" sub="Кухня · 18 м²" date="Обновлено 5 дней назад" tone="light" />
        </div>
      </div>

      <TabBar active="home" />
    </div>
  );
}

function HomeProject({ title, sub, date, tone }) {
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 16,
      border: '1px solid var(--line)',
      padding: 10, display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <div className={'room flat ' + tone} style={{
        width: 70, height: 70, borderRadius: 12, flexShrink: 0,
        background: tone === 'light'
          ? 'linear-gradient(135deg, #F6E8CC, #D5BC93)'
          : 'linear-gradient(135deg, #E5D2B2, #B49770)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{sub}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{date}</div>
      </div>
      <button className="icobtn" style={{ width: 28, height: 28 }}>
        <IconMore size={18} color="var(--muted)" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4) UPLOAD PHOTOS
// ─────────────────────────────────────────────────────────────
function ScreenUpload() {
  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Загрузите фото</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Body */}
      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 96,
        overflow: 'auto', padding: '0 22px 24px',
      }}>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
          Добавьте фотографию комнаты<br/>для анализа AI
        </div>

        {/* Dashed upload zone */}
        <div style={{
          marginTop: 18,
          background: 'var(--white)',
          border: '1.5px dashed rgba(34,30,26,0.22)',
          borderRadius: 18,
          padding: '36px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: 'rgba(184,160,131,0.16)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--mocha-2)',
            marginBottom: 12,
          }}>
            <IconCloud size={28} sw={1.7} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
            Перетащите фото сюда<br/>или нажмите, чтобы выбрать
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
            JPG, PNG, до 20 МБ
          </div>
        </div>

        {/* Added thumbnails */}
        <div style={{ marginTop: 22, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="sec-title">Добавлено <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(до 10 фото)</span></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[0,1,2].map(i => (
            <div key={i} className="room flat" style={{
              aspectRatio: '1 / 1', borderRadius: 12,
              background: i === 0
                ? 'linear-gradient(135deg, #F0E1C5, #C8AC83)'
                : i === 1
                ? 'linear-gradient(135deg, #ECDCBE, #B89B77)'
                : 'linear-gradient(135deg, #F7EBD3, #D6BC95)',
            }} />
          ))}
          <div style={{
            aspectRatio: '1 / 1', borderRadius: 12,
            background: 'rgba(184,160,131,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--mocha-2)',
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18,
          }}>+6</div>
        </div>

        {/* Floor plan */}
        <div style={{ marginTop: 22, marginBottom: 10 }}>
          <div className="sec-title">План помещения <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(опционально)</span></div>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', height: 50,
          background: 'var(--white)', border: '1px solid var(--line-2)',
          borderRadius: 12, color: 'var(--ink-2)',
          fontFamily: 'Manrope', fontSize: 14, fontWeight: 600,
        }}>
          <IconFile size={18} sw={1.6} color="var(--mocha-2)" />
          Загрузить план
        </button>
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

Object.assign(window, { TabBar, ScreenWelcome, ScreenSignUp, ScreenHome, ScreenUpload });
