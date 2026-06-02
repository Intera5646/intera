-- Migration 11: add replicate_prediction_id to generations
-- Used by the async SDXL multi-controlnet pipeline so per-room predictions
-- can be tracked and polled by the status endpoint without blocking the
-- original /api/generate handler.

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS replicate_prediction_id TEXT;

CREATE INDEX IF NOT EXISTS idx_generations_prediction_id
  ON public.generations(replicate_prediction_id)
  WHERE replicate_prediction_id IS NOT NULL;

COMMENT ON COLUMN public.generations.replicate_prediction_id IS
  'Replicate prediction ID for async SDXL multi-controlnet renders. '
  'When set and status=''pending_render'', the /api/status endpoint polls '
  'Replicate and updates this row when the prediction completes.';
