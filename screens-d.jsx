// INTERA v2 — Screens D: Full render, Shopping list, Designer explanations, Payment success

// ─────────────────────────────────────────────────────────────
// 11) FULL RENDER VIEW
// ─────────────────────────────────────────────────────────────
function ScreenRender() {
  return (
    <div className="scr" style={{ overflow: 'hidden' }}>
      {/* Full-bleed render */}
      <div className="render" style={{ position: 'absolute', inset: 0, borderRadius: 0 }}>
        {/* horizon */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '60%',
          height: 1, background: 'rgba(255,255,255,0.25)',
        }} />
        {/* sofa hint */}
        <div style={{
          position: 'absolute', left: '14%', bottom: '20%',
          width: '50%', height: '20%', borderRadius: 14,
          background: 'rgba(248,236,213,0.55)',
          border: '1px solid rgba(255,255,255,0.20)',
        }} />
        {/* arch window */}
        <div style={{
          position: 'absolute', right: '14%', top: '14%',
          width: '24%', height: '52%',
          borderRadius: '50% 50% 4px 4px / 30% 30% 4px 4px',
          background: 'rgba(255,253,247,0.30)',
          border: '1px solid rgba(255,255,255,0.30)',
        }} />
      </div>

      {/* Top bar (over render, with subtle dark gradient) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(180deg, rgba(40,30,18,0.32) 0%, rgba(40,30,18,0) 100%)',
        pointerEvents: 'none',
      }} />
      <div className="tophdr" style={{ position: 'absolute', top: 54 }}>
        <button className="icobtn glass" style={{
          background: 'rgba(255,253,247,0.75)', backdropFilter: 'blur(12px)',
        }}><IconBack size={20} sw={1.8} color="var(--ink)" /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{
            fontSize: 19, fontStyle: 'italic', color: '#FBF7F0',
            textShadow: '0 1px 6px rgba(0,0,0,0.30)',
          }}>Гостиная</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icobtn" style={{
            background: 'rgba(255,253,247,0.75)', backdropFilter: 'blur(12px)',
          }}><IconShare size={18} sw={1.6} color="var(--ink)" /></button>
          <button className="icobtn" style={{
            background: 'rgba(255,253,247,0.75)', backdropFilter: 'blur(12px)',
          }}><IconDownload size={18} sw={1.6} color="var(--ink)" /></button>
        </div>
      </div>

      {/* Swipe hint */}
      <div style={{
        position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center',
        fontSize: 11, color: 'rgba(40,30,18,0.55)', letterSpacing: '0.04em',
      }}>← Свайп для следующего варианта</div>

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--paper)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '12px 22px 32px',
        boxShadow: '0 -10px 26px rgba(40,30,18,0.18)',
      }}>
        {/* handle */}
        <div style={{
          width: 38, height: 4, borderRadius: 2,
          background: 'rgba(34,30,26,0.18)',
          margin: '0 auto 14px',
        }} />

        {/* badges row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div className="pill" style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(184,160,131,0.18)', border: 'none', color: 'var(--mocha-2)' }}>
            Скандинавский
          </div>
          <div className="pill" style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(34,30,26,0.06)', border: 'none', color: 'var(--ink-2)' }}>
            18 м²
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center',
            fontFamily: "'JetBrains Mono', monospace",
          }}>01 / 04</div>
        </div>

        {/* thumbnail row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[true, false, false, false].map((sel, i) => (
            <div key={i} className="room flat" style={{
              aspectRatio: '1 / 1', borderRadius: 10,
              border: sel ? '2px solid var(--mocha)' : '1px solid var(--line)',
              background: i === 0 ? 'linear-gradient(135deg, #EFE0C4, #C5A87E)'
                       : i === 1 ? 'linear-gradient(135deg, #F2E5CD, #D7BD93)'
                       : i === 2 ? 'linear-gradient(135deg, #E5D2B1, #B49770)'
                       :           'linear-gradient(135deg, #F7EBD3, #CFB58A)',
            }} />
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" style={{ flex: 1, height: 50, fontSize: 13.5 }}>
            <IconDownload size={16} sw={1.6} /> Скачать PDF
          </button>
          <button className="btn" style={{
            flex: 1, height: 50, fontSize: 13.5,
            background: 'linear-gradient(135deg, #D9BD86, #B79556)',
            color: '#1F1B16', fontWeight: 700,
          }}>
            К покупкам <IconChev size={16} color="#1F1B16" sw={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 12) SHOPPING LIST
// ─────────────────────────────────────────────────────────────
function ScreenShopping() {
  const items = [
    { name: 'Диван угловой Lumi',            cat: 'Мебель',    price: '42 500 ₽', store: 'Маркет',  tone: 1 },
    { name: 'Торшер Arch',                   cat: 'Свет',      price: '8 900 ₽',  store: 'Ozon',    tone: 2 },
    { name: 'Ковёр шерстяной 200×300',       cat: 'Текстиль',  price: '12 400 ₽', store: 'WB',      tone: 3 },
    { name: 'Подушки декоративные (2 шт)',   cat: 'Декор',     price: '3 200 ₽',  store: 'Ozon',    tone: 4 },
  ];

  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 21, fontStyle: 'italic' }}>Список покупок</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            12 позиций · ~84 000 ₽
          </div>
        </div>
        <button className="icobtn"><IconShare size={18} sw={1.6} /></button>
      </div>

      {/* Filter pills */}
      <div style={{
        position: 'absolute', top: 130, left: 0, right: 0,
        padding: '0 22px', display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {[
          { l: 'Все', sel: true },
          { l: 'Мебель' },
          { l: 'Свет' },
          { l: 'Декор' },
          { l: 'Текстиль' },
        ].map(p => (
          <div key={p.l} style={{
            padding: '8px 14px', borderRadius: 999,
            background: p.sel ? 'var(--ink)' : 'var(--white)',
            color: p.sel ? 'var(--paper)' : 'var(--ink-2)',
            border: '1px solid ' + (p.sel ? 'var(--ink)' : 'var(--line)'),
            fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
          }}>{p.l}</div>
        ))}
      </div>

      {/* Product list */}
      <div style={{
        position: 'absolute', top: 178, left: 0, right: 0, bottom: 124,
        overflow: 'auto', padding: '0 22px 16px',
      }}>
        <div className="col gap-10">
          {items.map((it, i) => <ProductCard key={i} {...it} />)}
          {/* "more" hint */}
          <div style={{
            padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--muted)',
            border: '1px dashed var(--line-2)', borderRadius: 14,
          }}>
            и ещё 8 позиций ↓
          </div>
        </div>
      </div>

      {/* Sticky total bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 22px 28px',
        background: 'var(--paper)',
        borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.05em' }}>ИТОГО</div>
          <div className="serif" style={{ fontSize: 21, color: 'var(--ink)', fontStyle: 'italic' }}>
            ~84 000 ₽
          </div>
        </div>
        <button className="btn" style={{
          height: 50, fontSize: 13, padding: '0 18px',
          background: 'linear-gradient(135deg, #D9BD86, #B79556)',
          color: '#1F1B16', fontWeight: 700,
        }}>
          <IconDownload size={16} sw={1.6} color="#1F1B16" /> Полная смета
        </button>
      </div>
    </div>
  );
}

function ProductCard({ name, cat, price, store, tone }) {
  const tones = [
    'linear-gradient(135deg, #ECDCBE, #B89B77)',
    'linear-gradient(135deg, #F5EBD9, #D6C2A4)',
    'linear-gradient(135deg, #E5D2B2, #B49770)',
    'linear-gradient(135deg, #F7EBD3, #CFB58A)',
  ];
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 16, padding: 10,
      border: '1px solid var(--line)',
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <div className="room flat" style={{
        width: 72, height: 72, borderRadius: 12, flexShrink: 0,
        background: tones[tone - 1] || tones[0],
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: 'var(--mocha-2)',
            padding: '2px 7px', borderRadius: 999, background: 'rgba(184,160,131,0.18)',
          }}>{cat}</span>
          <span style={{
            fontSize: 10.5, color: 'var(--muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>· {store}</span>
        </div>
        <div className="serif" style={{ fontSize: 16, color: 'var(--ink)', marginTop: 4, fontStyle: 'italic' }}>
          {price}
        </div>
      </div>
      <button style={{
        background: 'linear-gradient(135deg, #D9BD86, #B79556)',
        color: '#1F1B16', border: 0, padding: '8px 14px', borderRadius: 10,
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>Купить</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 13) DESIGNER EXPLANATIONS
// ─────────────────────────────────────────────────────────────
function ScreenExplanations() {
  const items = [
    {
      Icon: IconSofa,
      title: 'Расстановка мебели',
      text: 'Диван размещён напротив окна — это защищает обивку от выгорания UV-излучением. Зона отдыха сформирована по принципу «золотого треугольника».',
    },
    {
      Icon: IconLayers,
      title: 'Цветовое решение',
      text: 'Нейтральная база (бежевый, белый) визуально увеличивает пространство на 30%. Акцентный цвет введён через подушки и декор — легко менять.',
    },
    {
      Icon: IconBulb,
      title: 'Освещение',
      text: 'Три уровня освещения: общий свет + торшер + декоративные огни. Это стандарт в дизайне интерьера, устраняет «плоский» свет от одной лампы.',
    },
  ];

  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 21, fontStyle: 'italic' }}>Объяснения дизайнера</div>
        </div>
        <button className="icobtn"><IconShare size={18} sw={1.6} /></button>
      </div>

      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 38,
        overflow: 'auto', padding: '0 22px 24px',
      }}>
        {/* AI avatar card */}
        <div style={{
          background: 'var(--white)', borderRadius: 18,
          border: '1px solid var(--line)', padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* gold blob decor */}
          <div style={{
            position: 'absolute', right: -30, top: -30, width: 120, height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,120,0.20) 0%, transparent 70%)',
          }} />
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #E8D5B5, #B89556 65%, #856335)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1F1B16', flexShrink: 0,
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18,
            fontStyle: 'italic',
            boxShadow: '0 4px 14px rgba(184,140,80,0.30)',
          }}>AI</div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div className="serif" style={{
              fontSize: 17, color: 'var(--ink)', fontStyle: 'italic',
            }}>
              INTERA Design AI
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
              На основе 50 000+ реальных проектов
            </div>
          </div>
        </div>

        {/* Explanation cards */}
        <div className="col gap-10" style={{ marginTop: 14 }}>
          {items.map(({ Icon, title, text }) => (
            <div key={title} style={{
              background: 'var(--white)', borderRadius: 16,
              border: '1px solid var(--line)',
              borderLeft: '3px solid var(--gold)',
              padding: '14px 16px 14px 14px',
              display: 'flex', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'rgba(201,168,120,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold-d)',
              }}>
                <Icon size={18} sw={1.6} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{
                  fontSize: 16, color: 'var(--ink)', fontStyle: 'italic',
                }}>
                  {title}
                </div>
                <div style={{
                  marginTop: 6, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55,
                }}>
                  {text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lightbulb icon for explanations
function IconBulb(p) {
  return (
    <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24" fill="none"
         stroke={p.color || 'currentColor'} strokeWidth={p.sw || 1.6}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11c1 .8 1.5 1.7 1.5 2.5V18h3v-1.5c0-.8.5-1.7 1.5-2.5A6 6 0 0 0 12 3z"/>
    </svg>
  );
}

const IconShare    = (p) => (
  <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24" fill="none"
       stroke={p.color || 'currentColor'} strokeWidth={p.sw || 1.6}
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
    <path d="M16 6l-4-4-4 4"/>
    <path d="M12 2v14"/>
  </svg>
);
const IconDownload = (p) => (
  <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24" fill="none"
       stroke={p.color || 'currentColor'} strokeWidth={p.sw || 1.6}
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 17v3h16v-3"/><path d="M12 4v12M6 10l6 6 6-6"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// 14) PAYMENT SUCCESS
// ─────────────────────────────────────────────────────────────
function ScreenPaymentSuccess() {
  return (
    <div className="scr" style={{
      overflow: 'hidden',
      background:
        'radial-gradient(60% 50% at 50% 30%, #F4E7CB 0%, #DDC59C 60%, #C0A37A 100%)',
    }}>
      <Botanical side="left" />
      <Botanical side="right" />

      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ width: 38 }} />
      </div>

      <div style={{
        position: 'absolute', inset: 0, padding: '0 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18,
      }}>
        {/* Gold checkmark */}
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          {/* outer halo */}
          <div style={{
            position: 'absolute', inset: -14, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,120,0.30) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 30%, #EFD8AC 0%, #C9A878 60%, #8E7044 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 28px rgba(140,108,60,0.35), inset 0 -6px 16px rgba(0,0,0,0.10)',
          }}>
            <svg width="58" height="44" viewBox="0 0 58 44" fill="none">
              <path d="M5 22 L22 39 L53 5"
                stroke="#FBF7F0" strokeWidth="6"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="serif" style={{
            fontSize: 30, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.1,
          }}>
            Токены начислены!
          </div>
          <div style={{
            marginTop: 10, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.45,
          }}>
            +20 токенов добавлены на ваш счёт
          </div>
        </div>

        {/* Balance card */}
        <div style={{
          marginTop: 4,
          background: 'rgba(251,247,240,0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 18, padding: '16px 24px',
          textAlign: 'center', minWidth: 220,
        }}>
          <div className="smallcaps" style={{ fontSize: 10 }}>Текущий баланс</div>
          <div style={{
            marginTop: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8,
          }}>
            <div className="serif" style={{
              fontSize: 38, color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1,
            }}>22</div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>токена</div>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
            Срок действия не ограничен
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div style={{
        position: 'absolute', left: 22, right: 22, bottom: 70,
      }}>
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

Object.assign(window, { ScreenRender, ScreenShopping, ScreenExplanations, ScreenPaymentSuccess });
