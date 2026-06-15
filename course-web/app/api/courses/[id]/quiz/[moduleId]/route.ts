import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { quizzes, quizQuestions, modules, courses } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { normalizeQuizOptions } from '@/lib/quiz'

// Admin quiz editor: full questions (including correctAnswer/explanation) for a module.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; moduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [course] = await db
      .select({ organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)
    if (!course || course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    const [mod] = await db
      .select({ id: modules.id, title: modules.title })
      .from(modules)
      .where(and(eq(modules.id, params.moduleId), eq(modules.courseId, params.id)))
      .limit(1)

    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.moduleId, params.moduleId), eq(quizzes.courseId, params.id)))
      .limit(1)

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quiz.id))
      .orderBy(asc(quizQuestions.position))

    return NextResponse.json({
      id: quiz.id,
      title: quiz.title,
      moduleTitle: mod?.title ?? '',
      passingScore: quiz.passingScore ?? 70,
      questions: questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: normalizeQuizOptions(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? null,
        position: q.position,
      })),
    })
  } catch (error) {
    console.error('[GET /api/courses/[id]/quiz/[moduleId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
