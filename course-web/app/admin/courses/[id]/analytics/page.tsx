import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, count, isNotNull, avg, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, users, quizAttempts, quizzes, quizQuestions, lessonProgress } from '@/lib/db/schema'
import styles from './page.module.css'

interface MissedQuestion {
  id: string
  questionText: string
  correctRate: number
  answeredCount: number
}

interface QuizInsight {
  quizId: string
  title: string
  passingScore: number
  attemptCount: number
  avgScore: number | null
  passRate: number | null
  missedQuestions: MissedQuestion[]
}

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
    .select({
      id: quizzes.id,
      title: quizzes.title,
      passingScore: quizzes.passingScore,
    })
    .from(quizzes)
    .where(eq(quizzes.courseId, id))

  const quizIds = courseQuizzes.map((q) => q.id)

  let avgQuizScore: number | null = null
  let quizInsights: QuizInsight[] = []

  if (quizIds.length > 0) {
    const inClause = sql`${quizAttempts.quizId} IN (${sql.join(
      quizIds.map((qid) => sql`${qid}`),
      sql`, `
    )})`

    const [result] = await db
      .select({ avg: avg(quizAttempts.score) })
      .from(quizAttempts)
      .where(inClause)
    avgQuizScore = result.avg != null ? Number(result.avg) * 100 : null

    const allQuestions = await db
      .select({
        id: quizQuestions.id,
        quizId: quizQuestions.quizId,
        questionText: quizQuestions.questionText,
        correctAnswer: quizQuestions.correctAnswer,
      })
      .from(quizQuestions)
      .where(
        sql`${quizQuestions.quizId} IN (${sql.join(
          quizIds.map((qid) => sql`${qid}`),
          sql`, `
        )})`
      )

    const allAttempts = await db
      .select({
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        passed: quizAttempts.passed,
        answers: quizAttempts.answers,
      })
      .from(quizAttempts)
      .where(inClause)

    const questionsByQuiz = new Map<string, typeof allQuestions>()
    for (const q of allQuestions) {
      const list = questionsByQuiz.get(q.quizId) ?? []
      list.push(q)
      questionsByQuiz.set(q.quizId, list)
    }

    const attemptsByQuiz = new Map<string, typeof allAttempts>()
    for (const a of allAttempts) {
      const list = attemptsByQuiz.get(a.quizId) ?? []
      list.push(a)
      attemptsByQuiz.set(a.quizId, list)
    }

    quizInsights = courseQuizzes.map((quiz) => {
      const attempts = attemptsByQuiz.get(quiz.id) ?? []
      const questions = questionsByQuiz.get(quiz.id) ?? []
      const attemptCount = attempts.length

      let avgScore: number | null = null
      let passRate: number | null = null
      if (attemptCount > 0) {
        const scoreSum = attempts.reduce((acc, a) => acc + (a.score ?? 0), 0)
        avgScore = (scoreSum / attemptCount) * 100
        const passedCount = attempts.filter((a) => a.passed).length
        passRate = (passedCount / attemptCount) * 100
      }

      // answers column stores JSON.stringify(Record<questionId, givenAnswer>);
      // correctness is reconstructed with the same normalization as scoring.
      const correctCounts = new Map<string, { correct: number; answered: number }>()
      for (const attempt of attempts) {
        let parsed: Record<string, string> = {}
        try {
          parsed = JSON.parse(attempt.answers) as Record<string, string>
        } catch {
          parsed = {}
        }
        for (const q of questions) {
          const given = parsed[q.id]
          if (given == null) continue
          const stat = correctCounts.get(q.id) ?? { correct: 0, answered: 0 }
          stat.answered++
          if (given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
            stat.correct++
          }
          correctCounts.set(q.id, stat)
        }
      }

      const missedQuestions: MissedQuestion[] = questions
        .map((q) => {
          const stat = correctCounts.get(q.id)
          const answered = stat?.answered ?? 0
          const correctRate = answered > 0 ? ((stat?.correct ?? 0) / answered) * 100 : 0
          return {
            id: q.id,
            questionText: q.questionText,
            correctRate,
            answeredCount: answered,
          }
        })
        .filter((q) => q.answeredCount > 0)
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, 5)

      return {
        quizId: quiz.id,
        title: quiz.title,
        passingScore: (quiz.passingScore ?? 0.7) * 100,
        attemptCount,
        avgScore,
        passRate,
        missedQuestions,
      }
    })
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

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2>Quiz Insights</h2>
          <span className={styles.tableCount}>
            {quizInsights.length} quiz{quizInsights.length !== 1 ? 'zes' : ''}
          </span>
        </div>
        {quizInsights.length === 0 ? (
          <div className={styles.emptyState}>No quizzes in this course yet.</div>
        ) : (
          <div className={styles.insightsList}>
            {quizInsights.map((quiz) => (
              <div key={quiz.quizId} className={styles.insightCard}>
                <div className={styles.insightHead}>
                  <div className={styles.insightTitle}>{quiz.title}</div>
                  <div className={styles.insightMetrics}>
                    <div className={styles.insightMetric}>
                      <span className={styles.insightMetricValue}>{quiz.attemptCount}</span>
                      <span className={styles.insightMetricLabel}>attempts</span>
                    </div>
                    <div className={styles.insightMetric}>
                      <span className={styles.insightMetricValue}>
                        {quiz.avgScore != null ? `${Math.round(quiz.avgScore)}%` : '—'}
                      </span>
                      <span className={styles.insightMetricLabel}>avg score</span>
                    </div>
                    <div className={styles.insightMetric}>
                      <span className={styles.insightMetricValue}>
                        {quiz.passRate != null ? `${Math.round(quiz.passRate)}%` : '—'}
                      </span>
                      <span className={styles.insightMetricLabel}>pass rate</span>
                    </div>
                  </div>
                </div>
                {quiz.attemptCount === 0 ? (
                  <div className={styles.insightEmpty}>No attempts yet.</div>
                ) : quiz.missedQuestions.length === 0 ? (
                  <div className={styles.insightEmpty}>No answered questions recorded.</div>
                ) : (
                  <div className={styles.missedSection}>
                    <div className={styles.missedHeading}>Most-missed questions</div>
                    <ul className={styles.missedList}>
                      {quiz.missedQuestions.map((q) => (
                        <li key={q.id} className={styles.missedItem}>
                          <div className={styles.missedText}>{q.questionText}</div>
                          <div className={styles.missedBarRow}>
                            <div className={styles.missedBar}>
                              <div
                                className={styles.missedBarFill}
                                style={{ width: `${Math.round(q.correctRate)}%` }}
                              />
                            </div>
                            <span className={styles.missedRate}>
                              {Math.round(q.correctRate)}% correct
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
