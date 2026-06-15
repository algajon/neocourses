import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { v4 as uuidv4 } from 'uuid'
import { eq, and, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { teams, teamMembers, users } from '@/lib/db/schema'

async function loadTeam(teamId: string, orgId: string | null | undefined) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return { team: null as null, ok: false }
  if (!orgId || team.organizationId !== orgId) return { team, ok: false }
  return { team, ok: true }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
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
    const { team, ok } = await loadTeam(params.teamId, orgId)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const addUserIds: string[] = Array.isArray(body?.addUserIds) ? body.addUserIds : []
    const removeUserIds: string[] = Array.isArray(body?.removeUserIds) ? body.removeUserIds : []

    if (name !== undefined) {
      if (!name) {
        return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 })
      }
      await db.update(teams).set({ name }).where(eq(teams.id, params.teamId))
    }

    if (addUserIds.length) {
      // Only add users that belong to this org and aren't already members.
      const orgUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, addUserIds), eq(users.organizationId, orgId!)))
      const orgUserIds = new Set(orgUsers.map((u) => u.id))

      const existing = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, params.teamId))
      const existingIds = new Set(existing.map((m) => m.userId))

      const toInsert = addUserIds.filter((uid) => orgUserIds.has(uid) && !existingIds.has(uid))
      if (toInsert.length) {
        await db.insert(teamMembers).values(
          toInsert.map((uid) => ({ id: uuidv4(), teamId: params.teamId, userId: uid }))
        )
      }
    }

    if (removeUserIds.length) {
      await db
        .delete(teamMembers)
        .where(
          and(eq(teamMembers.teamId, params.teamId), inArray(teamMembers.userId, removeUserIds))
        )
    }

    const [updated] = await db.select().from(teams).where(eq(teams.id, params.teamId)).limit(1)
    const memberRows = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, params.teamId))
    const memberIds = memberRows.map((m) => m.userId)

    return NextResponse.json({
      team: { ...updated, memberCount: memberIds.length, memberIds },
    })
  } catch (error) {
    console.error('[PATCH /api/teams/[teamId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { teamId: string } }
) {
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
    const { team, ok } = await loadTeam(params.teamId, orgId)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await db.delete(teamMembers).where(eq(teamMembers.teamId, params.teamId))
    await db.delete(teams).where(eq(teams.id, params.teamId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/teams/[teamId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
