-- Migration 10: control-maps Supabase Storage bucket
-- Stores depth-map PNGs and lineart PNGs for the SDXL multi-controlnet pipeline.
-- Public bucket — Replicate needs plain HTTPS URLs for controlnet_1 / controlnet_2.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'control-maps',
  'control-maps',
  true,
  5242880,                -- 5 MB per file
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "control-maps: service role full access"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'control-maps')
  WITH CHECK (bucket_id = 'control-maps');

CREATE POLICY "control-maps: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'control-maps');
