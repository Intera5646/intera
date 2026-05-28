import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseSessionCookie, verifySessionToken } from '../../../lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  // Auth check — unauthenticated uploads blocked
  const token = parseSessionCookie(req.headers.get('cookie'));
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } },
      { status: 401 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Файл не найден в запросе.' } }, { status: 400 });
  }

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const path = `floor-plans/${timestamp}-${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage.from('floor-plans').upload(path, buffer, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });

  if (uploadError) {
    console.error('Supabase upload error:', uploadError);
    return NextResponse.json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'Не удалось сохранить файл на хранилище.' } }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from('floor-plans').getPublicUrl(path);
  if (!publicData?.publicUrl) {
    return NextResponse.json({ success: false, error: { code: 'UPLOAD_FAILED', message: 'Не удалось получить URL файла.' } }, { status: 500 });
  }

  return NextResponse.json({ success: true, url: publicData.publicUrl });
}
