import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, count, isNotNull, avg, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, users, quizAttempts, quizzes, lessonProgress } from '@/lib/db/schema'
import styles from './page.module.css'

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

function formatPercent(n: number | null | undefined) {
  if (n == null) return '0%'
  return `${Math.round(n)}%`
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CourseAnalyticsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1)

  if (!course) notFound()

  const [{ count: totalEnrolled }] = await db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.courseId, id))

  const [{ count: totalCompleted }] = await db
    .select({ count: count() })
    .from(enrollments)
    .where(
      sql`${enrollments.courseId} = ${id} AND ${enrollments.completedAt} IS NOT NULL`
    )

  const completionRate =
    totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0

  const courseQuizzes = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.courseId, id))

  const quizIds = courseQuizzes.map((q) => q.id)

  let avgQuizScore: number | null = null
  if (quizIds.length > 0) {
    const [result] = await db
      .select({ avg: avg(quizAttempts.score) })
      .from(quizAttempts)
      .where(
        sql`${quizAttempts.quizId} IN (${sql.join(quizIds.map((qid) => sql`${qid}`), sql`, `)})`
      )
    avgQuizScore = result.avg != null ? Number(result.avg) * 100 : null
  }

  const learnerRows = await db
    .select({
      enrollmentId: enrollments.id,
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
    .where(eq(enrollments.courseId, id))
    .orderBy(sql`${enrollments.enrolledAt} desc`)
    .limit(100)

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/admin/courses">Courses</Link> /{' '}
        <Link href={`/admin/courses/${id}`}>{course.title}</Link> / Analytics
      </div>
      <h1>Analytics</h1>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Enrolled</div>
          <div className={styles.statValue}>{totalEnrolled}</div>
          <div className={styles.statSub}>learners</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completions</div>
          <div className={styles.statValue}>{totalCompleted}</div>
          <div className={styles.statSub}>of {totalEnrolled}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completion Rate</div>
          <div className={styles.statValue}>{completionRate}%</div>
          <div className={styles.statProgress}>
            <div className={styles.statProgressBar} style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg Quiz Score</div>
          <div className={styles.statValue}>{avgQuizScore != null ? `${Math.round(avgQuizScore)}%` : '—'}</div>
          <div className={styles.statSub}>{quizIds.length} quiz{quizIds.length !== 1 ? 'zes' : ''}</div>
        </div>
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2>Learner Progress</h2>
          <span className={styles.tableCount}>{learnerRows.length} learner{learnerRows.length !== 1 ? 's' : ''}</span>
        </div>
        {learnerRows.length === 0 ? (
          <div className={styles.emptyState}>No learners enrolled yet.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Progress</th>
                  <th>Last Activity</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {learnerRows.map((row) => (
                  <tr key={row.enrollmentId}>
                    <td className={styles.nameCell}>{row.userName}</td>
                    <td className={styles.emailCell}>{row.userEmail}</td>
                    <td>
                      <div className={styles.progressCell}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${Math.round(row.progressPercent ?? 0)}%` }}
                          />
                        </div>
                        <span className={styles.progressPct}>{formatPercent(row.progressPercent)}</span>
                      </div>
                    </td>
                    <td className={styles.dateCell}>{formatDate(row.lastAccessedAt)}</td>
                    <td className={styles.dateCell}>{formatDate(row.enrolledAt)}</td>
                    <td>
                      {row.completedAt ? (
                        <span className="pill pill-success">Completed</span>
                      ) : (
                        <span className="pill pill-info">In Progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
