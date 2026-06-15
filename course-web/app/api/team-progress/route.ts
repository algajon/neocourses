import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { buildTeamProgress } from '@/lib/team-progress'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId } = session.user
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const data = await buildTeamProgress(organizationId)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/team-progress]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
