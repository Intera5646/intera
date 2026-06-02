import type { SupabaseClient } from '@supabase/supabase-js';
import type { ControlMaps } from './types';

/**
 * Upload depth-map and lineart PNG buffers to the `control-maps` Supabase bucket.
 * Returns public URLs for both, plus the roomId and cameraIndex metadata.
 *
 * The bucket must be public (migration 10_control_maps_bucket.sql).
 * Caller must pass a service-role Supabase client so RLS is bypassed.
 */
export async function uploadControlMaps(
  roomId: string,
  depthBlob: Buffer,
  lineartBlob: Buffer,
  generationId: string,
  supabase: SupabaseClient,
  cameraIndex = 0,
): Promise<ControlMaps> {
  const prefix = `${generationId}/${roomId}/cam${cameraIndex}`;
  const depthPath   = `${prefix}/depth.png`;
  const lineartPath = `${prefix}/lineart.png`;

  const [depthResult, lineartResult] = await Promise.all([
    supabase.storage.from('control-maps').upload(depthPath, depthBlob, {
      contentType: 'image/png',
      upsert: true,
    }),
    supabase.storage.from('control-maps').upload(lineartPath, lineartBlob, {
      contentType: 'image/png',
      upsert: true,
    }),
  ]);

  if (depthResult.error)   throw new Error(`uploadControlMaps: depth upload failed — ${depthResult.error.message}`);
  if (lineartResult.error) throw new Error(`uploadControlMaps: lineart upload failed — ${lineartResult.error.message}`);

  const { data: depthUrl }   = supabase.storage.from('control-maps').getPublicUrl(depthPath);
  const { data: lineartUrl } = supabase.storage.from('control-maps').getPublicUrl(lineartPath);

  return {
    depthMapUrl: depthUrl.publicUrl,
    lineartUrl:  lineartUrl.publicUrl,
    roomId,
    cameraIndex,
  };
}
