import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, count, countDistinct, and, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, users } from '@/lib/db/schema'
import { Icon } from '@/components/Icon'
import type { IconName } from '@/components/Icon'
import styles from './page.module.css'

const STATUS_PILL: Record<string, string> = {
  draft: 'pill pill-draft',
  processing: 'pill pill-info',
  ready: 'pill pill-warning',
  published: 'pill pill-success',
  archived: 'pill pill-draft',
}

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

function relativeDays(due: Date, now: Date) {
  const ms = now.getTime() - due.getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'due today'
  if (days === 1) return '1 day overdue'
  return `${days} days overdue`
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  const now = new Date()

  // Enrollments are scoped to the org by joining through their course.
  const orgEnrollment = orgId ? eq(courses.organizationId, orgId) : sql`1=1`

  const [
    [totalCoursesResult],
    [publishedCoursesResult],
    [totalLearnersResult],
    [activeLearnersResult],
    [enrollmentTotalsResult],
    [overdueResult],
    recentCourses,
    attentionEnrollments,
  ] = await Promise.all([
    // Total courses in org
    db
      .select({ count: count() })
      .from(courses)
      .where(orgId ? eq(courses.organizationId, orgId) : sql`1=1`),
    // Published courses in org
    db
      .select({ count: count() })
      .from(courses)
      .where(
        orgId
          ? and(eq(courses.organizationId, orgId), eq(courses.status, 'published'))
          : eq(courses.status, 'published')
      ),
    // Distinct learners with at least one enrollment in an org course
    db
      .select({ count: countDistinct(enrollments.userId) })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(orgEnrollment),
    // Active learners: accessed a course in the last 30 days
    db
      .select({ count: countDistinct(enrollments.userId) })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          orgEnrollment,
          isNotNull(enrollments.lastAccessedAt),
          sql`${enrollments.lastAccessedAt} > now() - interval '30 days'`
        )
      ),
    // Enrollment totals + completions for the completion rate
    db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${enrollments.completedAt} is not null)`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(orgEnrollment),
    // Overdue assignments: required-by date passed, not yet completed
    db
      .select({ count: count() })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          orgEnrollment,
          isNotNull(enrollments.dueAt),
          lt(enrollments.dueAt, now),
          isNull(enrollments.completedAt)
        )
      ),
    // Recent courses for the activity column
    db
      .select()
      .from(courses)
      .where(orgId ? eq(courses.organizationId, orgId) : sql`1=1`)
      .orderBy(sql`${courses.createdAt} desc`)
      .limit(5),
    // Needs-attention: overdue, incomplete enrollments with learner + course
    db
      .select({
        enrollmentId: enrollments.id,
        learnerName: users.name,
        courseId: courses.id,
        courseTitle: courses.title,
        dueAt: enrollments.dueAt,
        progressPercent: enrollments.progressPercent,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(
        and(
          orgEnrollment,
          isNotNull(enrollments.dueAt),
          lt(enrollments.dueAt, now),
          isNull(enrollments.completedAt)
        )
      )
      .orderBy(sql`${enrollments.dueAt} asc`)
      .limit(6),
  ])

  const totalEnrollments = enrollmentTotalsResult?.total ?? 0
  const completedEnrollments = Number(enrollmentTotalsResult?.completed ?? 0)
  const completionRate =
    totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
  const overdueCount = overdueResult?.count ?? 0

  const kpis: { label: string; value: string; sub?: string; icon: IconName; tone?: string }[] = [
    {
      label: 'Total learners',
      value: String(totalLearnersResult?.count ?? 0),
      sub: 'enrolled in a course',
      icon: 'users',
    },
    {
      label: 'Active (30d)',
      value: String(activeLearnersResult?.count ?? 0),
      sub: 'accessed recently',
      icon: 'trendingUp',
    },
    {
      label: 'Courses',
      value: String(totalCoursesResult?.count ?? 0),
      sub: `${publishedCoursesResult?.count ?? 0} published`,
      icon: 'book',
    },
    {
      label: 'Completion rate',
      value: `${completionRate}%`,
      sub: `${completedEnrollments} of ${totalEnrollments}`,
      icon: 'target',
    },
    {
      label: 'Overdue',
      value: String(overdueCount),
      sub: 'assignments past due',
      icon: 'alertTriangle',
      tone: overdueCount > 0 ? 'warning' : undefined,
    },
  ]

  const hasAnyData = (totalCoursesResult?.count ?? 0) > 0 || totalEnrollments > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>Admin</div>
        <h1>Dashboard</h1>
      </div>

      {!hasAnyData ? (
        <div className={styles.welcome}>
          <div className={styles.welcomeIcon}>
            <Icon name="sparkles" size={22} />
          </div>
          <h2>Welcome — let’s get your team learning</h2>
          <p>
            You don’t have any courses or enrollments yet. Create your first course and assign it
            to your team to start tracking progress here.
          </p>
          <Link href="/admin/courses/new" className="btn-cta">
            <Icon name="sparkles" size={15} /> Create your first course
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`${styles.statCard} ${kpi.tone === 'warning' ? styles.statWarning : ''}`}
              >
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>{kpi.label}</span>
                  <span className={styles.statIcon}>
                    <Icon name={kpi.icon} size={15} />
                  </span>
                </div>
                <div className={styles.statValue}>{kpi.value}</div>
                {kpi.sub && <div className={styles.statSub}>{kpi.sub}</div>}
              </div>
            ))}
          </div>

          <div className={styles.columns}>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>
                  <Icon name="alertTriangle" size={15} /> Needs attention
                </h2>
                <Link href="/admin/courses" className="btn-secondary">
                  All courses
                </Link>
              </div>
              {attentionEnrollments.length === 0 ? (
                <div className={styles.emptyState}>
                  <Icon name="check" size={18} />
                  <span>Nothing overdue. Your learners are on track.</span>
                </div>
              ) : (
                <ul className={styles.attentionList}>
                  {attentionEnrollments.map((row) => (
                    <li key={row.enrollmentId} className={styles.attentionRow}>
                      <div className={styles.attentionInfo}>
                        <div className={styles.attentionTitle}>{row.learnerName}</div>
                        <div className={styles.attentionMeta}>
                          {row.courseTitle} · {Math.round(row.progressPercent ?? 0)}% done
                        </div>
                      </div>
                      <div className={styles.attentionRight}>
                        <span className="pill pill-warning">
                          {row.dueAt ? relativeDays(row.dueAt, now) : 'overdue'}
                        </span>
                        <Link href={`/admin/courses/${row.courseId}`} className={styles.linkBtn}>
                          <Icon name="arrowRight" size={14} />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>
                  <Icon name="book" size={15} /> Recent courses
                </h2>
                <Link href="/admin/courses" className="btn-secondary">
                  View all
                </Link>
              </div>
              {recentCourses.length === 0 ? (
                <div className={styles.emptyState}>
                  <span>
                    No courses yet. <Link href="/admin/courses/new">Create your first course.</Link>
                  </span>
                </div>
              ) : (
                <ul className={styles.courseList}>
                  {recentCourses.map((course) => (
                    <li key={course.id} className={styles.courseRow}>
                      <div className={styles.courseInfo}>
                        <div className={styles.courseTitle}>{course.title}</div>
                        <div className={styles.courseMeta}>Created {formatDate(course.createdAt)}</div>
                      </div>
                      <div className={styles.courseActions}>
                        <span className={STATUS_PILL[course.status] ?? 'pill pill-draft'}>
                          {course.status}
                        </span>
                        <Link href={`/admin/courses/${course.id}`} className="btn-secondary">
                          View
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
