import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase/server';
import {
  buildSessionCookie,
  createEmailAuthUser,
  createProfile,
  createSessionToken,
  findAuthUserByEmail,
  findAuthUserByPhone,
  getProfileByPhone,
  isAdminEmail,
  normalizeEmail,
} from '../../../../lib/auth';

function normalizePhone(phone: unknown) {
  if (typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  return digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
}

export async function POST(req: NextRequest) {
  const { name, email, password, phone: rawPhone, code } = await req.json();
  const normalizedEmail = typeof email === 'string' ? normalizeEmail(email) : '';
  const phone = normalizePhone(rawPhone);

  if (!name?.trim() || !normalizedEmail || typeof password !== 'string' || !password.trim() || !phone || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Имя, email, пароль, номер телефона и код обязательны.' } },
      { status: 400 }
    );
  }

  const { data: otpRow, error: otpError } = await supabaseServer
    .from('sms_otps')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpError) {
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Ошибка проверки кода.' } }, { status: 500 });
  }
  if (!otpRow) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_CODE', message: 'Неверный или просроченный код.' } }, { status: 400 });
  }

  const { error: updateOtpError } = await supabaseServer
    .from('sms_otps')
    .update({ is_used: true })
    .eq('id', otpRow.id);

  if (updateOtpError) {
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Не удалось пометить код как использованный.' } }, { status: 500 });
  }

  if (isAdminEmail(normalizedEmail)) {
    return NextResponse.json(
      { success: false, error: { code: 'ADMIN_EMAIL_RESERVED', message: 'Этот email зарезервирован для администратора.' } },
      { status: 403 }
    );
  }

  const existingEmailId = await findAuthUserByEmail(normalizedEmail);
  if (existingEmailId) {
    return NextResponse.json(
      { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Этот email уже зарегистрирован.' } },
      { status: 409 }
    );
  }

  const existingPhoneUser = await findAuthUserByPhone(phone);
  if (existingPhoneUser) {
    return NextResponse.json(
      { success: false, error: { code: 'PHONE_ALREADY_USED', message: 'Этот номер телефона уже привязан к другому аккаунту.' } },
      { status: 409 }
    );
  }

  let userId: string;
  try {
    userId = await createEmailAuthUser(normalizedEmail, password);
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS') {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Этот email уже зарегистрирован.' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Не удалось создать аккаунт.' } },
      { status: 500 }
    );
  }

  const profile = await createProfile(userId, phone, name, 5);
  const sessionToken = createSessionToken({
    userId,
    role: profile.role ?? 'user',
    phone,
  });

  const destination = profile.role === 'admin' ? '/admin' : '/dashboard';

  const headers = new Headers({
    'Set-Cookie': buildSessionCookie(sessionToken),
    'Content-Type': 'application/json',
  });

  return new Response(JSON.stringify({ success: true, destination }), {
    status: 200,
    headers,
  });
}
