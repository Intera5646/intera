-- Add is_test_account flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

-- Create test auth user and profile (idempotent)
DO $$
DECLARE
  v_user_id  UUID;
  v_inst_id  UUID;
BEGIN
  -- Reuse the instance_id already in use by this Supabase project
  SELECT instance_id INTO v_inst_id FROM auth.users LIMIT 1;
  v_inst_id := COALESCE(v_inst_id, '00000000-0000-0000-0000-000000000000'::UUID);

  -- Check if test user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@intera.app';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin
    ) VALUES (
      v_user_id,
      v_inst_id,
      'test@intera.app',
      crypt('Test1234!', gen_salt('bf')),
      NOW(),
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false
    );
  END IF;

  -- Upsert profile — 100 tokens, marked as test account
  INSERT INTO public.profiles (
    id, name, phone, role, token_balance, is_test_account, created_at, updated_at
  ) VALUES (
    v_user_id,
    'Test User',
    '70000000001',
    'user',
    100,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    token_balance   = 100,
    is_test_account = true,
    name            = 'Test User';
END $$;
