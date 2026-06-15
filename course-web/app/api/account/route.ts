import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { hashPassword, verifyPassword } from '@/lib/auth/utils'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface AccountUpdateBody {
  name?: string
  currentPassword?: string
  newPassword?: string
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as AccountUpdateBody

  const updates: { name?: string; passwordHash?: string } = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    updates.name = name
  }

  const wantsPasswordChange =
    body.currentPassword !== undefined || body.newPassword !== undefined

  if (wantsPasswordChange) {
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are both required' },
        { status: 400 }
      )
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const valid = await verifyPassword(body.currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    updates.passwordHash = await hashPassword(body.newPassword)
  }

  if (updates.name === undefined && updates.passwordHash === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ ok: true })
}
