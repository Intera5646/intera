import { notFound } from 'next/navigation';
import { supabaseServer } from '../../../../lib/supabase/server';
import ProjectStatus from './ProjectStatus';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from('generations')
    .select('status, render_urls, error_message, designer_text, depth_map_url, camera_metadata')
    .eq('id', id)
    .single();

  if (error || !data) {
    return notFound();
  }

  return (
    <ProjectStatus
      generationId={id}
      initialStatus={data.status}
      initialRenderUrls={data.render_urls ?? []}
      initialError={data.error_message ?? null}
      initialDesignerText={data.designer_text ?? null}
      initialCameraMetadata={(data as Record<string, unknown>).camera_metadata as { room_name?: string; room_dimensions?: string }[] | null ?? null}
    />
  );
}
