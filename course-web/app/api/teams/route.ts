import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { v4 as uuidv4 } from 'uuid'
import { eq, desc, count, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { teams, teamMembers } from '@/lib/db/schema'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = session.user.organizationId
    if (!orgId) {
      return NextResponse.json({ teams: [] })
    }

    const orgTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, orgId))
      .orderBy(desc(teams.createdAt))

    const teamIds = orgTeams.map((t) => t.id)

    const memberCountsRaw = teamIds.length
      ? await db
          .select({ teamId: teamMembers.teamId, count: count() })
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, teamIds))
          .groupBy(teamMembers.teamId)
      : []

    const memberCounts = Object.fromEntries(memberCountsRaw.map((r) => [r.teamId, r.count]))

    const teamMemberRows = teamIds.length
      ? await db
          .select()
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, teamIds))
      : []

    const result = orgTeams.map((t) => ({
      ...t,
      memberCount: memberCounts[t.id] ?? 0,
      memberIds: teamMemberRows.filter((m) => m.teamId === t.id).map((m) => m.userId),
    }))

    return NextResponse.json({ teams: result })
  } catch (error) {
    console.error('[GET /api/teams]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = session.user.organizationId
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    const id = uuidv4()
    await db.insert(teams).values({
      id,
      organizationId: orgId,
      name,
      createdAt: new Date(),
    })

    const [created] = await db.select().from(teams).where(eq(teams.id, id)).limit(1)
    return NextResponse.json({ team: { ...created, memberCount: 0, memberIds: [] } }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/teams]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
