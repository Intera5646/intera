import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'intera_session';
const PUBLIC_PATHS = ['/', '/login', '/register', '/privacy', '/terms'];
const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/tokens', '/profile', '/admin'];
const AUTH_PATHS = ['/login', '/register'];

// Extract session token from cookie header (matches parseSessionCookie in auth.ts)
function getSessionToken(req: NextRequest): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookie = cookieHeader
    .split(';')
    .map(p => p.trim())
    .find(p => p.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) return null;
  return cookie.slice(SESSION_COOKIE_NAME.length + 1) || null;
}

// HMAC-SHA256 token verification using Web Crypto API (required for Edge runtime).
// Mirrors the logic in auth.ts verifySessionToken, but without Node.js crypto.
async function verifyToken(token: string): Promise<boolean> {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const encoded = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);
  if (!encoded || !signature) return false;

  const secret = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_KEY || '';
  if (!secret) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));

    // ArrayBuffer → base64url (same as Node crypto.digest('base64url'))
    let base64 = '';
    new Uint8Array(sigBuf).forEach(b => { base64 += String.fromCharCode(b); });
    const expected = btoa(base64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Timing-safe comparison
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    if (diff !== 0) return false;

    // Check token expiry
    const payloadJson = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static files, Next.js internals, and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = getSessionToken(req);
  const isAuthenticated = token ? await verifyToken(token) : false;

  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PATHS.includes(pathname);

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Redirect unauthenticated/invalid-token users from protected routes
  if (!isAuthenticated && isProtected) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
