import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { lessons, modules, quizzes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface RouteParams {
  params: { lessonId: string }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lessonId } = params

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1)

  if (!lesson) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [mod] = await db
    .select()
    .from(modules)
    .where(eq(modules.id, lesson.moduleId))
    .limit(1)

  // lessons.position is per-module — order globally by module position, then lesson position.
  const lessonList = await db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.courseId, lesson.courseId))
    .orderBy(modules.position, lessons.position)

  const globalIdx = lessonList.findIndex(l => l.id === lessonId)
  const prevLessonId = globalIdx > 0 ? lessonList[globalIdx - 1].id : null
  const nextLessonId = globalIdx < lessonList.length - 1 ? lessonList[globalIdx + 1].id : null

  const [moduleQuizInfo] = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.moduleId, lesson.moduleId))
    .limit(1)

  const isLastInModule = !nextLessonId ||
    (await db
      .select({ id: lessons.id, moduleId: lessons.moduleId })
      .from(lessons)
      .where(eq(lessons.id, nextLessonId))
      .limit(1)
      .then(rows => rows[0]?.moduleId !== lesson.moduleId))

  const safeArray = (raw: string | null): string[] => {
    if (!raw) return []
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }

  let content = null
  if (lesson.contentJson) {
    try {
      content = JSON.parse(lesson.contentJson)
    } catch {}
  }

  return NextResponse.json({
    id: lesson.id,
    title: lesson.title,
    courseId: lesson.courseId,
    moduleId: lesson.moduleId,
    moduleTitle: mod?.title ?? '',
    moduleNumber: (mod?.position ?? 0) + 1,
    lessonNumber: globalIdx + 1,
    totalLessons: lessonList.length,
    position: lesson.position,
    summary: lesson.summary ?? lesson.lessonSummary ?? null,
    learningObjectives: safeArray(lesson.learningObjectives),
    keyPoints: safeArray(lesson.keyPoints),
    prevLessonId,
    nextLessonId,
    nextIsQuiz: isLastInModule && !!moduleQuizInfo,
    quizModuleId: isLastInModule && moduleQuizInfo ? lesson.moduleId : null,
    content,
  })
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { lessonId } = params

    const [existing] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const body = await req.json()
    const { title, content, learningObjectives, summary, keyPoints } = body

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (title !== undefined) updates.title = title
    if (content !== undefined) {
      updates.contentJson = typeof content === 'string' ? content : JSON.stringify(content)
    }
    if (learningObjectives !== undefined) {
      updates.learningObjectives =
        typeof learningObjectives === 'string'
          ? learningObjectives
          : JSON.stringify(learningObjectives)
    }
    if (summary !== undefined) updates.lessonSummary = summary
    if (keyPoints !== undefined) {
      updates.keyPoints = typeof keyPoints === 'string' ? keyPoints : JSON.stringify(keyPoints)
    }

    await db.update(lessons).set(updates).where(eq(lessons.id, lessonId))

    const [updated] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1)

    let parsedContent = null
    if (updated.contentJson) {
      try {
        parsedContent = JSON.parse(updated.contentJson)
      } catch {}
    }

    return NextResponse.json({ lesson: { ...updated, content: parsedContent } })
  } catch (error) {
    console.error('[PUT /api/lessons/[lessonId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
