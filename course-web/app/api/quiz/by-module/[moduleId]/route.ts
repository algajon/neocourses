import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { quizzes, quizQuestions, courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { normalizeQuizOptions } from '@/lib/quiz'

interface RouteParams {
  params: { moduleId: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.moduleId, params.moduleId))
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
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(quizQuestions.position)

  const sanitizedQuestions = questions.map(q => ({
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: normalizeQuizOptions(q.options),
    position: q.position,
  }))

  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    passingScore: quiz.passingScore ?? 0.7,
    courseId: quiz.courseId,
    moduleId: quiz.moduleId,
    questions: sanitizedQuestions,
  })
}
