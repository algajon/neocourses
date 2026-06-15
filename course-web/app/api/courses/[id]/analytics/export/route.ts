import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { eq, inArray, and } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  courses,
  enrollments,
  users,
  quizzes,
  quizAttempts,
  lessonProgress,
} from '@/lib/db/schema'

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId } = session.user
    if (role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const courseId = params.id

    const [course] = await db
      .select({ id: courses.id, title: courses.title, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)

    if (!course || course.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const learnerRows = await db
      .select({
        userId: enrollments.userId,
        userName: users.name,
        userEmail: users.email,
        progressPercent: enrollments.progressPercent,
        completedAt: enrollments.completedAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        enrolledAt: enrollments.enrolledAt,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.courseId, courseId))

    const userIds = learnerRows.map((r) => r.userId)

    // completed lessons per learner (lessonProgress rows with completedAt set)
    const completedLessons = new Map<string, number>()
    if (userIds.length > 0) {
      const lp = await db
        .select({ userId: lessonProgress.userId, completedAt: lessonProgress.completedAt })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.courseId, courseId),
            inArray(lessonProgress.userId, userIds)
          )
        )
      for (const row of lp) {
        if (row.completedAt) {
          completedLessons.set(row.userId, (completedLessons.get(row.userId) ?? 0) + 1)
        }
      }
    }

    // quiz average per learner across this course's quizzes
    const quizAvg = new Map<string, { sum: number; count: number }>()
    if (userIds.length > 0) {
      const courseQuizIds = (
        await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.courseId, courseId))
      ).map((q) => q.id)

      if (courseQuizIds.length > 0) {
        const attempts = await db
          .select({ userId: quizAttempts.userId, score: quizAttempts.score })
          .from(quizAttempts)
          .where(
            and(
              inArray(quizAttempts.quizId, courseQuizIds),
              inArray(quizAttempts.userId, userIds)
            )
          )
        for (const a of attempts) {
          if (a.score == null) continue
          const cur = quizAvg.get(a.userId) ?? { sum: 0, count: 0 }
          cur.sum += a.score
          cur.count += 1
          quizAvg.set(a.userId, cur)
        }
      }
    }

    const header = [
      'Name',
      'Email',
      'Progress %',
      'Completed Lessons',
      'Quiz Avg %',
      'Status',
      'Enrolled',
      'Last Active',
    ]

    const lines: string[] = [header.map(csvCell).join(',')]
    for (const row of learnerRows) {
      const qa = quizAvg.get(row.userId)
      const quizAvgPct = qa && qa.count > 0 ? Math.round((qa.sum / qa.count) * 100) : ''
      lines.push(
        [
          row.userName,
          row.userEmail,
          Math.round(row.progressPercent ?? 0),
          completedLessons.get(row.userId) ?? 0,
          quizAvgPct,
          row.completedAt ? 'Completed' : 'In Progress',
          row.enrolledAt ? row.enrolledAt.toISOString().slice(0, 10) : '',
          row.lastAccessedAt ? row.lastAccessedAt.toISOString().slice(0, 10) : '',
        ]
          .map(csvCell)
          .join(',')
      )
    }

    const csv = lines.join('\n')
    const stamp = new Date().toISOString().slice(0, 10)
    const safeTitle = course.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'course'

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeTitle}-analytics-${stamp}.csv"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/courses/[id]/analytics/export]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
