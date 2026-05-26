import { redirect } from 'next/navigation'
import { getSessionUserId } from '@/lib/supabase/session'
import { supabaseServer } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export const revalidate = 0

export default async function DashboardPage() {
  try {
    const userId = await getSessionUserId()

    if (!userId) {
      console.log('[DashboardPage] No userId from session, redirecting to login')
      redirect('/login')
    }

    console.log('[DashboardPage] Loading dashboard for userId:', userId)

    const [profileResult, projectsResult] = await Promise.all([
      supabaseServer
        .from('profiles')
        .select('token_balance')
        .eq('id', userId)
        .single(),
      supabaseServer
        .from('projects')
        .select('id, room_type, style, status, created_at, generations(id, status, render_urls)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6),
    ])

    let tokenBalance = 0
    if (profileResult.error) {
      console.error('[DashboardPage] Profile query error:', profileResult.error.message)
    } else if (profileResult.data) {
      tokenBalance = profileResult.data.token_balance ?? 0
      console.log('[DashboardPage] Token balance:', tokenBalance)
    }

    let projects: typeof projectsResult.data = []
    if (projectsResult.error) {
      console.error('[DashboardPage] Projects query error:', projectsResult.error.message)
    } else if (projectsResult.data) {
      projects = projectsResult.data
      console.log('[DashboardPage] Projects loaded:', projects.length)
    }

    return <DashboardClient initialTokenBalance={tokenBalance} initialProjects={projects} />
  } catch (error) {
    console.error('[DashboardPage] Unexpected error:', error)
    return <DashboardClient initialTokenBalance={0} initialProjects={[]} />
  }
}
