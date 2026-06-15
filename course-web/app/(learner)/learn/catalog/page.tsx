import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, lessons } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { EnrollButton } from '@/components/EnrollButton'
import styles from './page.module.css'

async function getCatalog(organizationId: string, userId: string) {
  const published = await db
    .select()
    .from(courses)
    .where(and(eq(courses.organizationId, organizationId), eq(courses.status, 'published')))

  const courseIds = published.map(c => c.id)

  const enrolled = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(eq(enrollments.userId, userId))

  const enrolledSet = new Set(enrolled.map(e => e.courseId))

  const lessonCounts = new Map<string, number>()
  if (courseIds.length > 0) {
    const lessonRows = await db
      .select({ courseId: lessons.courseId })
      .from(lessons)
      .where(inArray(lessons.courseId, courseIds))
    for (const row of lessonRows) {
      lessonCounts.set(row.courseId, (lessonCounts.get(row.courseId) ?? 0) + 1)
    }
  }

  return published.map(course => ({
    course,
    enrolled: enrolledSet.has(course.id),
    lessonCount: lessonCounts.get(course.id) ?? 0,
  }))
}

const difficultyLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const typeLabel: Record<string, string> = {
  custom: 'Custom',
  onboarding: 'Onboarding',
  compliance: 'Compliance',
  skills: 'Skills',
}

export default async function CatalogPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }
  if (!session.user.organizationId) {
    redirect('/learn')
  }

  const items = await getCatalog(session.user.organizationId, session.user.id)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Browse &amp; Enroll</span>
        <h1 className={styles.heading}>Course Catalog</h1>
        <p className={styles.subheading}>
          {items.length} published course{items.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {items.length > 0 ? (
        <div className={styles.grid}>
          {items.map(({ course, enrolled, lessonCount }) => (
            <div key={course.id} className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  <span className={styles.pill}>
                    {difficultyLabel[course.difficultyLevel] ?? course.difficultyLevel}
                  </span>
                  <span className={styles.pillMuted}>
                    {typeLabel[course.courseType] ?? course.courseType}
                  </span>
                  {course.estimatedMinutes ? (
                    <span className={styles.duration}>
                      {Math.round(course.estimatedMinutes / 60)}h
                    </span>
                  ) : null}
                </div>
                <h3 className={styles.cardTitle}>{course.title}</h3>
                {course.description && (
                  <p className={styles.cardDescription}>{course.description}</p>
                )}
                <div className={styles.stats}>
                  <span className={styles.stat}>
                    <Icon name="book" size={14} />
                    {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
                  </span>
                  {course.certificateEnabled && (
                    <span className={styles.stat}>
                      <Icon name="certificate" size={14} />
                      Certificate
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.cardFooter}>
                {enrolled ? (
                  <Link href={`/learn/${course.id}`} className={styles.btnPrimary}>
                    Continue
                    <Icon name="arrowRight" size={14} />
                  </Link>
                ) : (
                  <EnrollButton courseId={course.id} className={styles.btnAccent} label="Enroll" />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="book" size={32} />
          </div>
          <p className={styles.emptyText}>No published courses yet.</p>
          <p className={styles.emptySubtext}>
            New courses will appear here once your team publishes them.
          </p>
        </div>
      )}
    </div>
  )
}
