import { cookies } from 'next/headers';
import { verifySessionToken } from '../auth';

export async function getSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionValue = cookieStore.get('intera_session')?.value ?? null;

    if (!sessionValue) {
      console.log('[session.ts] No intera_session cookie found');
      return null;
    }

    const session = verifySessionToken(sessionValue);
    if (!session) {
      console.log('[session.ts] Invalid or expired session token');
      return null;
    }

    console.log('[session.ts] Session valid for userId:', session.userId);
    return session.userId;
  } catch (error) {
    console.log('[session.ts] Session read failed:', error);
    return null;
  }
}
