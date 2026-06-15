import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { enrollments, courses, lessonProgress, lessons, modules } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId, role } = session.user

    const [enrollment] = await db
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
        certificateEnabled: courses.certificateEnabled,
        courseOrganizationId: courses.organizationId,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.id, params.id))
      .limit(1)

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    if (enrollment.courseOrganizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    if (role === 'learner' && enrollment.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const completedLessons = await db
      .select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt })
      .from(lessonProgress)
      .where(eq(lessonProgress.enrollmentId, params.id))

    const [totalLessonsRow] = await db
      .select({ total: count(lessons.id) })
      .from(lessons)
      .where(eq(lessons.courseId, enrollment.courseId))

    const courseModules = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, enrollment.courseId))

    const { courseOrganizationId: _courseOrganizationId, ...enrollmentOut } = enrollment

    return NextResponse.json({
      enrollment: {
        ...enrollmentOut,
        completedLessons: completedLessons.length,
        totalLessons: totalLessonsRow?.total ?? 0,
        completedLessonIds: completedLessons.map((lp) => lp.lessonId),
        modules: courseModules,
      },
    })
  } catch (error) {
    console.error('[GET /api/enrollments/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId, role } = session.user

    const [existing] = await db
      .select({
        id: enrollments.id,
        userId: enrollments.userId,
        courseOrganizationId: courses.organizationId,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.id, params.id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    if (existing.courseOrganizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    if (role === 'learner' && existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.delete(enrollments).where(eq(enrollments.id, params.id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/enrollments/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
