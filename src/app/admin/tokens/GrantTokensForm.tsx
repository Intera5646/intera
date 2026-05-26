'use client';

import { useState } from 'react';

type GrantTokensFormProps = {
  emails: string[];
};

export default function GrantTokensForm({ emails }: GrantTokensFormProps) {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState('test');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('idle');
    setMessage('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setStatus('error');
      setMessage('Укажите email пользователя.');
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setStatus('error');
      setMessage('Количество токенов должно быть положительным целым числом.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/grant-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, amount, reason }),
      });

      const payload = await response.json();
      if (!response.ok || payload?.success !== true) {
        setStatus('error');
        setMessage(payload?.error?.message ?? 'Не удалось выполнить запрос.');
      } else {
        setStatus('success');
        setMessage(`Токены успешно начислены. Баланс: ${payload.tokenBalance}`);
        setEmail('');
        setAmount(5);
        setReason('test');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Ошибка сети.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18, marginBottom: 18 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          Email пользователя
          <input
            list="profileEmails"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--brand-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
          <datalist id="profileEmails">
            {emails.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          Токенов
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--brand-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
          Причина
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--brand-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          >
            <option value="test">test</option>
            <option value="manual grant">manual grant</option>
            <option value="compensation">compensation</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn btn--brand"
          disabled={isLoading}
          style={{ width: 220 }}
        >
          {isLoading ? 'Отправка…' : 'Начислить токены'}
        </button>
        {status !== 'idle' && (
          <div style={{ color: status === 'success' ? '#27532A' : '#8B2727', fontSize: 14 }}>
            {message}
          </div>
        )}
      </div>
    </form>
  );
}
