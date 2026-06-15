import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, lessons } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { CatalogBrowser, type CatalogItem } from './CatalogBrowser'
import styles from './page.module.css'

async function getCatalog(organizationId: string, userId: string): Promise<CatalogItem[]> {
  const published = await db
    .select()
    .from(courses)
    .where(and(eq(courses.organizationId, organizationId), eq(courses.status, 'published')))

  const courseIds = published.map(c => c.id)

  const enrolled = await db
    .select({ courseId: enrollments.courseId, progressPercent: enrollments.progressPercent })
    .from(enrollments)
    .where(eq(enrollments.userId, userId))

  const enrolledMap = new Map(enrolled.map(e => [e.courseId, e.progressPercent ?? 0]))

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
    id: course.id,
    title: course.title,
    description: course.description,
    difficultyLevel: course.difficultyLevel,
    courseType: course.courseType,
    estimatedMinutes: course.estimatedMinutes,
    certificateEnabled: course.certificateEnabled ?? false,
    lessonCount: lessonCounts.get(course.id) ?? 0,
    enrolled: enrolledMap.has(course.id),
    progressPercent: enrolledMap.get(course.id) ?? 0,
  }))
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

      <CatalogBrowser items={items} />
    </div>
  )
}
