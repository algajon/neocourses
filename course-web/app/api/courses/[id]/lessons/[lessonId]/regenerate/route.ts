import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, lessons, modules, sourceMaterials } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAIProvider } from '@/lib/ai'

interface RouteParams {
  params: { id: string; lessonId: string }
}

const EDIT_ROLES = new Set(['owner', 'admin', 'editor'])
const SOURCE_CHAR_BUDGET = 12000

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!EDIT_ROLES.has(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: courseId, lessonId } = params

    // Verify the course belongs to the caller's organization before touching it.
    const [course] = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.organizationId, session.user.organizationId ?? '')))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const [lesson] = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        courseId: lessons.courseId,
        moduleId: lessons.moduleId,
        moduleTitle: modules.title,
      })
      .from(lessons)
      .leftJoin(modules, eq(lessons.moduleId, modules.id))
      .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
      .limit(1)

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : ''

    // Join all extracted source text for the course so generation is grounded.
    // generateLessons() retrieves the passages most relevant to this lesson.
    const sources = await db
      .select({ extractedText: sourceMaterials.extractedText })
      .from(sourceMaterials)
      .where(eq(sourceMaterials.courseId, courseId))

    let combinedSourceText = sources
      .map((s) => (s.extractedText ?? '').trim())
      .filter(Boolean)
      .join('\n\n')
    if (combinedSourceText.length > SOURCE_CHAR_BUDGET) {
      combinedSourceText = combinedSourceText.slice(0, SOURCE_CHAR_BUDGET)
    }

    // Fold any editor instruction into the module-title context so the model honors
    // it while still keying retrieval/content on the lesson title.
    const moduleContext = instruction
      ? `${lesson.moduleTitle ?? course.title} (editor guidance: ${instruction})`
      : lesson.moduleTitle ?? course.title

    const ai = getAIProvider()
    const [generated] = await ai.generateLessons(
      moduleContext,
      [lesson.title],
      course.title,
      combinedSourceText || undefined,
    )

    if (!generated) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
    }

    const contentJson = JSON.stringify(generated.content)
    const keyPoints = JSON.stringify(generated.keyPoints ?? [])
    const summary = generated.summary ?? ''

    await db
      .update(lessons)
      .set({
        contentJson,
        keyPoints,
        lessonSummary: summary,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, lessonId))

    return NextResponse.json({
      title: generated.title,
      content: generated.content,
      keyPoints: generated.keyPoints ?? [],
      summary,
      grounded: combinedSourceText.length > 0,
    })
  } catch (error) {
    console.error('[POST /api/courses/[id]/lessons/[lessonId]/regenerate]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
