import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  courses,
  modules,
  lessons,
  quizzes,
  quizQuestions,
  onboardingChecklists,
  checklistItems,
} from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { normalizeQuizOptions } from '@/lib/quiz'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// Admin "preview as learner": the full course tree with parsed lesson content,
// per-module quiz, and onboarding checklist. Shape matches PreviewCourse on the page.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, params.id)).limit(1)
    if (!course || course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const courseModules = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, params.id))
      .orderBy(asc(modules.position))

    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, params.id))
      .orderBy(asc(lessons.position))

    const courseQuizzes = await db.select().from(quizzes).where(eq(quizzes.courseId, params.id))
    const quizIds = courseQuizzes.map((q) => q.id)
    const allQuestions = quizIds.length
      ? await db.select().from(quizQuestions).orderBy(asc(quizQuestions.position))
      : []

    const modulesOut = courseModules.map((m) => {
      const quiz = courseQuizzes.find((q) => q.moduleId === m.id) ?? null
      return {
        id: m.id,
        title: m.title,
        description: m.description ?? null,
        position: m.position,
        lessons: courseLessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({
            id: l.id,
            title: l.title,
            position: l.position,
            content: safeParse(l.contentJson),
          })),
        quiz: quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              questions: allQuestions
                .filter((q) => q.quizId === quiz.id)
                .map((q) => ({
                  id: q.id,
                  questionText: q.questionText,
                  questionType: q.questionType,
                  options: normalizeQuizOptions(q.options),
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation ?? null,
                })),
            }
          : null,
      }
    })

    const [checklist] = await db
      .select()
      .from(onboardingChecklists)
      .where(eq(onboardingChecklists.courseId, params.id))
      .limit(1)

    let checklistOut = null
    if (checklist) {
      const items = await db
        .select()
        .from(checklistItems)
        .where(eq(checklistItems.checklistId, checklist.id))
        .orderBy(asc(checklistItems.position))
      checklistOut = {
        id: checklist.id,
        title: checklist.title,
        items: items.map((it) => ({
          id: it.id,
          text: it.text,
          description: it.description ?? null,
          isRequired: it.isRequired,
          position: it.position,
        })),
      }
    }

    return NextResponse.json({
      id: course.id,
      title: course.title,
      description: course.description ?? null,
      status: course.status,
      modules: modulesOut,
      checklist: checklistOut,
    })
  } catch (error) {
    console.error('[GET /api/courses/[id]/preview]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
