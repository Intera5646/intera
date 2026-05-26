import crypto from 'crypto';
import { supabaseServer } from './supabase/server';

const SESSION_COOKIE_NAME = 'intera_session';
const SESSION_SECRET = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_KEY;
if (!SESSION_SECRET) {
  throw new Error('Missing NEXTAUTH_SECRET or SUPABASE_SERVICE_KEY environment variable.');
}

export interface SessionPayload {
  userId: string;
  role: string;
  phone: string;
  exp: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const tokenPayload = { ...payload, exp };
  const encoded = base64url(JSON.stringify(tokenPayload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  if (!timingSafeEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(base64urlDecode(encoded)) as SessionPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge = 60 * 60 * 24 * 30;
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''}`;
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookie = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${SESSION_COOKIE_NAME}=`));
  return cookie ? cookie.split('=')[1] : null;
}

export async function getProfileByPhone(phone: string) {
  const { data, error } = await supabaseServer
    .from('profiles')
    .select('id, role, token_balance')
    .eq('phone', phone)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileById(userId: string) {
  const { data, error } = await supabaseServer
    .from('profiles')
    .select('id, role, token_balance, phone')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(userId: string, phone?: string | null, name?: string, tokenBalance = 1) {
  const { data, error } = await supabaseServer
    .from('profiles')
    .insert({ id: userId, phone, name, role: 'user', token_balance: tokenBalance })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findAuthUserByPhone(phone: string) {
  const { data, error } = await supabaseServer
    .from('auth.users')
    .select('id,email')
    .eq('phone', phone)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function findAuthUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseServer
    .from('auth.users')
    .select('id')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createAuthUser(phone: string) {
  const password = crypto.randomUUID();
  const { data, error } = await supabaseServer.auth.admin.createUser({
    phone,
    password,
    email_confirm: true,
  });
  if (error) {
    if (error.message?.includes('already exists')) {
      const existingRecord = await findAuthUserByPhone(phone);
      if (existingRecord?.id) return existingRecord.id;
    }
    throw error;
  }
  return data.user?.id;
}

export async function createEmailAuthUser(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseServer.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
  });
  if (error) {
    if (error.message?.includes('already exists')) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }
    throw error;
  }
  return data.user?.id;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return adminEmail ? normalizeEmail(email) === adminEmail : false;
}

function sign(value: string) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function timingSafeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function base64url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64urlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}
