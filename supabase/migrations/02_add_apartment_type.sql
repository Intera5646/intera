-- Add apartment type and upload type to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS apartment_type TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS upload_type TEXT DEFAULT 'photo';
