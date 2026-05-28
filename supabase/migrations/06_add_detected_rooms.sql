-- Add detected rooms list from BTI floor plan analysis
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS detected_rooms TEXT[];
