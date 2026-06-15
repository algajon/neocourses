import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId } = session.user
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [existing] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (existing.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { role: newRole } = body

    if (!newRole) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 })
    }

    const validRoles = ['owner', 'admin', 'reviewer', 'learner']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const now = new Date()
    await db
      .update(users)
      .set({ role: newRole, updatedAt: now })
      .where(eq(users.id, params.userId))

    const [updated] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        organizationId: users.organizationId,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)

    return NextResponse.json({ member: updated })
  } catch (error) {
    console.error('[PUT /api/members/[userId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId, id: requesterId } = session.user
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (params.userId === requesterId) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (existing.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    await db
      .update(users)
      .set({ organizationId: null, updatedAt: now })
      .where(eq(users.id, params.userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/members/[userId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
