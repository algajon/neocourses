import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { enrollments, courses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { createNotification } from '@/lib/notify'
import { priceModelOf, hasFullAccess } from '@/lib/pricing'

/**
 * Access state for the caller — used by the lesson player to gate locked
 * chapters (course pricing model + the caller's paid/enrolled state).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const courseId = params.id

  const [course] = await db
    .select({
      id: courses.id,
      organizationId: courses.organizationId,
      pricingModel: courses.pricingModel,
      priceCents: courses.priceCents,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const [enrollment] = await db
    .select({ paid: enrollments.paid })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, session.user.id)))
    .limit(1)

  return NextResponse.json({
    pricingModel: priceModelOf(course),
    priceCents: course.priceCents ?? 0,
    enrolled: !!enrollment,
    paid: !!enrollment?.paid,
    hasFullAccess: hasFullAccess(course, enrollment ?? null),
  })
}

/**
 * PLACEHOLDER purchase — no real payment is taken. Self-scoped: enrolls the
 * caller if needed and flips enrollment.paid = true, granting full access.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const courseId = params.id
  const userId = session.user.id

  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      organizationId: courses.organizationId,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  if (course.status !== 'published') {
    return NextResponse.json({ error: 'Course is not published' }, { status: 400 })
  }

  const [existing] = await db
    .select({ id: enrollments.id, paid: enrollments.paid })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId)))
    .limit(1)

  let enrollment
  if (existing) {
    if (existing.paid) {
      return NextResponse.json({ enrollment: existing, alreadyPaid: true, ok: true })
    }
    ;[enrollment] = await db
      .update(enrollments)
      .set({ paid: true })
      .where(eq(enrollments.id, existing.id))
      .returning()
  } else {
    ;[enrollment] = await db
      .insert(enrollments)
      .values({
        id: randomUUID(),
        userId,
        courseId,
        enrolledAt: new Date(),
        progressPercent: 0,
        status: 'active',
        paid: true,
      })
      .returning()
  }

  // Best-effort — notify the learner the course is unlocked.
  try {
    await createNotification({
      userId,
      type: 'purchase',
      title: `Unlocked ${course.title}`,
      body: course.title,
      link: `/learn/${courseId}`,
    })
  } catch {
    // never block the unlock on notification failure
  }

  return NextResponse.json({ enrollment, ok: true }, { status: 200 })
}
