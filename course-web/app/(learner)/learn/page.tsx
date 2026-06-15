import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { enrollments, courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getGamificationSummary, BADGES } from '@/lib/gamification'
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

type CourseRow = Awaited<ReturnType<typeof getEnrollmentsWithCourses>>[number]

const difficultyLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function lessonHref(course: CourseRow['course'], enrollment: CourseRow['enrollment']) {
  if (enrollment.currentLessonId) {
    return `/learn/${course.id}/lessons/${enrollment.currentLessonId}`
  }
  return `/learn/${course.id}`
}

function relativeDue(due: Date): { label: string; tone: 'overdue' | 'soon' | 'later' } {
  const now = Date.now()
  const diffMs = due.getTime() - now
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.round(diffMs / dayMs)

  if (diffMs < 0) {
    const overdueDays = Math.abs(days)
    if (overdueDays === 0) return { label: 'Due today', tone: 'overdue' }
    return { label: `Overdue by ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`, tone: 'overdue' }
  }
  if (days === 0) return { label: 'Due today', tone: 'soon' }
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' }
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'soon' }
  if (days <= 30) {
    const weeks = Math.round(days / 7)
    return { label: `Due in ${weeks} week${weeks !== 1 ? 's' : ''}`, tone: 'later' }
  }
  return {
    label: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    tone: 'later',
  }
}

export default async function LearnPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const [rows, gamification] = await Promise.all([
    getEnrollmentsWithCourses(session.user.id),
    getGamificationSummary(session.user.id),
  ])

  const active = rows.filter(r => !r.enrollment.completedAt)
  const completed = rows.filter(r => !!r.enrollment.completedAt)

  const byLastAccessed = [...active].sort((a, b) => {
    const aTime = a.enrollment.lastAccessedAt?.getTime() ?? a.enrollment.enrolledAt.getTime()
    const bTime = b.enrollment.lastAccessedAt?.getTime() ?? b.enrollment.enrolledAt.getTime()
    return bTime - aTime
  })

  const inProgressAll = byLastAccessed.filter(r => (r.enrollment.progressPercent ?? 0) > 0)
  const resume = inProgressAll[0] ?? null

  // In progress excludes the resume card to avoid duplication; not-yet-started go here too.
  const inProgress = byLastAccessed.filter(r => r.enrollment.id !== resume?.enrollment.id)

  const dueSoon = active
    .filter(r => !!r.enrollment.dueAt)
    .sort((a, b) => a.enrollment.dueAt!.getTime() - b.enrollment.dueAt!.getTime())

  const completedCount = completed.length
  const inProgressCount = inProgressAll.length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>My Learning</h1>
        <p className={styles.subheading}>
          {rows.length > 0 ? (
            <>
              {inProgressCount} in progress · {completedCount} completed ·{' '}
              {rows.length} enrolled
            </>
          ) : (
            'Your assigned and enrolled courses live here'
          )}
        </p>
      </div>

      {rows.length > 0 && <StatsStrip summary={gamification} />}

      {rows.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="book" size={32} />
          </div>
          <p className={styles.emptyText}>You're not enrolled in any courses yet.</p>
          <p className={styles.emptySubtext}>
            Browse the catalog to find a course and start learning.
          </p>
          <Link href="/learn/catalog" className={styles.emptyCta}>
            Browse catalog
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      )}

      {resume && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Continue learning</h2>
          <ResumeCard course={resume.course} enrollment={resume.enrollment} />
        </section>
      )}

      {dueSoon.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Due soon</h2>
          <div className={styles.grid}>
            {dueSoon.map(({ enrollment, course }) => (
              <CourseCard
                key={enrollment.id}
                course={course}
                enrollment={enrollment}
                action={(enrollment.progressPercent ?? 0) > 0 ? 'continue' : 'start'}
                showDue
              />
            ))}
          </div>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>In progress</h2>
          <div className={styles.grid}>
            {inProgress.map(({ enrollment, course }) => (
              <CourseCard
                key={enrollment.id}
                course={course}
                enrollment={enrollment}
                action={(enrollment.progressPercent ?? 0) > 0 ? 'continue' : 'start'}
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
    </div>
  )
}

function StatsStrip({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getGamificationSummary>>
}) {
  const earned = new Set(summary.earnedBadgeKeys)
  const earnedCount = earned.size

  return (
    <section className={styles.statsStrip} aria-label="Your learning stats">
      <div className={styles.statBlock}>
        <span className={styles.statIcon} data-flame={summary.currentStreakDays > 0 ? 'on' : undefined}>
          <Icon name="target" size={18} />
        </span>
        <div className={styles.statText}>
          <span className={styles.statValue}>{summary.currentStreakDays}</span>
          <span className={styles.statLabel}>
            day streak{summary.currentStreakDays === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className={styles.statDivider} aria-hidden="true" />

      <div className={styles.statBlock}>
        <span className={styles.statIcon}>
          <Icon name="star" size={18} />
        </span>
        <div className={styles.statText}>
          <span className={styles.statValue}>{summary.points.toLocaleString()}</span>
          <span className={styles.statLabel}>points</span>
        </div>
      </div>

      <div className={styles.statDivider} aria-hidden="true" />

      <div className={styles.badgesBlock}>
        <span className={styles.badgesHeading}>
          Badges <span className={styles.badgesCount}>{earnedCount}/{BADGES.length}</span>
        </span>
        <ul className={styles.badgeList}>
          {BADGES.map(badge => {
            const unlocked = earned.has(badge.key)
            return (
              <li
                key={badge.key}
                className={`${styles.badge} ${unlocked ? styles.badgeUnlocked : styles.badgeLocked}`}
                title={`${badge.label} — ${badge.description}${unlocked ? '' : ' (locked)'}`}
              >
                <Icon name={unlocked ? badge.icon : 'lock'} size={16} />
                <span className={styles.badgeLabel}>{badge.label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className={styles.ringTrack}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className={styles.ringFill}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={styles.ringLabel}>{Math.round(value)}%</span>
    </div>
  )
}

function ResumeCard({
  course,
  enrollment,
}: {
  course: CourseRow['course']
  enrollment: CourseRow['enrollment']
}) {
  const progress = Math.round(enrollment.progressPercent ?? 0)
  const href = lessonHref(course, enrollment)
  const due = enrollment.dueAt ? relativeDue(enrollment.dueAt) : null

  return (
    <Link href={href} className={styles.resumeCard}>
      <div className={styles.resumeMain}>
        <div className={styles.resumeMeta}>
          <span className={styles.difficulty}>
            {difficultyLabel[course.difficultyLevel] ?? course.difficultyLevel}
          </span>
          {course.estimatedMinutes ? (
            <span className={styles.duration}>{Math.round(course.estimatedMinutes / 60)}h</span>
          ) : null}
          {due && (
            <span className={`${styles.dueBadge} ${styles[`due_${due.tone}`]}`}>{due.label}</span>
          )}
        </div>
        <h3 className={styles.resumeTitle}>{course.title}</h3>
        {course.description && <p className={styles.resumeDescription}>{course.description}</p>}
        <span className={styles.resumeCta}>
          {progress > 0 ? 'Continue where you left off' : 'Start course'}
          <Icon name="arrowRight" size={16} />
        </span>
      </div>
      <div className={styles.resumeRing}>
        <ProgressRing value={progress} size={72} />
      </div>
    </Link>
  )
}

function CourseCard({
  course,
  enrollment,
  action,
  showDue = false,
}: {
  course: CourseRow['course']
  enrollment: CourseRow['enrollment']
  action: 'start' | 'continue' | 'review'
  showDue?: boolean
}) {
  const progress = Math.round(enrollment.progressPercent ?? 0)
  const href = action === 'continue' ? lessonHref(course, enrollment) : `/learn/${course.id}`
  const due = showDue && enrollment.dueAt ? relativeDue(enrollment.dueAt) : null

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
        {due && (
          <span className={`${styles.dueBadge} ${styles[`due_${due.tone}`]}`}>{due.label}</span>
        )}
        {course.description && <p className={styles.cardDescription}>{course.description}</p>}
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
