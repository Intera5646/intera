// INTERA — Interactive prototype router
// Stacks screens with slide / fade transitions and overlays invisible
// hotspot regions on top of each static screen to wire navigation.

const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// ─── Stage size ──────────────────────────────────────────────
const STAGE_W = 375;
const STAGE_H = 812;

// ─── Hotspot maps (one per screen) ───────────────────────────
// Coords are in stage pixels (375 × 812). `to` is the next screen key.
// `dir` overrides direction: 'back' (slide right) | 'modal' (slide up).
const HOTSPOTS = {
  welcome: [
    { top: 696, left: 22, width: 331, height: 58, to: 'home',   hint: 'Войти' },
    { top: 757, left: 90, width: 195, height: 30, to: 'signup', hint: 'Создать аккаунт' },
  ],
  signup: [
    { top: 56,  left: 14, width: 44,  height: 44, to: 'welcome', dir: 'back', hint: 'Назад' },
    { top: 480, left: 24, width: 327, height: 52, to: 'home',   hint: 'Создать' },
  ],
  home: [
    // Big create card (top section, full-width hero)
    { top: 196, left: 22, width: 331, height: 130, to: 'upload', hint: 'Создать проект' },
    // Bottom tabs (4 evenly split)
    { top: 760, left: 0,    width: 94, height: 52, to: 'home',     hint: 'Главная' },
    { top: 760, left: 94,   width: 94, height: 52, to: 'shopping', hint: 'Проекты' },
    { top: 760, left: 188,  width: 94, height: 52, to: 'shop',     hint: 'Вдохновение' },
    { top: 760, left: 282,  width: 93, height: 52, to: 'profile',  hint: 'Профиль' },
    // Top right bell
    { top: 56,  left: 320, width: 44, height: 44, to: 'profile', hint: 'Уведомления' },
  ],
  upload: [
    { top: 56,  left: 14, width: 44,  height: 44, to: 'home',   dir: 'back', hint: 'Назад' },
    { top: 774, left: 22, width: 331, height: 54, to: 'params', hint: 'Продолжить' },
  ],
  params: [
    { top: 56,  left: 14, width: 44,  height: 44, to: 'upload', dir: 'back', hint: 'Назад' },
    { top: 774, left: 22, width: 331, height: 54, to: 'prefs',  hint: 'Продолжить' },
  ],
  prefs: [
    { top: 56,  left: 14, width: 44,  height: 44, to: 'params',  dir: 'back', hint: 'Назад' },
    { top: 774, left: 22, width: 331, height: 54, to: 'loading', hint: 'Продолжить' },
  ],
  loading: [
    // Auto-advance; back arrow lets user escape
    { top: 56, left: 14, width: 44, height: 44, to: 'prefs', dir: 'back', hint: 'Отменить' },
  ],
  result: [
    { top: 56,  left: 14, width: 44,  height: 44, to: 'home',   dir: 'back', hint: 'Назад' },
    { top: 752, left: 22, width: 331, height: 54, to: 'render', hint: 'Продолжить к деталям' },
    // Explanations hotspot — middle action button (Регенерировать = центр)
    { top: 632, left: 144, width: 88, height: 76, to: 'explanations', hint: 'Объяснения' },
  ],
  render: [
    { top: 56,  left: 14, width: 44, height: 44, to: 'result',       dir: 'back', hint: 'Назад' },
    // bottom sheet buttons
    { top: 730, left: 22, width: 158, height: 50, to: 'explanations', hint: 'Объяснения / PDF' },
    { top: 730, left: 195, width: 158, height: 50, to: 'shopping',    hint: 'К покупкам' },
  ],
  explanations: [
    { top: 56, left: 14, width: 44, height: 44, to: 'render', dir: 'back', hint: 'Назад' },
  ],
  shopping: [
    { top: 56, left: 14, width: 44, height: 44, to: 'render', dir: 'back', hint: 'Назад' },
    // Sticky total — full smeta button
    { top: 740, left: 198, width: 156, height: 50, to: 'success', hint: 'Полная смета' },
  ],
  profile: [
    { top: 56,  left: 14, width: 44, height: 44, to: 'home',  dir: 'back', hint: 'Назад' },
    // Premium subscription row → token shop
    { top: 300, left: 22, width: 331, height: 64, to: 'shop',  hint: 'Магазин токенов' },
    // "Выйти" → welcome
    { top: 738, left: 22, width: 331, height: 52, to: 'welcome', hint: 'Выйти' },
  ],
  shop: [
    { top: 56, left: 14, width: 44, height: 44, to: 'profile', dir: 'back', hint: 'Назад' },
    // 3 plan "Купить" buttons (right side of each plan card)
    // Plans stack: balance card ~110-220, then Тарифы header, then cards
    { top: 360, left: 270, width: 80, height: 32, to: 'success', dir: 'modal', hint: 'Купить Эскиз' },
    { top: 442, left: 270, width: 80, height: 32, to: 'success', dir: 'modal', hint: 'Купить Проект' },
    { top: 524, left: 270, width: 80, height: 32, to: 'success', dir: 'modal', hint: 'Купить Студия' },
  ],
  success: [
    { top: 712, left: 22, width: 331, height: 56, to: 'home', hint: 'Создать новый проект' },
    { top: 782, left: 0,  width: 375, height: 30, to: 'profile', hint: 'История покупок' },
  ],
};

// ─── Auto-advance from Loading ───────────────────────────────
const AUTO_ADVANCE = {
  loading: { to: 'result', after: 3200 },
};

// ─── Screen registry ─────────────────────────────────────────
function getScreenComponent(key) {
  switch (key) {
    case 'welcome':      return <ScreenWelcome />;
    case 'signup':       return <ScreenSignUp />;
    case 'home':         return <ScreenHome />;
    case 'upload':       return <ScreenUpload />;
    case 'params':       return <ScreenParams />;
    case 'prefs':        return <ScreenPreferences />;
    case 'loading':      return <ScreenLoadingAnimated />;   // wrapper with animated ring
    case 'result':       return <ScreenResultAnimated />;    // wrapper with staggered fade-in
    case 'render':       return <ScreenRender />;
    case 'explanations': return <ScreenExplanations />;
    case 'shopping':     return <ScreenShopping />;
    case 'profile':      return <ScreenProfile />;
    case 'shop':         return <ScreenShop />;
    case 'success':      return <ScreenPaymentSuccessAnimated />;
    default:             return <ScreenWelcome />;
  }
}

// ─── Hotspots overlay ────────────────────────────────────────
function Hotspots({ screen, nav, showHints }) {
  const list = HOTSPOTS[screen] || [];
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
    }}>
      {list.map((h, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            nav(h.to, h.dir || 'forward');
          }}
          style={{
            position: 'absolute',
            top: h.top, left: h.left, width: h.width, height: h.height,
            background: showHints ? 'rgba(232, 145, 90, 0.22)' : 'transparent',
            border: showHints ? '1.5px dashed rgba(232, 145, 90, 0.85)' : 'none',
            borderRadius: 12,
            cursor: 'pointer', padding: 0,
            pointerEvents: 'auto',
            transition: 'transform 150ms ease, background 200ms',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={(e)   => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={(e)=> { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {showHints && (
            <span style={{
              position: 'absolute', top: 4, left: 6,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
              color: '#7A3A18', background: 'rgba(255,255,255,0.85)',
              padding: '2px 6px', borderRadius: 4,
              fontFamily: 'JetBrains Mono, monospace',
            }}>{h.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Animated wrappers ───────────────────────────────────────

// Loading: progress ring 0→100 over 3s; checkmarks pop in with bounce
function ScreenLoadingAnimated() {
  const [pct, setPct] = useState(0);
  const [step, setStep] = useState(0); // 0..4 indicates checked steps
  const r = 64, C = 2 * Math.PI * r;

  useEffect(() => {
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 3000);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setPct(Math.round(eased * 100));
      // step thresholds
      setStep(p > 0.85 ? 4 : p > 0.65 ? 3 : p > 0.40 ? 2 : p > 0.15 ? 1 : 0);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="scr" style={{
      overflow: 'hidden',
      background: 'radial-gradient(60% 50% at 50% 30%, #F1E2C7 0%, #E0CCA9 60%, #C7AB82 100%)',
    }}>
      <Botanical side="left" />
      <Botanical side="right" />

      <div className="tophdr">
        <span className="icobtn"><IconBack size={20} sw={1.8} color="var(--ink-2)" /></span>
        <div style={{ width: 38 }} />
      </div>

      <div style={{
        position: 'absolute', top: 110, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      }}>
        <LogoMark size={60} />
      </div>

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
              style={{
                strokeDasharray: C,
                strokeDashoffset: C * (1 - pct / 100),
                transition: 'stroke-dashoffset 90ms linear',
              }}
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

      <div style={{ position: 'absolute', top: 568, left: 30, right: 30 }}>
        {[
          'Анализ пространства',
          'Распознавание стиля',
          'Подбор материалов и мебели',
          'Генерация дизайна',
        ].map((label, i) => {
          const done = step > i;
          return (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: done ? 'var(--ink)' : 'transparent',
                border: done ? 'none' : '1.5px solid rgba(34,30,26,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transform: done ? 'scale(1)' : 'scale(0.9)',
                animation: done ? 'bouncePop 360ms cubic-bezier(.34,1.56,.64,1)' : 'none',
              }}>
                {done && <IconCheck size={11} sw={3} color="var(--paper)" />}
              </div>
              <div style={{
                fontSize: 13.5,
                color: done ? 'var(--ink)' : 'var(--muted)',
                fontWeight: done ? 600 : 500,
                transition: 'color 200ms',
              }}>{label}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', left: 22, right: 22, bottom: 42,
        background: 'rgba(251,247,240,0.7)',
        backdropFilter: 'blur(10px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: 14, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>✦</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          Готовится 4 варианта концепции.<br/>Можно закрыть — пришлём пуш, когда будет готово.
        </div>
      </div>
    </div>
  );
}

// Result: re-mount key forces staggered fade-in on enter
function ScreenResultAnimated() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ScreenResult />
      <style>{`
        .scr.paper .render { animation: fadeUp 500ms ease-out both; animation-delay: 100ms; }
      `}</style>
    </div>
  );
}

// Payment success: animated checkmark stroke + count-up
function ScreenPaymentSuccessAnimated() {
  const [n, setN] = useState(2);
  useEffect(() => {
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0 - 700) / 900); // start after check anim
      if (p > 0) setN(Math.round(2 + p * 20));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="scr" style={{
      overflow: 'hidden',
      background: 'radial-gradient(60% 50% at 50% 30%, #F4E7CB 0%, #DDC59C 60%, #C0A37A 100%)',
    }}>
      <Botanical side="left" />
      <Botanical side="right" />

      <div className="tophdr">
        <span className="icobtn"><IconBack size={20} sw={1.8} /></span>
        <div style={{ width: 38 }} />
      </div>

      <div style={{
        position: 'absolute', inset: 0, padding: '0 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18,
      }}>
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          <div style={{
            position: 'absolute', inset: -14, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,120,0.30) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #EFD8AC 0%, #C9A878 60%, #8E7044 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 28px rgba(140,108,60,0.35), inset 0 -6px 16px rgba(0,0,0,0.10)',
            animation: 'popIn 500ms cubic-bezier(.34,1.56,.64,1) both',
          }}>
            <svg width="58" height="44" viewBox="0 0 58 44" fill="none">
              <path d="M5 22 L22 39 L53 5"
                stroke="#FBF7F0" strokeWidth="6"
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  strokeDasharray: 80,
                  strokeDashoffset: 80,
                  animation: 'drawCheck 600ms 400ms ease-out forwards',
                }}
              />
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 30, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.1 }}>
            Токены начислены!
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: 'var(--ink-2)' }}>
            +20 токенов добавлены на ваш счёт
          </div>
        </div>

        <div style={{
          marginTop: 4,
          background: 'rgba(251,247,240,0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 18, padding: '16px 24px',
          textAlign: 'center', minWidth: 220,
        }}>
          <div className="smallcaps" style={{ fontSize: 10 }}>Текущий баланс</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
            <div className="serif" style={{
              fontSize: 38, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>{n}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>токена</div>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>Срок действия не ограничен</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 70 }}>
        <button className="btn btn--dark btn--block" style={{ height: 56, fontSize: 15 }}>
          Создать новый проект
        </button>
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 38, textAlign: 'center',
        fontSize: 13, color: 'var(--ink-2)',
      }}>
        <u style={{ textDecorationColor: 'var(--mocha)' }}>История покупок</u>
      </div>
    </div>
  );
}

Object.assign(window, {
  HOTSPOTS, AUTO_ADVANCE, STAGE_W, STAGE_H,
  Hotspots, getScreenComponent,
  ScreenLoadingAnimated, ScreenResultAnimated, ScreenPaymentSuccessAnimated,
});
