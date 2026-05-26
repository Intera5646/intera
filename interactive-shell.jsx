// INTERA — Interactive prototype shell.
// Owns navigation state, runs slide / modal transitions, mounts hotspots,
// shows the first-load hint overlay and an in-page reset button.

function InteractivePrototype() {
  const [current, setCurrent] = useState('welcome');
  // Animation state: when set, we render two layers and animate between them.
  const [anim, setAnim] = useState(null); // { from, to, dir }
  const [showHints, setShowHints] = useState(true);
  const [hintsDismissed, setHintsDismissed] = useState(false);

  // Auto-dismiss the hint overlay after a few seconds (still leaves hotspots tinted)
  useEffect(() => {
    if (!hintsDismissed) {
      const id = setTimeout(() => setShowHints(false), 2800);
      return () => clearTimeout(id);
    }
  }, [hintsDismissed]);

  // Navigate (forward / back / modal)
  const nav = useCallback((to, dir = 'forward') => {
    if (to === current) return;
    setShowHints(false);
    setHintsDismissed(true);
    setAnim({ from: current, to, dir });
    // Settle after animation
    setTimeout(() => {
      setCurrent(to);
      setAnim(null);
    }, dir === 'modal' ? 400 : 300);
  }, [current]);

  // Auto-advance support (loading screen)
  useEffect(() => {
    const rule = AUTO_ADVANCE[current];
    if (rule) {
      const id = setTimeout(() => nav(rule.to, 'forward'), rule.after);
      return () => clearTimeout(id);
    }
  }, [current, nav]);

  // Helper: layer style for transition
  function layerStyle(role) {
    // role: 'static' | 'from' | 'to'
    const base = {
      position: 'absolute', inset: 0,
      willChange: 'transform, opacity',
    };
    if (!anim) return base;
    const { dir } = anim;
    if (role === 'from') {
      if (dir === 'modal') {
        return { ...base, animation: 'modalFromOut 400ms ease-out both' };
      }
      const outX = dir === 'back' ? '100%' : '-100%';
      return {
        ...base,
        animation: `slideOut 300ms ease-out both`,
        '--outX': outX,
      };
    }
    if (role === 'to') {
      if (dir === 'modal') {
        return { ...base, animation: 'modalFromIn 400ms ease-out both' };
      }
      const inX = dir === 'back' ? '-100%' : '100%';
      return {
        ...base,
        animation: `slideIn 300ms ease-out both`,
        '--inX': inX,
      };
    }
    return base;
  }

  return (
    <div style={{
      position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Current screen (static when not animating) */}
      {!anim && (
        <div style={layerStyle('static')} key={`s-${current}`}>
          {getScreenComponent(current)}
          <Hotspots screen={current} nav={nav} showHints={showHints} />
        </div>
      )}

      {/* Animating: render both layers */}
      {anim && (
        <React.Fragment>
          <div style={layerStyle('from')} key={`f-${anim.from}`}>
            {getScreenComponent(anim.from)}
          </div>
          <div style={layerStyle('to')} key={`t-${anim.to}`}>
            {getScreenComponent(anim.to)}
          </div>
        </React.Fragment>
      )}

      {/* First-load hint overlay (semi-transparent dark + tooltip) */}
      {showHints && !anim && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          animation: 'fadeOut 400ms ease-in 2400ms forwards',
          background: 'radial-gradient(60% 40% at 50% 78%, rgba(0,0,0,0.25), transparent 70%)',
          zIndex: 5,
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(20,16,12,0.88)',
            color: '#F4E7CB', padding: '12px 18px', borderRadius: 12,
            fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.30)',
            fontFamily: 'Manrope, sans-serif',
            textAlign: 'center',
          }}>
            ✦ Кликните по подсвеченным областям
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page chrome: iPhone frame + reset button + breadcrumb ───
function PrototypeStage() {
  const [resetKey, setResetKey] = useState(0);
  const [screenLabel, setScreenLabel] = useState('welcome');

  // Hook into prototype state via DOM mutation (cheap, no extra context)
  // Each screen has a unique scr container; we read it after each navigation.
  useEffect(() => {
    const id = setInterval(() => {
      const el = document.querySelector('[data-current-screen]');
      if (el) setScreenLabel(el.dataset.currentScreen);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background:
        'radial-gradient(60% 60% at 50% 0%, #E8DCC4 0%, #D6C5A8 60%, #B89A6B 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'Manrope, sans-serif',
      gap: 30,
    }}>
      {/* Phone */}
      <div style={{ position: 'relative' }}>
        <IOSDevice width={STAGE_W} height={STAGE_H}>
          <InteractivePrototype key={resetKey} />
        </IOSDevice>
      </div>

      {/* Side panel — reset + screen list */}
      <div style={{
        width: 250, alignSelf: 'center',
        background: 'rgba(251,247,240,0.55)',
        backdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.45)',
        borderRadius: 18, padding: 18,
        boxShadow: '0 12px 30px rgba(50,40,25,0.10)',
      }}>
        <div className="wordmark" style={{ fontSize: 13, color: 'var(--ink)' }}>INTERA</div>
        <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 2, color: 'var(--ink)' }}>
          Interactive
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>
          14-экранный кликабельный прототип.<br/>
          Подсвеченные области — это&nbsp;хит-боксы.
        </div>

        <button
          onClick={() => setResetKey(k => k + 1)}
          style={{
            marginTop: 14, width: '100%',
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--ink)', color: 'var(--paper)', border: 0,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >↺ Перезапустить</button>

        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(34,30,26,0.10)',
          fontSize: 11, color: 'var(--muted)', letterSpacing: '0.05em',
          textTransform: 'uppercase', fontWeight: 700,
        }}>Карта переходов</div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
          <div>Welcome → Главная</div>
          <div>Welcome → Создать аккаунт</div>
          <div>Главная → Загрузка</div>
          <div>Загрузка → Параметры</div>
          <div>Параметры → Предпочтения</div>
          <div>Предпочтения → Генерация</div>
          <div style={{ color: 'var(--mocha-2)', fontWeight: 600 }}>Генерация → Результат (3 с)</div>
          <div>Результат → Просмотр</div>
          <div>Просмотр → Объяснения / Покупки</div>
          <div>Профиль → Магазин токенов</div>
          <div style={{ color: 'var(--mocha-2)', fontWeight: 600 }}>Магазин → Оплата (slide-up)</div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrototypeStage />);
