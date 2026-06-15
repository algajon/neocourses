import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  onboardingChecklists,
  checklistItems,
  checklistProgress,
  courses,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

async function courseInOrg(courseId: string, orgId: string | null | undefined) {
  const [course] = await db
    .select({ organizationId: courses.organizationId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  return !!course && course.organizationId === orgId
}

interface RouteParams {
  params: { checklistId: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { checklistId } = params

  const [checklist] = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.id, checklistId))
    .limit(1)

  if (!checklist || !(await courseInOrg(checklist.courseId, session.user.organizationId))) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
  }

  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklistId))
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
    description: item.description ?? null,
    isRequired: item.isRequired ?? false,
    position: item.position,
    completedAt: progressMap.has(item.id)
      ? progressMap.get(item.id)?.toISOString() ?? null
      : null,
  }))

  return NextResponse.json({
    id: checklist.id,
    courseId: checklist.courseId,
    title: checklist.title,
    items: itemsWithProgress,
  })
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { checklistId } = params

  const [checklist] = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.id, checklistId))
    .limit(1)

  if (!checklist || !(await courseInOrg(checklist.courseId, session.user.organizationId))) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
  }

  const body = await req.json()
  const { items } = body as {
    items: Array<{
      text: string
      description?: string
      isRequired?: boolean
    }>
  }

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 })
  }

  await db
    .delete(checklistItems)
    .where(eq(checklistItems.checklistId, checklistId))

  const inserted = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const id = randomUUID()
    await db.insert(checklistItems).values({
      id,
      checklistId,
      text: item.text,
      description: item.description ?? null,
      isRequired: item.isRequired ?? false,
      position: i,
      createdAt: new Date(),
    })
    inserted.push({ id, text: item.text, position: i })
  }

  return NextResponse.json({
    checklistId,
    items: inserted,
  })
}
