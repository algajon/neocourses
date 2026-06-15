import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { enrollments, courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import styles from './page.module.css'

async function getEnrollmentsWithCourses(userId: string) {
  const rows = await db
    .select({
      enrollment: enrollments,
      course: courses,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))

  return rows
}

export default async function LearnPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const rows = await getEnrollmentsWithCourses(session.user.id)

  const inProgress = rows
    .filter(r => !r.enrollment.completedAt && (r.enrollment.progressPercent ?? 0) > 0)
    .sort((a, b) => {
      const aTime = a.enrollment.lastAccessedAt?.getTime() ?? 0
      const bTime = b.enrollment.lastAccessedAt?.getTime() ?? 0
      return bTime - aTime
    })

  const notStarted = rows.filter(
    r => !r.enrollment.completedAt && (r.enrollment.progressPercent ?? 0) === 0,
  )

  const completed = rows.filter(r => !!r.enrollment.completedAt)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>My Learning</h1>
        <p className={styles.subheading}>
          {rows.length} course{rows.length !== 1 ? 's' : ''} enrolled
        </p>
      </div>

      {inProgress.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Continue Learning</h2>
          <div className={styles.grid}>
            {inProgress.map(({ enrollment, course }) => (
              <CourseCard
                key={enrollment.id}
                course={course}
                enrollment={enrollment}
                action="continue"
              />
            ))}
          </div>
        </section>
      )}

      {notStarted.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assigned to You</h2>
          <div className={styles.grid}>
            {notStarted.map(({ enrollment, course }) => (
              <CourseCard
                key={enrollment.id}
                course={course}
                enrollment={enrollment}
                action="start"
              />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Completed</h2>
          <div className={styles.grid}>
            {completed.map(({ enrollment, course }) => (
              <CourseCard
                key={enrollment.id}
                course={course}
                enrollment={enrollment}
                action="review"
              />
            ))}
          </div>
        </section>
      )}

      {rows.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Icon name="book" size={32} /></div>
          <p className={styles.emptyText}>No courses assigned yet.</p>
          <p className={styles.emptySubtext}>Check back soon or contact your administrator.</p>
        </div>
      )}
    </div>
  )
}

type CourseRow = Awaited<ReturnType<typeof getEnrollmentsWithCourses>>[number]

function CourseCard({
  course,
  enrollment,
  action,
}: {
  course: CourseRow['course']
  enrollment: CourseRow['enrollment']
  action: 'start' | 'continue' | 'review'
}) {
  const progress = Math.round(enrollment.progressPercent ?? 0)
  const href = `/learn/${course.id}`

  const difficultyLabel: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span className={styles.difficulty}>
            {difficultyLabel[course.difficultyLevel] ?? course.difficultyLevel}
          </span>
          {course.estimatedMinutes && (
            <span className={styles.duration}>{Math.round(course.estimatedMinutes / 60)}h</span>
          )}
        </div>
        <h3 className={styles.cardTitle}>{course.title}</h3>
        {course.description && (
          <p className={styles.cardDescription}>{course.description}</p>
        )}
        <div className={styles.progressRow}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressLabel}>{progress}%</span>
        </div>
      </div>
      <div className={styles.cardFooter}>
        <Link
          href={href}
          className={
            action === 'continue'
              ? styles.btnPrimary
              : action === 'start'
                ? styles.btnAccent
                : styles.btnSecondary
          }
        >
          {action === 'continue' ? 'Continue' : action === 'start' ? 'Start Course' : 'Review'}
        </Link>
      </div>
    </div>
  )
}
