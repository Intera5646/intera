-- Add design brief output fields to generations table
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS sd_prompt    TEXT,
  ADD COLUMN IF NOT EXISTS report_text  TEXT,
  ADD COLUMN IF NOT EXISTS color_palette TEXT[];
