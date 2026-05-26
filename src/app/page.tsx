import Link from 'next/link';

export default function Home() {
  return (
    <div className="scr" style={{ overflow: 'hidden', minHeight: '100vh' }}>
      <div className="room" style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(248,240,225,0.0) 30%, rgba(50,38,28,0.55) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '20px 26px 18px',
          background: 'rgba(251,247,240,0.74)',
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.45)',
          boxShadow: '0 8px 30px rgba(50,40,25,0.10)',
          textAlign: 'center',
        }}
      >
        <div className="wordmark" style={{ fontSize: 32, letterSpacing: '0.18em', color: 'var(--ink)' }}>
          INTERA
        </div>
      </div>

      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 178 }}>
        <div
          className="serif"
          style={{
            fontSize: 32,
            lineHeight: 1.05,
            color: '#FBF7F0',
            fontStyle: 'italic',
            fontWeight: 500,
            textShadow: '0 2px 10px rgba(0,0,0,0.30)',
          }}
        >
          AI Interior Design
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: 'rgba(251,247,240,0.92)',
            lineHeight: 1.45,
            textShadow: '0 1px 6px rgba(0,0,0,0.30)',
            maxWidth: 270,
          }}
        >
          Ваш личный дизайнер<br />интерьера на базе&nbsp;AI
        </div>
        <div style={{ marginTop: 18, display: 'flex', gap: 6 }}>
          <span style={{ width: 22, height: 6, borderRadius: 3, background: '#FBF7F0' }} />
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(251,247,240,0.55)' }} />
          <span style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(251,247,240,0.55)' }} />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 56 }}>
        <Link
          href="/login"
          className="btn btn--dark btn--block"
          style={{ height: 58, fontSize: 16, borderRadius: 16, textDecoration: 'none' }}
        >
          Войти
        </Link>
        <div
          style={{
            marginTop: 14,
            textAlign: 'center',
            fontSize: 13,
            color: 'rgba(251,247,240,0.92)',
            textShadow: '0 1px 6px rgba(0,0,0,0.25)',
          }}
        >
          Нет аккаунта?{' '}
          <Link
            href="/register"
            style={{ textDecoration: 'underline', textDecorationColor: 'rgba(251,247,240,0.6)', color: '#FBF7F0' }}
          >
            Создать аккаунт
          </Link>
        </div>
      </div>
    </div>
  );
}
