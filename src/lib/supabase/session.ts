import { cookies } from 'next/headers'

export async function getSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('sb-auth-token')?.value
    
    if (!authToken) {
      console.log('[session.ts] No auth token in cookies')
      return null
    }

    // Parse JWT to extract user ID
    try {
      const parts = authToken.split('.')
      if (parts.length !== 3) {
        console.log('[session.ts] Invalid JWT format')
        return null
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf8')
      )
      
      const userId = payload.sub
      console.log('[session.ts] Extracted userId:', userId)
      return userId || null
    } catch (decodeError) {
      console.log('[session.ts] Failed to decode JWT:', decodeError)
      return null
    }
  } catch (error) {
    console.log('[session.ts] Cookie read failed:', error)
    return null
  }
}
