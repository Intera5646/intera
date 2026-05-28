-- Add personalization fields to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS residents           TEXT,
  ADD COLUMN IF NOT EXISTS has_pets            TEXT,
  ADD COLUMN IF NOT EXISTS needs_workspace     TEXT,
  ADD COLUMN IF NOT EXISTS lighting_preference TEXT,
  ADD COLUMN IF NOT EXISTS disliked_colors     TEXT;
