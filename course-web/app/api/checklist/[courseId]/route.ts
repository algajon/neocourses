import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  onboardingChecklists,
  checklistItems,
  checklistProgress,
  enrollments,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

interface RouteParams {
  params: { courseId: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [checklist] = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.courseId, params.courseId))
    .limit(1)

  if (!checklist) {
    return NextResponse.json({ error: 'No checklist found' }, { status: 404 })
  }

  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklist.id))
    .orderBy(checklistItems.position)

  const progress = await db
    .select()
    .from(checklistProgress)
    .where(eq(checklistProgress.userId, session.user.id))

  const progressMap = new Map(
    progress.map(p => [p.checklistItemId, p.completedAt]),
  )

  const itemsWithProgress = items.map(item => ({
    id: item.id,
    text: item.text,
    description: item.description,
    isRequired: item.isRequired ?? false,
    position: item.position,
    completedAt: progressMap.has(item.id)
      ? progressMap.get(item.id)?.toISOString() ?? null
      : null,
  }))

  return NextResponse.json({
    id: checklist.id,
    title: checklist.title,
    courseId: params.courseId,
    items: itemsWithProgress,
  })
}
