import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase/server';
import { findAuthUserByEmail, getProfileByPhone, isAdminEmail, normalizeEmail } from '../../../../lib/auth';

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
  const { name, email, password, phone: rawPhone } = await req.json();
  const normalized = typeof email === 'string' ? normalizeEmail(email) : '';
  const phone = normalizePhone(rawPhone);

  if (!name?.trim() || !normalized || typeof password !== 'string' || !password.trim() || !phone) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Имя, email, пароль и номер телефона обязательны.' } },
      { status: 400 }
    );
  }

  if (isAdminEmail(normalized)) {
    return NextResponse.json(
      { success: false, error: { code: 'ADMIN_EMAIL_RESERVED', message: 'Этот email зарезервирован для администратора.' } },
      { status: 403 }
    );
  }

  const emailExists = await findAuthUserByEmail(normalized);
  if (emailExists) {
    return NextResponse.json(
      { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Этот email уже зарегистрирован.' } },
      { status: 409 }
    );
  }

  const existingProfile = await getProfileByPhone(phone);
  if (existingProfile) {
    return NextResponse.json(
      { success: false, error: { code: 'PHONE_ALREADY_USED', message: 'Этот номер телефона уже привязан к другому аккаунту.' } },
      { status: 409 }
    );
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
    return NextResponse.json(
      { success: false, error: { code: 'STORAGE_ERROR', message: 'Не удалось сохранить OTP.' } },
      { status: 500 }
    );
  }

  const message = `INTERA: код подтверждения ${code}. Не сообщайте его никому.`;
  const params = new URLSearchParams({
    api_id: SMSRU_API_KEY ?? '',
    to: phone,
    msg: message,
    json: '1',
  });

  const response = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok || payload.status !== 'OK') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SMS_SEND_FAILED', message: 'Не удалось отправить SMS. Попробуйте позже.' },
        provider: payload,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, expiresIn: 300 });
}
