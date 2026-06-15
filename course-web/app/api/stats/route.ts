import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, users, enrollments } from '@/lib/db/schema'
import { eq, count, and, isNotNull } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = session.user.role === 'admin' || session.user.role === 'owner'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = session.user.organizationId

  const courseFilter = orgId ? eq(courses.organizationId, orgId) : undefined
  const userFilter = orgId ? eq(users.organizationId, orgId) : undefined

  const [{ totalCourses }] = await db
    .select({ totalCourses: count() })
    .from(courses)
    .where(courseFilter)

  const [{ publishedCourses }] = await db
    .select({ publishedCourses: count() })
    .from(courses)
    .where(
      courseFilter
        ? and(courseFilter, eq(courses.status, 'published'))
        : eq(courses.status, 'published'),
    )

  const [{ totalLearners }] = await db
    .select({ totalLearners: count() })
    .from(users)
    .where(
      userFilter
        ? and(userFilter, eq(users.role, 'learner'))
        : eq(users.role, 'learner'),
    )

  const [{ totalEnrollments }] = await db
    .select({ totalEnrollments: count() })
    .from(enrollments)

  const [{ completedCount }] = await db
    .select({ completedCount: count() })
    .from(enrollments)
    .where(isNotNull(enrollments.completedAt))

  const completionRate =
    totalEnrollments > 0
      ? Math.round((Number(completedCount) / Number(totalEnrollments)) * 100)
      : 0

  const recentCourses = await db
    .select()
    .from(courses)
    .where(courseFilter)
    .orderBy(courses.createdAt)
    .limit(5)

  return NextResponse.json({
    totalCourses: Number(totalCourses),
    publishedCourses: Number(publishedCourses),
    totalLearners: Number(totalLearners),
    totalEnrollments: Number(totalEnrollments),
    completionRate,
    recentCourses,
  })
}
