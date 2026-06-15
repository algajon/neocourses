import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  lessonProgress,
  enrollments,
  lessons,
  courses,
  certificates,
} from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createNotification } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { lessonId, courseId } = body as { lessonId: string; courseId: string }

  if (!lessonId || !courseId) {
    return NextResponse.json({ error: 'Missing lessonId or courseId' }, { status: 400 })
  }

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, session.user.id)))
    .limit(1)

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  const existing = await db
    .select({ id: lessonProgress.id })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.lessonId, lessonId),
        eq(lessonProgress.userId, session.user.id),
        eq(lessonProgress.enrollmentId, enrollment.id),
      ),
    )
    .limit(1)

  if (existing.length === 0) {
    await db.insert(lessonProgress).values({
      id: randomUUID(),
      enrollmentId: enrollment.id,
      userId: session.user.id,
      lessonId,
      courseId,
      completedAt: new Date(),
      timeSpentSeconds: 0,
    })
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))

  const [{ completed }] = await db
    .select({ completed: count() })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.enrollmentId, enrollment.id),
        eq(lessonProgress.userId, session.user.id),
      ),
    )

  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
  const isCompleted = completionPercentage === 100

  const now = new Date()
  await db
    .update(enrollments)
    .set({
      progressPercent: completionPercentage,
      lastAccessedAt: now,
      completedAt: isCompleted && !enrollment.completedAt ? now : enrollment.completedAt,
      currentLessonId: lessonId,
    })
    .where(eq(enrollments.id, enrollment.id))

  if (isCompleted && !enrollment.completedAt) {
    const [course] = await db
      .select({ title: courses.title, certificateEnabled: courses.certificateEnabled })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)

    if (course?.certificateEnabled) {
      const existingCert = await db
        .select({ id: certificates.id })
        .from(certificates)
        .where(and(eq(certificates.courseId, courseId), eq(certificates.userId, session.user.id)))
        .limit(1)

      if (existingCert.length === 0) {
        await db.insert(certificates).values({
          id: randomUUID(),
          userId: session.user.id,
          courseId,
          enrollmentId: enrollment.id,
          issuedAt: now,
          verificationCode: randomUUID().replace(/-/g, '').toUpperCase(),
        })
      }
    }

    await createNotification({
      userId: session.user.id,
      type: 'completion',
      title: 'Course completed',
      body: course?.title ?? 'You finished a course',
      link: `/learn/${courseId}/certificate`,
    })
  }

  return NextResponse.json({ completionPercentage, completed: isCompleted })
}
