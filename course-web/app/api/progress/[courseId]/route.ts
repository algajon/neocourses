import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  enrollments,
  lessonProgress,
  quizAttempts,
  quizzes,
  checklistProgress,
  checklistItems,
  onboardingChecklists,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courseId } = params

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, session.user.id)))
    .limit(1)

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 404 })
  }

  const completedLessonRows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.enrollmentId, enrollment.id),
        eq(lessonProgress.userId, session.user.id),
      ),
    )

  const completedLessons = completedLessonRows.map(r => r.lessonId)

  const courseQuizzes = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.courseId, courseId))

  const quizAttemptsByQuiz: Record<string, { score: number | null; passed: boolean | null; completedAt: Date | null }[]> = {}
  for (const quiz of courseQuizzes) {
    const attempts = await db
      .select({
        score: quizAttempts.score,
        passed: quizAttempts.passed,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quiz.id),
          eq(quizAttempts.userId, session.user.id),
        ),
      )
    quizAttemptsByQuiz[quiz.id] = attempts
  }

  const courseChecklists = await db
    .select({ id: onboardingChecklists.id })
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.courseId, courseId))

  const checklistProgressByItem: Record<string, { completedAt: Date | null }> = {}
  for (const checklist of courseChecklists) {
    const items = await db
      .select({ id: checklistItems.id })
      .from(checklistItems)
      .where(eq(checklistItems.checklistId, checklist.id))

    for (const item of items) {
      const [progress] = await db
        .select({ completedAt: checklistProgress.completedAt })
        .from(checklistProgress)
        .where(
          and(
            eq(checklistProgress.checklistItemId, item.id),
            eq(checklistProgress.userId, session.user.id),
          ),
        )
        .limit(1)

      checklistProgressByItem[item.id] = { completedAt: progress?.completedAt ?? null }
    }
  }

  return NextResponse.json({
    enrollment,
    completedLessons,
    quizAttempts: quizAttemptsByQuiz,
    checklistProgress: checklistProgressByItem,
  })
}
