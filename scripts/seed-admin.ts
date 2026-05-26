import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

async function findExistingAuthUser(supabase: any, email: string) {
  const lowerEmail = email.toLowerCase();
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const users = (data?.users ?? []) as Array<any>;
    const user = users.find((item) => item.email?.toLowerCase() === lowerEmail);
    if (user) {
      return user.id;
    }

    const lastPage = Number(data?.lastPage ?? 0);
    if (page >= lastPage || users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local not found in project root.');
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!adminEmail || !adminPassword) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env.local');
    process.exit(1);
  }
  if (!supabaseUrl || !serviceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    console.log('Checking for existing admin auth user:', adminEmail);
    let userId = await findExistingAuthUser(supabase, adminEmail);

    if (userId) {
      console.log('Existing admin auth user found:', userId);
    } else {
      console.log('No existing admin auth user found, creating:', adminEmail);
      const { data, error } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (error) {
        console.warn('Create user error:', error);
        if (error.status === 500) {
          console.error('Supabase auth createUser returned 500.');
          console.error('Verify that SUPABASE_SERVICE_KEY is a valid service role key and that your Supabase auth service is configured correctly.');
        }
        if (error.message?.includes('already exists')) {
          console.log('Admin email already exists, locating existing user...');
          userId = await findExistingAuthUser(supabase, adminEmail);
          if (!userId) {
            throw new Error('Admin email exists, but user record could not be found.');
          }
        } else {
          throw error;
        }
      } else {
        userId = data?.user?.id;
      }
    }

    if (!userId) {
      throw new Error('Admin user ID was not returned.');
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        role: 'admin',
        token_balance: -1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      throw new Error(`Profile upsert failed: ${profileError.message}`);
    }

    console.log('Admin user seeded successfully.');
    console.log('Admin ID:', userId);
  } catch (error) {
    console.error('Seed admin failed.');
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if ('status' in error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = error as any;
        console.error('Error status:', err.status);
        console.error('Error details:', err.details ?? err.payload ?? err);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
