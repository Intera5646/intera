-- Migration 08: geometry pipeline fields for v2 BTI pipeline
--
-- projects: cache ApartmentGeometry so re-renders don't re-call Qwen3-VL
-- generations: track which camera angle produced each render + seed for reproducibility

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS geometry_extracted_json JSONB;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS camera_metadata JSONB,
  ADD COLUMN IF NOT EXISTS seed_used       INTEGER;

COMMENT ON COLUMN public.projects.geometry_extracted_json IS
  'ApartmentGeometry JSON from Phase 1 Qwen3-VL extraction. '
  'Structure: {is_bti_plan, apartment:{total_area_m2,ceiling_height_m,orientation}, rooms:[GeometryRoom]}. '
  'Cached to avoid re-calling the vision model on re-renders.';

COMMENT ON COLUMN public.generations.camera_metadata IS
  'CameraSuggestion used for this render: '
  '{camera_index:int, camera_at_wall_id:str, facing_wall_id:str, description:str, room_id:str}';

COMMENT ON COLUMN public.generations.seed_used IS
  'Integer seed passed to Flux Depth Pro. Stored to allow deterministic re-generation of the same frame.';
