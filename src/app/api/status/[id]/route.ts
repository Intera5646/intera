import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase/server';
import { parseSessionCookie, verifySessionToken } from '../../../../lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth check — status polling requires a valid session
  const token = parseSessionCookie(req.headers.get('cookie'));
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const generationId = id;
  if (!generationId) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ID', message: 'Идентификатор генерации обязателен.' } }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('generations')
    .select('status, render_urls, error_message, designer_text, project_id, created_at')
    .eq('id', generationId)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Генерация не найдена.' } }, { status: 404 });
  }

  // Ownership check
  if (session.role !== 'admin') {
    const { data: project, error: projectError } = await supabaseServer
      .from('projects')
      .select('user_id')
      .eq('id', data.project_id)
      .single();
    if (projectError || !project || project.user_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Нет доступа к этой генерации.' } },
        { status: 403 }
      );
    }
  }

  // Treat stuck pending/processing generations as failed after 10 minutes
  let effectiveStatus = data.status as string;
  let effectiveError = data.error_message ?? null;
  if (effectiveStatus === 'pending' || effectiveStatus === 'processing') {
    const ageMs = Date.now() - new Date(data.created_at as string).getTime();
    if (ageMs > 10 * 60 * 1000) {
      effectiveStatus = 'failed';
      effectiveError = 'Generation timed out';
    }
  }

  const progress = effectiveStatus === 'done' ? 100 : effectiveStatus === 'processing' ? 60 : effectiveStatus === 'pending' ? 20 : 0;
  return NextResponse.json({
    success: true,
    status: effectiveStatus,
    progress,
    render_urls: data.render_urls ?? [],
    error_message: effectiveError,
    designer_text: data.designer_text ?? null,
  });
}
