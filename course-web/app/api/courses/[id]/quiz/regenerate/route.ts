import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  courses,
  modules,
  lessons,
  quizzes,
  quizQuestions,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAIProvider } from '@/lib/ai'
import { randomUUID } from 'crypto'

interface RouteParams {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: courseId } = params
  const body = await req.json()
  const { moduleId } = body as { moduleId: string }

  if (!moduleId) {
    return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const [mod] = await db
    .select()
    .from(modules)
    .where(and(eq(modules.id, moduleId), eq(modules.courseId, courseId)))
    .limit(1)

  if (!mod) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  }

  const moduleLessons = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.moduleId, moduleId), eq(lessons.courseId, courseId)))
    .orderBy(lessons.position)

  // Ground the regenerated quiz in the module's actual lesson content.
  const chapterContent = moduleLessons
    .map((l) => {
      let intro = ''
      let concepts = ''
      try {
        const c = l.contentJson ? JSON.parse(l.contentJson) : null
        intro = c?.intro ?? ''
        concepts = (c?.concepts ?? []).map((x: { title: string; body: string }) => `${x.title}: ${x.body}`).join('\n')
      } catch {}
      return `## ${l.title}\n${intro}\n${concepts}`.trim()
    })
    .join('\n\n')

  const ai = getAIProvider()
  const newQuestions = await ai.generateQuizQuestions(mod.title, chapterContent, mod.title)

  const [existingQuiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.moduleId, moduleId), eq(quizzes.courseId, courseId)))
    .limit(1)

  if (!existingQuiz) {
    return NextResponse.json({ error: 'Quiz not found for this module' }, { status: 404 })
  }

  await db
    .delete(quizQuestions)
    .where(eq(quizQuestions.quizId, existingQuiz.id))

  const inserted = []
  for (let i = 0; i < newQuestions.length; i++) {
    const qq = newQuestions[i]
    const id = randomUUID()
    await db.insert(quizQuestions).values({
      id,
      quizId: existingQuiz.id,
      questionText: qq.questionText,
      questionType: qq.questionType,
      options: qq.options ? JSON.stringify(qq.options) : null,
      correctAnswer: qq.correctAnswer,
      explanation: qq.explanation,
      position: i,
      createdAt: new Date(),
    })
    inserted.push({ id, questionText: qq.questionText, questionType: qq.questionType })
  }

  return NextResponse.json({
    quizId: existingQuiz.id,
    questionsGenerated: inserted.length,
    questions: inserted,
  })
}
