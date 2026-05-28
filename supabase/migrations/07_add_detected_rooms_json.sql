-- Add structured room JSON and room count to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS detected_rooms_json TEXT,
  ADD COLUMN IF NOT EXISTS room_count INTEGER DEFAULT 1;

-- Add per-room tracking columns to generations
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS room_name   TEXT,
  ADD COLUMN IF NOT EXISTS room_index  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_urls  TEXT[],
  ADD COLUMN IF NOT EXISTS draft_render_url TEXT;
-- depth_map_url already exists from migration 01
