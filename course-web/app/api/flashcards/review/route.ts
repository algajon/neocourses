import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { flashcards, flashcardReviews, courses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { nextReview } from '@/lib/sr'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const flashcardId = body?.flashcardId as string | undefined
  const gradeRaw = body?.grade

  if (!flashcardId || typeof gradeRaw !== 'number' || ![0, 1, 2, 3].includes(gradeRaw)) {
    return NextResponse.json({ error: 'Missing or invalid flashcardId/grade' }, { status: 400 })
  }
  const grade = gradeRaw as 0 | 1 | 2 | 3

  // Validate the card exists and belongs to the caller's organization.
  const [card] = await db
    .select({ id: flashcards.id, organizationId: courses.organizationId })
    .from(flashcards)
    .innerJoin(courses, eq(flashcards.courseId, courses.id))
    .where(eq(flashcards.id, flashcardId))
    .limit(1)

  if (!card || card.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [existing] = await db
    .select()
    .from(flashcardReviews)
    .where(
      and(
        eq(flashcardReviews.flashcardId, flashcardId),
        eq(flashcardReviews.userId, session.user.id),
      ),
    )
    .limit(1)

  const prev = {
    ease: existing?.ease ?? 2.5,
    intervalDays: existing?.intervalDays ?? 0,
  }

  const result = nextReview(prev, grade)
  const now = new Date()

  if (existing) {
    await db
      .update(flashcardReviews)
      .set({
        ease: result.ease,
        intervalDays: result.intervalDays,
        dueAt: result.dueAt,
        lastReviewedAt: now,
      })
      .where(eq(flashcardReviews.id, existing.id))
  } else {
    await db.insert(flashcardReviews).values({
      id: uuidv4(),
      userId: session.user.id,
      flashcardId,
      ease: result.ease,
      intervalDays: result.intervalDays,
      dueAt: result.dueAt,
      lastReviewedAt: now,
    })
  }

  return NextResponse.json({
    ok: true,
    ease: result.ease,
    intervalDays: result.intervalDays,
    dueAt: result.dueAt.toISOString(),
  })
}
