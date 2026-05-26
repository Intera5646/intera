'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const resetMessages = () => {
    setError(null);
    setMessage(null);
  };

  const handleSendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim() || !phone.trim()) {
      setError('Заполните все поля.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли должны совпадать.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/email-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Ошибка отправки кода.');
      }
      setCodeSent(true);
      setMessage('Код отправлен на указанный номер.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки кода.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!otp.trim()) {
      setError('Введите код из SMS.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone, code: otp }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Ошибка проверки кода.');
      }
      router.push(result.destination || '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки кода.');
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
          Создать аккаунт
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
          Зарегистрируйтесь по email и подтвердите номер телефона.
        </div>
      </div>

      <form
        onSubmit={codeSent ? handleVerifyOtp : handleSendOtp}
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
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Имя"
            aria-label="Имя"
            disabled={loading}
          />
        </div>
        <div className="input">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail"
            aria-label="E-mail"
            disabled={codeSent || loading}
          />
        </div>
        <div className="input">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            aria-label="Пароль"
            disabled={codeSent || loading}
          />
        </div>
        <div className="input">
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Повторите пароль"
            aria-label="Повторите пароль"
            disabled={codeSent || loading}
          />
        </div>
        <div className="input">
          <span style={{ color: 'var(--muted)' }}>+7</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Номер телефона"
            aria-label="Номер телефона"
            disabled={codeSent || loading}
          />
        </div>

        {codeSent ? (
          <>
            <div className="input">
              <input
                type="text"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="Код из SMS"
                aria-label="Код из SMS"
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn--dark btn--block" style={{ marginTop: 6, height: 52 }}>
              Завершить регистрацию
            </button>
          </>
        ) : (
          <button type="submit" className="btn btn--brand btn--block" style={{ marginTop: 6, height: 52 }}>
            Отправить код
          </button>
        )}

        {message ? (
          <div style={{ color: 'var(--ink-2)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>{message}</div>
        ) : null}
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
        Уже есть аккаунт?{' '}
        <Link href="/login" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
          Войти
        </Link>
      </div>
    </div>
  );
}
