import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, count, and, isNotNull, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, users } from '@/lib/db/schema'
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgId = session.user.organizationId

  const [totalCoursesResult] = await db
    .select({ count: count() })
    .from(courses)
    .where(orgId ? eq(courses.organizationId, orgId) : sql`1=1`)

  const [publishedCoursesResult] = await db
    .select({ count: count() })
    .from(courses)
    .where(
      orgId
        ? and(eq(courses.organizationId, orgId), eq(courses.status, 'published'))
        : eq(courses.status, 'published')
    )

  const [totalLearnersResult] = await db
    .select({ count: count() })
    .from(enrollments)

  const [completionsResult] = await db
    .select({ count: count() })
    .from(enrollments)
    .where(isNotNull(enrollments.completedAt))

  const recentCourses = await db
    .select()
    .from(courses)
    .where(orgId ? eq(courses.organizationId, orgId) : sql`1=1`)
    .orderBy(sql`${courses.createdAt} desc`)
    .limit(5)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>Admin</div>
        <h1>Dashboard</h1>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Courses</div>
          <div className={styles.statValue}>{totalCoursesResult.count}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue}>{publishedCoursesResult.count}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Learners</div>
          <div className={styles.statValue}>{totalLearnersResult.count}</div>
          <div className={styles.statSub}>enrollments</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completions</div>
          <div className={styles.statValue}>{completionsResult.count}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Courses</h2>
          <Link href="/admin/courses" className="btn-secondary">View all</Link>
        </div>
        {recentCourses.length === 0 ? (
          <div className={styles.emptyState}>No courses yet. <Link href="/admin/courses/new">Create your first course.</Link></div>
        ) : (
          <ul className={styles.courseList}>
            {recentCourses.map((course) => (
              <li key={course.id} className={styles.courseRow}>
                <div className={styles.courseInfo}>
                  <div className={styles.courseTitle}>{course.title}</div>
                  <div className={styles.courseMeta}>Created {formatDate(course.createdAt)}</div>
                </div>
                <div className={styles.courseActions}>
                  <span className={STATUS_PILL[course.status] ?? 'pill pill-draft'}>{course.status}</span>
                  <Link href={`/admin/courses/${course.id}`} className="btn-secondary">View</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
