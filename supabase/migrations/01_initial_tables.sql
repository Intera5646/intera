-- Initial Supabase schema for INTERA

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  token_balance INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  room_type TEXT,
  style TEXT,
  budget_level TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  replicate_id TEXT,
  anon_uuid TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  render_urls TEXT[],
  depth_map_url TEXT,
  prompt_used TEXT,
  designer_text JSONB,
  shopping_items JSONB,
  budget_range JSONB,
  error_message TEXT,
  processing_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reason TEXT,
  granted_by UUID REFERENCES public.profiles(id),
  project_id UUID REFERENCES public.projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  yukassa_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  tokens_granted INTEGER NOT NULL,
  package_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.spend_user_tokens(
  user_id UUID,
  amount INTEGER
) RETURNS INTEGER AS $$
DECLARE
  remaining INTEGER;
BEGIN
  UPDATE public.profiles
  SET token_balance = token_balance - amount
  WHERE id = user_id AND token_balance >= amount
  RETURNING token_balance INTO remaining;

  RETURN remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
