'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Введите email и пароль.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let result: any = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        result = null;
      }

      if (!response.ok) {
        const message = result?.error?.message || 'Ошибка входа.';
        throw new Error(message);
      }

      if (!result?.success) {
        throw new Error(result?.error?.message || 'Ошибка входа.');
      }

      router.push(result.destination || '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scr paper" style={{ overflow: 'hidden', minHeight: '100vh' }}>
      <div className="tophdr">
        <Link href="/" className="icobtn" style={{ textDecoration: 'none', color: 'inherit' }}>
          ←
        </Link>
        <div style={{ width: 38 }} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 92,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div className="wordmark" style={{ fontSize: 56, color: 'var(--ink)' }}>
          INTERA
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 232,
          left: 28,
          right: 28,
          textAlign: 'center',
        }}
      >
        <div className="serif" style={{ fontSize: 26, color: 'var(--ink)', fontStyle: 'italic' }}>
          Вход в аккаунт
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
            maxWidth: 300,
            margin: '8px auto 0',
          }}
        >
          Используйте email и пароль для входа в свой аккаунт.
        </div>
      </div>

      <form
        onSubmit={handleEmailLogin}
        style={{
          position: 'absolute',
          top: 340,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div className="input">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail"
            aria-label="E-mail"
          />
        </div>
        <div className="input">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            aria-label="Пароль"
          />
        </div>
        <button type="submit" className="btn btn--dark btn--block" style={{ marginTop: 6, height: 52 }}>
          Войти
        </button>

        {error ? (
          <div style={{ color: '#B14A3F', fontSize: 13, textAlign: 'center', marginTop: 4 }}>{error}</div>
        ) : null}
      </form>

      <div
        style={{
          position: 'absolute',
          bottom: 56,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--muted)',
        }}
      >
        Нет аккаунта?{' '}
        <Link href="/register" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
          Создать аккаунт
        </Link>
      </div>
    </div>
  );
}
