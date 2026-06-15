import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { onboardingChecklists, checklistItems, courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const courseId = params.id

  const [course] = await db
    .select({ id: courses.id, organizationId: courses.organizationId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const checklists = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.courseId, courseId))

  const checklistsWithItems = await Promise.all(
    checklists.map(async (checklist) => {
      const items = await db
        .select()
        .from(checklistItems)
        .where(eq(checklistItems.checklistId, checklist.id))
        .orderBy(checklistItems.position)

      return { ...checklist, items }
    }),
  )

  return NextResponse.json({ checklists: checklistsWithItems })
}
