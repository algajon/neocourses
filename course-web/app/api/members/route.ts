import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { hashPassword } from '@/lib/auth/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId } = session.user
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const members = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        organizationId: users.organizationId,
        avatarUrl: users.avatarUrl,
        jobTitle: users.jobTitle,
        department: users.department,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.organizationId, organizationId ?? ''))

    return NextResponse.json({ members })
  } catch (error) {
    console.error('[GET /api/members]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId } = session.user
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, password, role: newRole } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'name, email, and password are required' },
        { status: 400 }
      )
    }

    const validRoles = ['owner', 'admin', 'reviewer', 'learner']
    const memberRole = newRole && validRoles.includes(newRole) ? newRole : 'learner'

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    const now = new Date()
    const id = uuidv4()

    await db.insert(users).values({
      id,
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      role: memberRole,
      organizationId: organizationId ?? null,
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        organizationId: users.organizationId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return NextResponse.json({ member: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/members]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
