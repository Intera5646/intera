export default function AdminSettingsPage() {
  const settings = [
    {
      group: 'Генерация',
      items: [
        { key: 'GENERATION_PROVIDER', label: 'Провайдер рендеров', value: process.env.GENERATION_PROVIDER ?? 'replicate', hint: 'replicate | fal' },
        { key: 'CONTROLNET_WEIGHT', label: 'ControlNet weight', value: process.env.CONTROLNET_WEIGHT ?? '1.2', hint: '1.0 мягко / 1.2 оптимум / 1.5 жёстко' },
        { key: 'DEFAULT_CEILING_HEIGHT_MM', label: 'Высота потолка по умолчанию', value: process.env.DEFAULT_CEILING_HEIGHT_MM ?? '2700', hint: 'мм' },
      ],
    },
    {
      group: 'Лимиты расходов',
      items: [
        { key: 'MAX_COST_PER_GENERATION_RUB', label: 'Макс. стоимость генерации', value: process.env.MAX_COST_PER_GENERATION_RUB ?? '35', hint: '₽' },
        { key: 'MAX_DAILY_PROVIDER_SPEND_RUB', label: 'Суточный лимит провайдера', value: process.env.MAX_DAILY_PROVIDER_SPEND_RUB ?? '500', hint: '₽' },
        { key: 'MAX_RETRIES_PER_GENERATION', label: 'Макс. повторных попыток', value: process.env.MAX_RETRIES_PER_GENERATION ?? '2', hint: 'шт' },
        { key: 'GENERATION_TIMEOUT_SEC', label: 'Таймаут генерации', value: process.env.GENERATION_TIMEOUT_SEC ?? '120', hint: 'сек' },
      ],
    },
    {
      group: 'Feature flags',
      items: [
        { key: 'BETA_QA_MODE', label: 'Beta QA mode', value: process.env.BETA_QA_MODE ?? 'false', hint: 'true = ручная проверка результатов' },
        { key: 'BETA_QA_PROJECT_LIMIT', label: 'Лимит QA-проверок', value: process.env.BETA_QA_PROJECT_LIMIT ?? '50', hint: 'первые N проектов' },
        { key: 'TOURS_ENABLED', label: '3D туры', value: process.env.TOURS_ENABLED ?? 'false', hint: 'false = пока отключены' },
        { key: 'MARKETPLACE_ENABLED', label: 'Маркетплейс', value: process.env.MARKETPLACE_ENABLED ?? 'false', hint: 'Яндекс.Маркет интеграция' },
      ],
    },
    {
      group: 'Сервисы',
      items: [
        { key: 'GROQ_API_KEY', label: 'Groq API', value: process.env.GROQ_API_KEY ? '••••••••' : 'НЕ ЗАДАН', hint: 'основной AI для промптов' },
        { key: 'REPLICATE_API_TOKEN', label: 'Replicate API', value: process.env.REPLICATE_API_TOKEN ? '••••••••' : 'НЕ ЗАДАН', hint: 'рендеры (основной)' },
        { key: 'FAL_KEY', label: 'fal.ai API', value: process.env.FAL_KEY ? '••••••••' : 'НЕ ЗАДАН', hint: 'рендеры (Phase 2)' },
        { key: 'SMSRU_API_KEY', label: 'SMS.ru', value: process.env.SMSRU_API_KEY ? '••••••••' : 'НЕ ЗАДАН', hint: 'SMS OTP верификация' },
        { key: 'YUKASSA_SHOP_ID', label: 'ЮКасса', value: process.env.YUKASSA_SHOP_ID ? '••••••••' : 'НЕ ЗАДАН', hint: 'платёжный шлюз' },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header>
        <div style={{ fontSize: 34, fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: 'var(--brand-primary)' }}>
          Настройки системы
        </div>
        <p style={{ marginTop: 8, color: 'var(--muted)', maxWidth: 620 }}>
          Текущие значения переменных окружения. Изменяются в <code>.env.local</code> и требуют
          перезапуска сервера.
        </p>
      </header>

      {settings.map((group) => (
        <div
          key={group.group}
          style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: 24 }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 16 }}>
            {group.group}
          </div>
          <div style={{ display: 'grid', gap: 0 }}>
            {group.items.map((item, idx) => {
              const isSecret = item.value === '••••••••';
              const isMissing = item.value === 'НЕ ЗАДАН';
              return (
                <div
                  key={item.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: 16,
                    alignItems: 'center',
                    padding: '13px 0',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-primary)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: 'monospace' }}>
                      {item.key}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: isSecret ? 'monospace' : 'inherit',
                      fontWeight: isSecret ? 400 : 600,
                      color: isMissing ? '#B71C1C' : isSecret ? 'var(--muted)' : 'var(--brand-primary)',
                    }}
                  >
                    {item.value}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', maxWidth: 160 }}>
                    {item.hint}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div
        style={{
          padding: '16px 20px',
          borderRadius: 14,
          background: 'rgba(34,30,26,0.04)',
          fontSize: 13,
          color: 'var(--muted)',
          lineHeight: 1.7,
        }}
      >
        Для изменения настроек отредактируйте <code>.env.local</code> и перезапустите сервер. В
        продакшне используйте переменные окружения Vercel.
      </div>
    </div>
  );
}
