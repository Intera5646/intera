import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const generationId = id;
  if (!generationId) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ID', message: 'Идентификатор генерации обязателен.' } }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('generations')
    .select('status, render_urls, error_message, designer_text')
    .eq('id', generationId)
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Генерация не найдена.' } }, { status: 404 });
  }

  const progress = data.status === 'done' ? 100 : data.status === 'processing' ? 60 : 20;
  return NextResponse.json({
    success: true,
    status: data.status,
    progress,
    render_urls: data.render_urls ?? [],
    error_message: data.error_message ?? null,
    designer_text: data.designer_text ?? null,
  });
}
