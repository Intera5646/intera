import { notFound } from 'next/navigation';
import { supabaseServer } from '../../../../lib/supabase/server';
import ProjectStatus from './ProjectStatus';
import type { ApartmentGeometry } from '../../../../lib/geometry/types';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from('generations')
    .select('status, render_urls, error_message, designer_text, depth_map_url, camera_metadata, project_id')
    .eq('id', id)
    .single();

  if (error || !data) {
    return notFound();
  }

  // Fetch project geometry + budget for cost estimate
  let initialRooms: Array<{ name: string; type: string; area_m2: number }> = [];
  let initialBudget: string | null = null;
  if (data.project_id) {
    const { data: project } = await supabaseServer
      .from('projects')
      .select('geometry_extracted_json, budget_level')
      .eq('id', data.project_id as string)
      .single();
    if (project?.geometry_extracted_json) {
      const geometry = project.geometry_extracted_json as ApartmentGeometry;
      initialRooms = (geometry.rooms ?? []).map(r => ({
        name: r.name,
        type: r.type,
        area_m2: Math.round(r.dimensions.width_m * r.dimensions.length_m * 10) / 10,
      }));
    }
    initialBudget = (project?.budget_level as string | null) ?? null;
  }

  return (
    <ProjectStatus
      generationId={id}
      initialStatus={data.status}
      initialRenderUrls={data.render_urls ?? []}
      initialError={data.error_message ?? null}
      initialDesignerText={data.designer_text ?? null}
      initialCameraMetadata={(data as Record<string, unknown>).camera_metadata as { room_name?: string; room_dimensions?: string }[] | null ?? null}
      initialRooms={initialRooms}
      initialBudget={initialBudget}
    />
  );
}
