import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  const [{ unreadCount }] = await db
    .select({ unreadCount: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return NextResponse.json({ notifications: rows, unreadCount })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[]
    all?: boolean
  }

  const now = new Date()

  if (body.all) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return NextResponse.json({ ok: true })
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, body.ids)))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provide ids[] or all: true' }, { status: 400 })
}
