import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseSessionCookie, verifySessionToken } from '../../../../lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? '',
  {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

export async function POST(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Требуются права администратора.' } }, { status: 403 });
  }

  const body = await req.json();
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const amount = Number(body?.amount ?? 0);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!email) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email обязателен.' } }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Количество токенов должно быть положительным целым числом.' } }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_REASON', message: 'Причина обязательна.' } }, { status: 400 });
  }

  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
  if (usersError) {
    console.error('Grant tokens listUsers error:', usersError);
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Ошибка чтения пользователей.' } }, { status: 500 });
  }

  const authUser = usersData?.users?.find((user: any) => user.email?.toLowerCase() === email);
  if (!authUser) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Пользователь не найден.' } }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, token_balance')
    .eq('id', authUser.id)
    .single();

  if (profileError) {
    console.error('Grant tokens profile lookup error:', profileError);
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Ошибка чтения профиля.' } }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Профиль пользователя не найден.' } }, { status: 404 });
  }

  const newBalance = (profile.token_balance ?? 0) + amount;

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ token_balance: newBalance })
    .eq('id', profile.id);

  if (updateError) {
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Не удалось обновить баланс.' } }, { status: 500 });
  }

  const { error: transactionError } = await supabaseAdmin
    .from('token_transactions')
    .insert({
      user_id: profile.id,
      amount,
      type: 'grant',
      reason,
      granted_by: session.userId,
    });

  if (transactionError) {
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Не удалось сохранить транзакцию.' } }, { status: 500 });
  }

  return NextResponse.json({ success: true, tokenBalance: newBalance });
}
