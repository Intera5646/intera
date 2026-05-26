import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.redirect(
    new URL('/', process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
  );
  response.cookies.set('intera_session', '', {
    maxAge: 0,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return response;
}
