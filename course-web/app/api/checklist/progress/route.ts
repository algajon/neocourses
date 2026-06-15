import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  checklistProgress,
  checklistItems,
  enrollments,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { checklistItemId, courseId, completed } = body as {
    checklistItemId: string
    courseId: string
    completed: boolean
  }

  if (!checklistItemId || !courseId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [existing] = await db
    .select()
    .from(checklistProgress)
    .where(
      and(
        eq(checklistProgress.checklistItemId, checklistItemId),
        eq(checklistProgress.userId, session.user.id),
      ),
    )
    .limit(1)

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, session.user.id)))
    .limit(1)

  let completedAt: Date | null = null

  if (completed && !existing) {
    completedAt = new Date()
    await db.insert(checklistProgress).values({
      id: randomUUID(),
      checklistItemId,
      userId: session.user.id,
      enrollmentId: enrollment?.id ?? null,
      completedAt,
    })
  } else if (!completed && existing) {
    await db
      .delete(checklistProgress)
      .where(eq(checklistProgress.id, existing.id))
    completedAt = null
  } else if (existing) {
    completedAt = existing.completedAt
  }

  return NextResponse.json({
    ok: true,
    completedAt: completedAt?.toISOString() ?? null,
  })
}
