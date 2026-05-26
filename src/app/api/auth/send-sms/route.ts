import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase/server';

const SMSRU_API_KEY = process.env.SMSRU_API_KEY;
if (!SMSRU_API_KEY) {
  throw new Error('Missing SMSRU_API_KEY environment variable.');
}

function normalizePhone(phone: unknown) {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  return digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_PHONE', message: 'Неверный номер телефона.' } }, { status: 400 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseServer.from('sms_otps').insert({
    phone,
    code,
    expires_at: expiresAt,
    is_used: false,
  });

  if (insertError) {
    return NextResponse.json({ success: false, error: { code: 'STORAGE_ERROR', message: 'Не удалось сохранить OTP.' } }, { status: 500 });
  }

  const message = `INTERA: код подтверждения ${code}. Не сообщайте его никому.`;
  const params = new URLSearchParams({
    api_id: SMSRU_API_KEY,
    to: phone,
    msg: message,
    json: '1',
  });

  const response = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok || payload.status !== 'OK') {
    return NextResponse.json({
      success: false,
      error: { code: 'SMS_SEND_FAILED', message: 'Не удалось отправить SMS. Попробуйте позже.' },
      provider: payload,
    }, { status: 502 });
  }

  return NextResponse.json({ success: true, expiresIn: 300 });
}
