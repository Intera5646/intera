// INTERA v2 — Screens C: Result, Profile, Token Shop

// ─────────────────────────────────────────────────────────────
// 8) RESULT
// ─────────────────────────────────────────────────────────────
function ScreenResult() {
  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Ваш результат</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            Концепция интерьера для гостиной
          </div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{
        position: 'absolute', top: 134, left: 22, right: 22, bottom: 140,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* До / После toggle */}
        <div style={{
          alignSelf: 'center',
          background: 'rgba(34,30,26,0.06)',
          borderRadius: 999, padding: 4, display: 'flex', gap: 4,
          marginBottom: 14,
        }}>
          {['До', 'После'].map((t, i) => (
            <div key={t} style={{
              padding: '7px 22px', borderRadius: 999,
              fontSize: 13, fontWeight: 600,
              background: i === 1 ? 'var(--white)' : 'transparent',
              color: i === 1 ? 'var(--ink)' : 'var(--muted)',
              boxShadow: i === 1 ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}>{t}</div>
          ))}
        </div>

        {/* Big render */}
        <div className="render" style={{ flex: 1, position: 'relative' }}>
          {/* faint horizon */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '62%',
            height: 1, background: 'rgba(255,255,255,0.25)',
          }} />
          {/* sofa hint */}
          <div style={{
            position: 'absolute', left: '14%', bottom: '14%',
            width: '52%', height: '22%', borderRadius: 12,
            background: 'rgba(248,236,213,0.55)',
            border: '1px solid rgba(255,255,255,0.25)',
          }} />
          {/* window/arch hint */}
          <div style={{
            position: 'absolute', right: '12%', top: '14%',
            width: '24%', height: '54%',
            borderRadius: '50% 50% 4px 4px / 30% 30% 4px 4px',
            background: 'rgba(255,253,247,0.32)',
            border: '1px solid rgba(255,255,255,0.30)',
          }} />
        </div>

        {/* Pager */}
        <div style={{
          marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <div style={{
            fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}>1 / 3</div>
          <div style={{ display: 'flex', gap: 5, marginLeft: 6 }}>
            <span style={{ width: 16, height: 5, borderRadius: 3, background: 'var(--ink)' }} />
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'rgba(34,30,26,0.25)' }} />
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'rgba(34,30,26,0.25)' }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          marginTop: 14, display: 'flex', justifyContent: 'space-around',
        }}>
          <ResultAction Icon={IconBookmark} label="Сохранить" />
          <ResultAction Icon={IconRefresh}  label="Регенерировать" />
          <ResultAction Icon={IconSliders}  label="Изменить параметры" />
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 38 }}>
        <button className="btn btn--dark btn--block" style={{ height: 54, justifyContent: 'space-between' }}>
          <span>Продолжить к деталям</span>
          <IconChev size={18} color="var(--paper)" sw={2} />
        </button>
      </div>
    </div>
  );
}

function ResultAction({ Icon, label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      width: 88,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: 'var(--white)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} sw={1.6} color="var(--ink-2)" />
      </div>
      <div style={{
        fontSize: 11, color: 'var(--ink-2)', fontWeight: 600,
        textAlign: 'center', lineHeight: 1.2,
      }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 9) PROFILE
// ─────────────────────────────────────────────────────────────
function ScreenProfile() {
  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic', paddingLeft: 4 }}>Профиль</div>
        </div>
        <div style={{ opacity: 0.9 }}>
          <LogoMark size={36} sub={false} />
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 100,
        overflow: 'auto', padding: '0 22px 24px',
      }}>
        {/* Profile card */}
        <div style={{
          background: 'var(--white)', borderRadius: 18,
          border: '1px solid var(--line)', padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>А</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 19, color: 'var(--ink)', fontStyle: 'italic' }}>
              Анна Иванова
            </div>
            <div style={{
              fontSize: 12.5, color: 'var(--muted)', marginTop: 2,
              fontFamily: 'Manrope', letterSpacing: '0.01em',
            }}>
              anna.ivanova@email.com
            </div>
            <div className="pill gold" style={{
              marginTop: 6, padding: '4px 10px', fontSize: 11,
            }}>
              <IconCrown size={12} sw={1.6} /> Premium
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          marginTop: 14, background: 'var(--white)',
          borderRadius: 18, border: '1px solid var(--line)',
          padding: '16px 14px', display: 'flex', justifyContent: 'space-between',
        }}>
          <Stat n="12" label="Проектов" />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <Stat n="8"  label="Сохранено" />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <Stat n="24" label="Вдохновений" />
        </div>

        {/* List */}
        <div style={{
          marginTop: 14, background: 'var(--white)',
          borderRadius: 18, border: '1px solid var(--line)', overflow: 'hidden',
        }}>
          <ProfileRow Icon={IconCrown}  label="Подписка"    sub="Premium активна" />
          <Divider />
          <ProfileRow Icon={IconCog}    label="Настройки"   sub="Уведомления, язык, единицы" />
          <Divider />
          <ProfileRow Icon={IconShield} label="Поддержка"   sub="Связаться с нами" />
          <Divider />
          <ProfileRow Icon={IconInfo}   label="О приложении" sub="Версия 1.0.0" />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 38 }}>
        <button className="btn btn--mocha btn--block" style={{ height: 52 }}>
          <IconLogout size={18} sw={1.6} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div className="serif" style={{ fontSize: 24, color: 'var(--ink)' }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', marginLeft: 56 }} />;
}

function ProfileRow({ Icon, label, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 14px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(184,160,131,0.16)', color: 'var(--mocha-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} sw={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
      <IconChev size={18} color="var(--muted-2)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 10) TOKEN SHOP (additional, not in 9-screen reference)
// ─────────────────────────────────────────────────────────────
function ScreenShop() {
  return (
    <div className="scr paper" style={{ overflow: 'hidden' }}>
      <div className="tophdr">
        <button className="icobtn"><IconBack size={20} sw={1.8} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Магазин токенов</div>
        </div>
        <div style={{ opacity: 0.9 }}>
          <LogoMark size={32} sub={false} />
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 116, left: 0, right: 0, bottom: 38,
        overflow: 'auto', padding: '0 22px 24px',
      }}>
        {/* Balance plate */}
        <div style={{
          background:
            'linear-gradient(135deg, #E6CFA6 0%, #C9A878 60%, #A88A56 100%)',
          color: '#1F1B16',
          borderRadius: 22, padding: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: -30, top: -30, width: 120, height: 120,
            borderRadius: '50%', border: '1px solid rgba(31,27,22,0.18)',
          }} />
          <div style={{
            position: 'absolute', right: 16, top: 22, width: 70, height: 70,
            borderRadius: '50%', border: '1px solid rgba(31,27,22,0.14)',
          }} />
          <div className="smallcaps" style={{ color: 'rgba(31,27,22,0.65)' }}>
            Текущий баланс
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div className="serif" style={{ fontSize: 44, color: '#1F1B16', fontStyle: 'italic' }}>2</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>токена</div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78, maxWidth: 220 }}>
            1 токен = 1 готовая концепция с рендерами и подбором мебели
          </div>
        </div>

        {/* Plans */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Тарифы</div>
        <div className="col gap-10">
          <Plan name="Эскиз"   tokens="5"  price="249 ₽"   unit="~50 ₽ за комнату" />
          <Plan name="Проект"  tokens="20" price="790 ₽"   unit="~40 ₽ за комнату" badge="Популярный" highlight />
          <Plan name="Студия"  tokens="50" price="1 490 ₽" unit="~30 ₽ за комнату" badge="−40% выгоднее" gold />
        </div>

        {/* Payments */}
        <div className="sec-title" style={{ marginTop: 22, marginBottom: 10 }}>Способы оплаты</div>
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          padding: '14px 12px', borderRadius: 14, background: 'var(--white)',
          border: '1px solid var(--line)',
        }}>
          {['МИР', 'СБП', 'VISA', 'MC', 'Apple Pay'].map(p => (
            <div key={p} style={{
              padding: '7px 12px', borderRadius: 8,
              background: 'rgba(34,30,26,0.04)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--ink-2)',
            }}>{p}</div>
          ))}
        </div>
        <div style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--muted)', justifyContent: 'center',
        }}>
          <IconShield size={13} color="var(--mocha-2)" />
          Безопасная оплата через провайдера
        </div>
      </div>
    </div>
  );
}

function Plan({ name, tokens, price, unit, badge, highlight, gold }) {
  const accent = gold ? 'var(--gold)' : 'var(--mocha)';
  const borderC = highlight ? 'var(--mocha)' : gold ? 'var(--gold)' : 'var(--line-2)';
  return (
    <div style={{
      background: 'var(--white)', borderRadius: 16, padding: 14,
      border: `2px solid ${borderC}`,
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: highlight ? '0 6px 16px rgba(184,160,131,0.18)' : 'none',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -10, right: 14,
          padding: '4px 10px', borderRadius: 999,
          background: gold ? 'var(--gold)' : 'var(--mocha)',
          color: 'var(--paper)', fontSize: 10.5, fontWeight: 700,
          letterSpacing: '0.02em',
        }}>{badge}</div>
      )}
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: gold
          ? 'linear-gradient(135deg, #DCBE85, #A88A56)'
          : highlight
            ? 'linear-gradient(135deg, #CFB694, #9F8460)'
            : 'rgba(184,160,131,0.16)',
        color: highlight || gold ? 'var(--paper)' : 'var(--ink)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div className="serif" style={{ fontSize: 20, lineHeight: 1, fontStyle: 'italic' }}>{tokens}</div>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2, opacity: 0.85 }}>
          ток
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 17, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{unit}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="serif" style={{ fontSize: 17, color: 'var(--ink)' }}>{price}</div>
        <button style={{
          marginTop: 6, padding: '6px 14px', borderRadius: 10,
          background: highlight ? 'var(--mocha)' : gold ? 'var(--gold-d)' : 'var(--ink)',
          color: 'var(--paper)', border: 0,
          fontSize: 12, fontWeight: 600,
        }}>Купить</button>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenResult, ScreenProfile, ScreenShop });
