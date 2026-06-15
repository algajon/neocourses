import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { enrollments, courses, users } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId, role, organizationId } = session.user

    let rows
    if (role === 'learner') {
      rows = await db
        .select({
          id: enrollments.id,
          userId: enrollments.userId,
          courseId: enrollments.courseId,
          enrolledAt: enrollments.enrolledAt,
          completedAt: enrollments.completedAt,
          lastAccessedAt: enrollments.lastAccessedAt,
          progressPercent: enrollments.progressPercent,
          currentLessonId: enrollments.currentLessonId,
          status: enrollments.status,
          courseTitle: courses.title,
          courseStatus: courses.status,
          courseThumbnailUrl: courses.thumbnailUrl,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(enrollments.userId, userId))
        .orderBy(desc(enrollments.enrolledAt))
    } else {
      rows = await db
        .select({
          id: enrollments.id,
          userId: enrollments.userId,
          courseId: enrollments.courseId,
          enrolledAt: enrollments.enrolledAt,
          completedAt: enrollments.completedAt,
          lastAccessedAt: enrollments.lastAccessedAt,
          progressPercent: enrollments.progressPercent,
          currentLessonId: enrollments.currentLessonId,
          status: enrollments.status,
          courseTitle: courses.title,
          courseStatus: courses.status,
          courseThumbnailUrl: courses.thumbnailUrl,
          userName: users.name,
          userEmail: users.email,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .innerJoin(users, eq(enrollments.userId, users.id))
        .where(eq(courses.organizationId, organizationId ?? ''))
        .orderBy(desc(enrollments.enrolledAt))
    }

    return NextResponse.json({ enrollments: rows })
  } catch (error) {
    console.error('[GET /api/enrollments]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionUserId, role, organizationId } = session.user

    const body = await req.json()
    const { courseId, userId: targetUserId } = body

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const enrollUserId = targetUserId && role !== 'learner' ? targetUserId : sessionUserId

    const [course] = await db
      .select({ id: courses.id, status: courses.status, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (role === 'learner' && course.status !== 'published') {
      return NextResponse.json({ error: 'Course is not available' }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, enrollUserId)))
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'Already enrolled' }, { status: 400 })
    }

    const now = new Date()
    const id = uuidv4()

    await db.insert(enrollments).values({
      id,
      userId: enrollUserId,
      courseId,
      enrolledAt: now,
      progressPercent: 0,
      status: 'active',
    })

    const [created] = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, id))
      .limit(1)

    return NextResponse.json({ enrollment: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/enrollments]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
