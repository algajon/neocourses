import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, sql, count } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, modules, enrollments } from '@/lib/db/schema'
import { StatusFilter } from './StatusFilter'
import { DeleteCourseButton } from './DeleteCourseButton'
import styles from './page.module.css'

const STATUS_PILL: Record<string, string> = {
  draft: 'pill pill-draft',
  processing: 'pill pill-info',
  ready: 'pill pill-warning',
  published: 'pill pill-success',
  archived: 'pill pill-draft',
}

interface PageProps {
  searchParams?: Promise<{ status?: string }>
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams
  const statusFilter = params?.status

  const orgId = session.user.organizationId

  const whereClause = orgId
    ? statusFilter
      ? sql`${courses.organizationId} = ${orgId} AND ${courses.status} = ${statusFilter}`
      : eq(courses.organizationId, orgId)
    : statusFilter
      ? eq(courses.status, statusFilter)
      : sql`1=1`

  const courseList = await db
    .select()
    .from(courses)
    .where(whereClause)
    .orderBy(sql`${courses.createdAt} desc`)

  const moduleCountsRaw = await db
    .select({ courseId: modules.courseId, count: count() })
    .from(modules)
    .groupBy(modules.courseId)

  const enrollmentCountsRaw = await db
    .select({ courseId: enrollments.courseId, count: count() })
    .from(enrollments)
    .groupBy(enrollments.courseId)

  const moduleCounts = Object.fromEntries(moduleCountsRaw.map((r) => [r.courseId, r.count]))
  const enrollmentCounts = Object.fromEntries(enrollmentCountsRaw.map((r) => [r.courseId, r.count]))

  const STATUSES = ['draft', 'processing', 'ready', 'published', 'archived']

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumb}>Admin</div>
          <h1>Courses</h1>
        </div>
        <Link href="/admin/courses/new" className="btn-cta">+ New Course</Link>
      </div>

      <div className={styles.filterBar}>
        <StatusFilter statuses={STATUSES} current={statusFilter} className={styles.statusFilter} />
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          {courseList.length} course{courseList.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.grid}>
        {courseList.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No courses found{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>
            <Link href="/admin/courses/new" className="btn-cta">Create your first course</Link>
          </div>
        ) : (
          courseList.map((course) => (
            <div key={course.id} className={styles.courseCard}>
              <div className={styles.cardTop}>
                <div className={styles.courseTitle}>{course.title}</div>
                <span className={STATUS_PILL[course.status] ?? 'pill pill-draft'}>{course.status}</span>
              </div>
              <div className={styles.courseMeta}>
                <span className={styles.metaItem}>{moduleCounts[course.id] ?? 0} modules</span>
                <span className={styles.metaItem}>{enrollmentCounts[course.id] ?? 0} enrolled</span>
              </div>
              <div className={styles.cardActions}>
                <Link href={`/admin/courses/${course.id}`} className="btn-secondary">Edit</Link>
                <Link href={`/admin/courses/${course.id}/analytics`} className="btn-secondary">Analytics</Link>
                <DeleteCourseButton courseId={course.id} className={styles.deleteBtn} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
