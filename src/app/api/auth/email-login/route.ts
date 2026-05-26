import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildSessionCookie,
  createSessionToken,
  isAdminEmail,
  normalizeEmail,
} from '../../../../lib/auth';

const missingEnvMessage =
  'Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY.';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: { message: missingEnvMessage } },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Неверный формат запроса. Ожидается JSON.' } },
        { status: 400 }
      );
    }

    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password.trim()) {
      return NextResponse.json(
        { error: { message: 'Email и пароль обязательны.' } },
        { status: 400 }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    console.log('Email-login route env:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
    });
    console.log('Email-login route request:', { email, hasPassword: !!password });

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Supabase signIn error:', JSON.stringify(error));
    console.log('Supabase signIn data:', JSON.stringify(data));
    console.log('Full Supabase response:', JSON.stringify({ data, error }));

    if (error || !data?.user) {
      return NextResponse.json(
        { error: { message: 'Неверный email или пароль.' } },
        { status: 401 }
      );
    }

    const userId = data.user.id;
    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: { message: 'Не удалось получить сессию пользователя.' } },
        { status: 500 }
      );
    }

    const sessionResult = await authClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    console.log('Session set result:', JSON.stringify(sessionResult));

    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('id, role, token_balance, phone')
      .eq('id', userId)
      .limit(1)
      .maybeSingle();

    console.log('Profile fetch error (session):', JSON.stringify(profileError));
    console.log('Profile fetch data (session):', JSON.stringify(profile));

    if (profileError) {
      return NextResponse.json(
        {
          error: {
            message: 'Ошибка чтения профиля.',
            details: profileError.message,
            code: profileError.code,
            hint: profileError.hint,
          },
        },
        { status: 500 }
      );
    }

    if (!profile) {
      const message = isAdminEmail(email)
        ? 'Профиль администратора не найден.'
        : 'Пользователь не найден.';
      return NextResponse.json(
        { error: { message } },
        { status: 500 }
      );
    }

    const destination = profile.role === 'admin' ? '/admin' : '/dashboard';
    const sessionToken = createSessionToken({
      userId,
      role: profile.role ?? 'user',
      phone: profile.phone ?? '',
    });

    const headers = new Headers({
      'Set-Cookie': buildSessionCookie(sessionToken),
    });

    return NextResponse.json(
      {
        success: true,
        user: { id: data.user.id, email: data.user.email ?? email },
        role: profile.role ?? 'user',
        destination,
      },
      { status: 200, headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка входа.';
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
