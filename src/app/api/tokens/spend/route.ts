import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase/server';

export async function POST(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Сессия недействительна.' } }, { status: 401 });
  }

  const body = await req.json();
  const amount = Number(body.amount ?? 0);
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Сумма должна быть положительным целым числом.' } }, { status: 400 });
  }

  if (session.role === 'admin') {
    return NextResponse.json({ success: true, tokenBalance: -1 });
  }

  const { data, error } = await supabaseServer.rpc('spend_user_tokens', {
    user_id: session.userId,
    amount,
  });

  if (error) {
    return NextResponse.json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Ошибка списания токенов.' } }, { status: 500 });
  }

  const remaining = Array.isArray(data) ? data[0] : data;
  if (remaining === null || remaining === undefined) {
    return NextResponse.json({ success: false, error: { code: 'INSUFFICIENT_TOKENS', message: 'Недостаточно токенов.' } }, { status: 400 });
  }

  return NextResponse.json({ success: true, tokenBalance: remaining });
}
