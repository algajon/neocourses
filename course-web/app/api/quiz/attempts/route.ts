import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  quizAttempts,
  quizQuestions,
  quizzes,
  enrollments,
  certificates,
  lessonProgress,
  lessons,
  courses,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { recordActivity } from '@/lib/gamification'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { quizId, answers } = body as {
    quizId: string
    answers: Record<string, string>
  }

  if (!quizId || !answers) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1)

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  const [quizCourse] = await db
    .select({ organizationId: courses.organizationId })
    .from(courses)
    .where(eq(courses.id, quiz.courseId))
    .limit(1)

  if (!quizCourse || quizCourse.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))

  const total = questions.length
  const correctAnswers: Record<string, boolean> = {}
  const explanations: Record<string, string> = {}

  let correctCount = 0
  for (const q of questions) {
    const given = (answers[q.id] ?? '').trim().toLowerCase()
    const expected = q.correctAnswer.trim().toLowerCase()
    const isCorrect = given === expected
    correctAnswers[q.id] = isCorrect
    explanations[q.id] = q.explanation ?? ''
    if (isCorrect) correctCount++
  }

  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const passingScore = (quiz.passingScore ?? 0.7) * 100
  const passed = score >= passingScore

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, quiz.courseId), eq(enrollments.userId, session.user.id)))
    .limit(1)

  const attemptId = randomUUID()
  await db.insert(quizAttempts).values({
    id: attemptId,
    quizId,
    userId: session.user.id,
    enrollmentId: enrollment?.id ?? null,
    answers: JSON.stringify(answers),
    score: score / 100,
    passed,
    startedAt: new Date(),
    completedAt: new Date(),
  })

  if (passed && enrollment) {
    const existingCert = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.courseId, quiz.courseId),
          eq(certificates.userId, session.user.id),
        ),
      )
      .limit(1)

    if (existingCert.length === 0) {
      const allLessons = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.courseId, quiz.courseId))

      const completedLessons = await db
        .select({ lessonId: lessonProgress.lessonId })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollment.id),
            eq(lessonProgress.userId, session.user.id),
          ),
        )

      const completedSet = new Set(completedLessons.map(lp => lp.lessonId))
      const allDone = allLessons.every(l => completedSet.has(l.id))

      if (allDone) {
        await db.insert(certificates).values({
          id: randomUUID(),
          userId: session.user.id,
          courseId: quiz.courseId,
          enrollmentId: enrollment.id,
          issuedAt: new Date(),
          verificationCode: `CERT-${randomUUID().slice(0, 8).toUpperCase()}`,
        })
      }
    }
  }

  // Gamification: best-effort, non-blocking. score is a 0..1 fraction.
  void recordActivity(session.user.id, { kind: 'quiz', score: score / 100, passed })

  return NextResponse.json({
    attemptId,
    score,
    passed,
    correctAnswers,
    explanations,
  })
}
