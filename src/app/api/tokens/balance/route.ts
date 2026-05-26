import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, verifySessionToken, getProfileById } from '../../../../lib/auth';

export async function GET(req: NextRequest) {
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } }, { status: 401 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Сессия недействительна.' } }, { status: 401 });
  }

  const profile = await getProfileById(session.userId);
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Профиль не найден.' } }, { status: 404 });
  }

  const balance = profile.role === 'admin' ? -1 : profile.token_balance ?? 0;
  return NextResponse.json({ success: true, tokenBalance: balance });
}
