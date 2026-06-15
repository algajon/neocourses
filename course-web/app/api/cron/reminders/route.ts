import { NextRequest, NextResponse } from 'next/server'
import { and, eq, lte, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { enrollments, courses, users } from '@/lib/db/schema'
import { sendEmail, assignmentReminder } from '@/lib/email'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// How far ahead we look for upcoming due dates. Enrollments due within this
// window (or already overdue) get a reminder.
const UPCOMING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

/**
 * Daily reminder cron. Finds active, incomplete enrollments that are due soon or
 * overdue and nudges the learner via email + in-app notification.
 *
 * Protect with a shared secret: send `Authorization: Bearer $CRON_SECRET` or an
 * `x-cron-secret: $CRON_SECRET` header. Intended to run once per day from a
 * scheduler (e.g. Vercel Cron / GitHub Actions / system cron).
 *
 * Dedupe limitation: there is no per-day send-log, so calling this more than
 * once a day will re-send. Run it on a daily schedule (or add a sent-log table,
 * owned by schema) to harden this.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 503 }
    )
  }

  const provided =
    req.headers.get('x-cron-secret')?.trim() ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + UPCOMING_WINDOW_MS)

  // Active, not-yet-completed enrollments with a due date at or before the
  // horizon (covers both overdue and due-soon).
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      dueAt: enrollments.dueAt,
      courseTitle: courses.title,
      email: users.email,
      name: users.name,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(
      and(
        isNull(enrollments.completedAt),
        isNotNull(enrollments.dueAt),
        lte(enrollments.dueAt, horizon)
      )
    )

  let emailed = 0
  let notified = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.dueAt) {
      skipped++
      continue
    }
    const overdue = row.dueAt.getTime() < now.getTime()
    const link = `/learn/${row.courseId}`

    // In-app notification (best-effort; createNotification itself also fires an
    // email, but reminders aren't mapped there, so we send the email directly).
    try {
      await createNotification({
        userId: row.userId,
        type: 'reminder',
        title: overdue ? 'Course overdue' : 'Course due soon',
        body: row.courseTitle,
        link,
      })
      notified++
    } catch {
      // best-effort
    }

    const email = row.email?.trim()
    if (email) {
      const rendered = assignmentReminder({
        name: row.name ?? undefined,
        courseTitle: row.courseTitle,
        link,
        dueAt: row.dueAt,
        overdue,
      })
      const ok = await sendEmail({ to: email, ...rendered })
      if (ok) emailed++
    } else {
      skipped++
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: rows.length,
    emailed,
    notified,
    skipped,
    ranAt: now.toISOString(),
  })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
