import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { flashcards, flashcardReviews, lessons, courses } from '@/lib/db/schema'
import { eq, and, isNull, lte, or } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

interface GeneratedCard {
  front: string
  back: string
}

function safeJsonArray(raw: string | null): unknown[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function asKeyTakeaways(contentJson: string | null): string[] {
  if (!contentJson) return []
  try {
    const v = JSON.parse(contentJson)
    if (v && Array.isArray(v.keyTakeaways)) {
      return v.keyTakeaways.filter((t: unknown): t is string => typeof t === 'string')
    }
    return []
  } catch {
    return []
  }
}

function promptFromPoint(point: string, lessonTitle: string): string {
  const trimmed = point.trim().replace(/\s+/g, ' ')
  if (!trimmed) return `What should you remember from "${lessonTitle}"?`
  if (/\?$/.test(trimmed)) return trimmed
  return `In "${lessonTitle}": ${trimmed}?`
}

function buildCardsForLesson(lesson: {
  id: string
  title: string
  keyPoints: string | null
  contentJson: string | null
  lessonSummary: string | null
  summary: string | null
}): GeneratedCard[] {
  const points = safeJsonArray(lesson.keyPoints).filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  )
  const takeaways = asKeyTakeaways(lesson.contentJson).filter(t => t.trim().length > 0)

  const detail =
    (lesson.lessonSummary && lesson.lessonSummary.trim()) ||
    (lesson.summary && lesson.summary.trim()) ||
    `Review the lesson "${lesson.title}".`

  const cards: GeneratedCard[] = []
  const seen = new Set<string>()

  const pushCard = (front: string, back: string) => {
    const key = front.trim().toLowerCase()
    if (!front.trim() || !back.trim() || seen.has(key)) return
    seen.add(key)
    cards.push({ front: front.trim(), back: back.trim() })
  }

  for (const point of points) {
    pushCard(promptFromPoint(point, lesson.title), point)
  }

  for (const takeaway of takeaways) {
    pushCard(promptFromPoint(takeaway, lesson.title), takeaway)
  }

  // Always leave at least one card so the lesson is reviewable.
  if (cards.length === 0) {
    pushCard(`What is the main idea of "${lesson.title}"?`, detail)
  }

  // Keep it to ~3–6 cards per lesson.
  return cards.slice(0, 6)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) {
    return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })
  }

  // Scope the course to the caller's organization.
  const [course] = await db
    .select({ id: courses.id, organizationId: courses.organizationId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Lazily generate flashcards for this course if none exist yet.
  const existing = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(eq(flashcards.courseId, courseId))
    .limit(1)

  if (existing.length === 0) {
    const courseLessons = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        keyPoints: lessons.keyPoints,
        contentJson: lessons.contentJson,
        lessonSummary: lessons.lessonSummary,
        summary: lessons.summary,
      })
      .from(lessons)
      .where(eq(lessons.courseId, courseId))

    const now = new Date()
    const rows = courseLessons.flatMap(lesson =>
      buildCardsForLesson(lesson).map(card => ({
        id: uuidv4(),
        courseId,
        lessonId: lesson.id,
        front: card.front,
        back: card.back,
        createdAt: now,
      })),
    )

    if (rows.length > 0) {
      await db.insert(flashcards).values(rows)
    }
  }

  const now = new Date()

  // Due cards = those with no review row, or whose dueAt is at/earlier than now.
  const rows = await db
    .select({
      id: flashcards.id,
      courseId: flashcards.courseId,
      lessonId: flashcards.lessonId,
      front: flashcards.front,
      back: flashcards.back,
      reviewId: flashcardReviews.id,
      dueAt: flashcardReviews.dueAt,
    })
    .from(flashcards)
    .leftJoin(
      flashcardReviews,
      and(
        eq(flashcardReviews.flashcardId, flashcards.id),
        eq(flashcardReviews.userId, session.user.id),
      ),
    )
    .where(
      and(
        eq(flashcards.courseId, courseId),
        or(isNull(flashcardReviews.id), lte(flashcardReviews.dueAt, now)),
      ),
    )

  const due = rows.map(r => ({
    id: r.id,
    courseId: r.courseId,
    lessonId: r.lessonId,
    front: r.front,
    back: r.back,
  }))

  return NextResponse.json({ due, count: due.length })
}
