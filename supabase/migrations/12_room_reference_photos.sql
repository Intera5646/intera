-- Migration 12: per-room reference photo support
-- Adds reference_photo_url to the generations table (child rows written by
-- runBtiRoomV2) and creates the room-references Supabase Storage bucket.
-- The photo URL is fed to the SDXL Multi-ControlNet model as an IP-Adapter
-- input, transferring style/content cues while depth+lineart lock geometry.

-- ── 1. Column on generations ──────────────────────────────────────────────────
-- Applies to per-room child rows (room_index >= 0).  NULL when no reference
-- photo was provided by the user.

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS reference_photo_url TEXT;

COMMENT ON COLUMN public.generations.reference_photo_url IS
  'Optional user-supplied reference photo URL uploaded to room-references bucket. '
  'Passed to fofr/sdxl-multi-controlnet-lora as ip_adapter_image when non-NULL.';

-- ── 2. Storage bucket ─────────────────────────────────────────────────────────
-- Public so Replicate can fetch the image over plain HTTPS.
-- 10 MB limit to avoid oversized uploads; accepts common image formats.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-references',
  'room-references',
  true,
  10485760,                                          -- 10 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage policies ───────────────────────────────────────────────────────

-- Service role: full CRUD (server-side operations)
CREATE POLICY "room-references: service role full access"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'room-references')
  WITH CHECK (bucket_id = 'room-references');

-- Public: read-only (Replicate and browser thumbnails)
CREATE POLICY "room-references: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'room-references');

-- Authenticated users: insert their own reference photos
CREATE POLICY "room-references: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'room-references');
