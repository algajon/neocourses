import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { aiTutorMessages, courses, lessons } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getAIProvider } from '@/lib/ai'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { courseId, message, lessonId } = body as {
    courseId: string
    message: string
    lessonId?: string
  }

  if (!courseId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const courseLessons = await db
    .select({ title: lessons.title, summary: lessons.summary })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))

  const courseContext = `Course: ${course.title}. ${course.description ?? ''}. Lessons: ${courseLessons.map(l => l.title).join(', ')}.`

  let lessonContent = ''
  if (lessonId) {
    const [lesson] = await db
      .select({ title: lessons.title, summary: lessons.summary, contentJson: lessons.contentJson })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1)
    if (lesson) {
      lessonContent = lesson.summary ?? ''
      if (!lessonContent && lesson.contentJson) {
        try {
          const parsed = JSON.parse(lesson.contentJson)
          lessonContent = parsed.intro ?? ''
        } catch {}
      }
    }
  }

  const recentHistory = await db
    .select()
    .from(aiTutorMessages)
    .where(and(eq(aiTutorMessages.courseId, courseId), eq(aiTutorMessages.userId, session.user.id)))
    .orderBy(desc(aiTutorMessages.createdAt))
    .limit(10)

  recentHistory.reverse()

  const userMsgId = randomUUID()
  await db.insert(aiTutorMessages).values({
    id: userMsgId,
    userId: session.user.id,
    courseId,
    lessonId: lessonId ?? null,
    role: 'user',
    content: message.trim(),
    createdAt: new Date(),
  })

  const ai = getAIProvider()
  const answer = await ai.answerTutorQuestion(courseContext, lessonContent, message.trim())

  const aiMsgId = randomUUID()
  await db.insert(aiTutorMessages).values({
    id: aiMsgId,
    userId: session.user.id,
    courseId,
    lessonId: lessonId ?? null,
    role: 'assistant',
    content: answer,
    createdAt: new Date(),
  })

  return NextResponse.json({
    id: aiMsgId,
    userMessageId: userMsgId,
    content: answer,
  })
}
