import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { quizzes, quizQuestions, courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

async function courseInOrg(courseId: string, orgId: string | null | undefined) {
  const [course] = await db
    .select({ organizationId: courses.organizationId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  return !!course && course.organizationId === orgId
}

interface RouteParams {
  params: { quizId: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { quizId } = params

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1)

  if (!quiz || !(await courseInOrg(quiz.courseId, session.user.organizationId))) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)

  const result = questions.map(q => ({
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options ? JSON.parse(q.options) : null,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? null,
    position: q.position,
  }))

  return NextResponse.json({ quizId, questions: result })
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { quizId } = params

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1)

  if (!quiz || !(await courseInOrg(quiz.courseId, session.user.organizationId))) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  const body = await req.json()
  const { questions } = body as {
    questions: Array<{
      questionText: string
      questionType: 'multiple_choice' | 'true_false' | 'short_answer'
      options?: Array<{ id: string; text: string }>
      correctAnswer: string
      explanation?: string
    }>
  }

  if (!Array.isArray(questions)) {
    return NextResponse.json({ error: 'questions array is required' }, { status: 400 })
  }

  await db
    .delete(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))

  const inserted = []
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const id = randomUUID()
    await db.insert(quizQuestions).values({
      id,
      quizId,
      questionText: q.questionText,
      questionType: q.questionType ?? 'multiple_choice',
      options: q.options ? JSON.stringify(q.options) : null,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? null,
      position: i,
      createdAt: new Date(),
    })
    inserted.push({ id, questionText: q.questionText, position: i })
  }

  return NextResponse.json({ quizId, questions: inserted })
}
