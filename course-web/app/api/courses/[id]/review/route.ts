import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses } from '@/lib/db/schema'
import { createNotification } from '@/lib/notify'

const VALID_STATUSES = ['none', 'in_review', 'approved'] as const
type ReviewStatus = (typeof VALID_STATUSES)[number]

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role !== 'reviewer' && role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await req.json()
    const status = data?.status as ReviewStatus
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    await db
      .update(courses)
      .set({ reviewStatus: status, updatedAt: new Date() })
      .where(eq(courses.id, params.id))

    if (status !== course.reviewStatus && course.createdById && course.createdById !== session.user.id) {
      if (status === 'in_review') {
        await createNotification({
          userId: course.createdById,
          type: 'review_requested',
          title: 'Review requested',
          body: `"${course.title}" has been submitted for review.`,
          link: `/admin/courses/${course.id}`,
        })
      } else if (status === 'approved') {
        await createNotification({
          userId: course.createdById,
          type: 'review_approved',
          title: 'Course approved',
          body: `"${course.title}" has been approved.`,
          link: `/admin/courses/${course.id}`,
        })
      }
    }

    return NextResponse.json({ course: { ...course, reviewStatus: status } })
  } catch (error) {
    console.error('[POST /api/courses/[id]/review]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
