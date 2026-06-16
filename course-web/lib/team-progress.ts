import { db } from '@/lib/db'
import { enrollments, courses, users, quizAttempts, quizzes, teamMembers } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

/** The user ids belonging to a team (used to scope team-progress analytics). */
export async function getTeamMemberIds(teamId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
  return rows.map((r) => r.userId)
}

export interface TeamLearnerRow {
  userId: string
  name: string
  email: string
  coursesAssigned: number
  coursesCompleted: number
  avgQuizScore: number | null
  overdueCount: number
  lastActiveAt: string | null
}

export interface TeamCourseRow {
  courseId: string
  title: string
  enrolled: number
  completed: number
  completionRate: number
  avgScore: number | null
}

export interface TeamProgressData {
  learners: TeamLearnerRow[]
  courses: TeamCourseRow[]
}

/**
 * Builds team-progress analytics for an org. When `memberUserIds` is provided
 * (a team selection), learners AND course stats are scoped to just those users;
 * otherwise it covers the whole organization.
 */
export async function buildTeamProgress(
  organizationId: string,
  memberUserIds?: string[] | null,
): Promise<TeamProgressData> {
  const now = new Date()
  const scoped = Array.isArray(memberUserIds)

  // An empty team selection → no learners (don't fall back to the whole org).
  if (scoped && memberUserIds!.length === 0) {
    const orgCourses = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.organizationId, organizationId))
    return {
      learners: [],
      courses: orgCourses.map((c) => ({
        courseId: c.id, title: c.title, enrolled: 0, completed: 0, completionRate: 0, avgScore: null,
      })),
    }
  }

  const orgUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      scoped
        ? and(eq(users.organizationId, organizationId), inArray(users.id, memberUserIds!))
        : eq(users.organizationId, organizationId),
    )

  const orgCourses = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.organizationId, organizationId))

  const courseIds = orgCourses.map((c) => c.id)
  const userIds = orgUsers.map((u) => u.id)

  // Scope enrollments to the resolved user set so the per-course table reflects
  // the selected team (when org-wide, userIds already covers every org user).
  const enrollRows = courseIds.length && userIds.length
    ? await db
        .select({
          userId: enrollments.userId,
          courseId: enrollments.courseId,
          completedAt: enrollments.completedAt,
          dueAt: enrollments.dueAt,
          lastAccessedAt: enrollments.lastAccessedAt,
        })
        .from(enrollments)
        .where(and(inArray(enrollments.courseId, courseIds), inArray(enrollments.userId, userIds)))
    : []

  const attemptRows = userIds.length
    ? await db
        .select({
          userId: quizAttempts.userId,
          score: quizAttempts.score,
          completedAt: quizAttempts.completedAt,
          courseId: quizzes.courseId,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(inArray(quizAttempts.userId, userIds))
    : []

  const scoresByUser = new Map<string, number[]>()
  const scoresByCourse = new Map<string, number[]>()
  for (const a of attemptRows) {
    if (a.completedAt == null || a.score == null) continue
    const userList = scoresByUser.get(a.userId) ?? []
    userList.push(a.score)
    scoresByUser.set(a.userId, userList)
    if (a.courseId) {
      const courseList = scoresByCourse.get(a.courseId) ?? []
      courseList.push(a.score)
      scoresByCourse.set(a.courseId, courseList)
    }
  }

  const avg = (nums: number[]): number | null =>
    nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : null

  const learners: TeamLearnerRow[] = orgUsers.map((u) => {
    const userEnrollments = enrollRows.filter((e) => e.userId === u.id)
    const coursesAssigned = userEnrollments.length
    const coursesCompleted = userEnrollments.filter((e) => e.completedAt != null).length
    const overdueCount = userEnrollments.filter(
      (e) => e.completedAt == null && e.dueAt != null && e.dueAt.getTime() < now.getTime()
    ).length
    const lastActive = userEnrollments
      .map((e) => e.lastAccessedAt)
      .filter((d): d is Date => d != null)
      .sort((a, b) => b.getTime() - a.getTime())[0]

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      coursesAssigned,
      coursesCompleted,
      avgQuizScore: avg(scoresByUser.get(u.id) ?? []),
      overdueCount,
      lastActiveAt: lastActive ? lastActive.toISOString() : null,
    }
  })

  const courseSummaries: TeamCourseRow[] = orgCourses.map((c) => {
    const courseEnrollments = enrollRows.filter((e) => e.courseId === c.id)
    const enrolled = courseEnrollments.length
    const completed = courseEnrollments.filter((e) => e.completedAt != null).length
    const completionRate = enrolled ? Math.round((completed / enrolled) * 1000) / 10 : 0
    return {
      courseId: c.id,
      title: c.title,
      enrolled,
      completed,
      completionRate,
      avgScore: avg(scoresByCourse.get(c.id) ?? []),
    }
  })

  return { learners, courses: courseSummaries }
}
