import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { enrollments, courses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createNotification } from '@/lib/notify'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const courseId = params.id
  const isAdmin = session.user.role === 'admin' || session.user.role === 'owner'

  let body: { userId?: string } = {}
  try {
    body = await req.json()
  } catch {
    // body is optional
  }

  const targetUserId = isAdmin && body.userId ? body.userId : session.user.id

  if (body.userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: only admins can enroll other users' }, { status: 403 })
  }

  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      organizationId: courses.organizationId,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  if (course.status !== 'published') {
    return NextResponse.json({ error: 'Course is not published' }, { status: 400 })
  }

  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, targetUserId)))
    .limit(1)

  if (existing) {
    return NextResponse.json({ enrollment: existing, alreadyEnrolled: true })
  }

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      id: randomUUID(),
      userId: targetUserId,
      courseId,
      enrolledAt: new Date(),
      progressPercent: 0,
      status: 'active',
      paid: true,
    })
    .returning()

  // Best-effort — notify the enrolled learner.
  try {
    await createNotification({
      userId: targetUserId,
      type: 'enrollment',
      title: `Enrolled in ${course.title}`,
      body: course.title,
      link: `/learn/${courseId}`,
    })
  } catch {
    // never block enrollment on notification failure
  }

  return NextResponse.json({ enrollment, alreadyEnrolled: false }, { status: 201 })
}
