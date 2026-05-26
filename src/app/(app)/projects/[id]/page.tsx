import { notFound } from 'next/navigation';
import { supabaseServer } from '../../../../lib/supabase/server';
import ProjectStatus from './ProjectStatus';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  const generationId = id;

  // This page expects the same generation ID returned by /api/generate
  // and queries the generations table by that ID.
  // If you see a 404 here, also verify DB permissions:
  // GRANT SELECT ON public.generations TO authenticated;
  const { data, error } = await supabaseServer
    .from('generations')
    .select('status, render_urls, error_message')
    .eq('id', generationId)
    .single();

  if (error || !data) {
    return notFound();
  }

  return <ProjectStatus generationId={generationId} initialStatus={data.status} initialRenderUrls={data.render_urls ?? []} initialError={data.error_message ?? null} />;
}
