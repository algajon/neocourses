import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, sql, count, and, ilike } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, modules, lessons, enrollments } from '@/lib/db/schema'
import { Icon } from '@/components/Icon'
import { StatusFilter } from './StatusFilter'
import { CourseSearch } from './CourseSearch'
import { DeleteCourseButton } from './DeleteCourseButton'
import styles from './page.module.css'

const STATUS_PILL: Record<string, string> = {
  draft: 'pill pill-draft',
  processing: 'pill pill-info',
  ready: 'pill pill-warning',
  published: 'pill pill-success',
  archived: 'pill pill-draft',
}

const STATUSES = ['draft', 'processing', 'ready', 'published', 'archived']

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

interface PageProps {
  searchParams?: Promise<{ status?: string; q?: string }>
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const params = await searchParams
  const statusFilter = params?.status
  const query = params?.q?.trim()

  const orgId = session.user.organizationId

  const filters = [
    orgId ? eq(courses.organizationId, orgId) : undefined,
    statusFilter ? eq(courses.status, statusFilter) : undefined,
    query ? ilike(courses.title, `%${query}%`) : undefined,
  ].filter(Boolean)

  const whereClause = filters.length ? and(...(filters as NonNullable<(typeof filters)[number]>[])) : sql`1=1`

  const courseList = await db
    .select()
    .from(courses)
    .where(whereClause)
    .orderBy(sql`${courses.updatedAt} desc`)

  const [moduleCountsRaw, lessonCountsRaw, enrollmentCountsRaw] = await Promise.all([
    db.select({ courseId: modules.courseId, count: count() }).from(modules).groupBy(modules.courseId),
    db.select({ courseId: lessons.courseId, count: count() }).from(lessons).groupBy(lessons.courseId),
    db
      .select({ courseId: enrollments.courseId, count: count() })
      .from(enrollments)
      .groupBy(enrollments.courseId),
  ])

  const moduleCounts = Object.fromEntries(moduleCountsRaw.map((r) => [r.courseId, r.count]))
  const lessonCounts = Object.fromEntries(lessonCountsRaw.map((r) => [r.courseId, r.count]))
  const enrollmentCounts = Object.fromEntries(enrollmentCountsRaw.map((r) => [r.courseId, r.count]))

  const isFiltered = Boolean(statusFilter || query)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumb}>Admin</div>
          <h1>Courses</h1>
        </div>
        <Link href="/admin/courses/new" className="btn-cta">
          <Icon name="sparkles" size={15} /> New course
        </Link>
      </div>

      <div className={styles.filterBar}>
        <StatusFilter statuses={STATUSES} current={statusFilter} query={query} className={styles.tabs} />
        <CourseSearch
          className={styles.searchWrap}
          inputClassName={styles.searchInput}
          defaultValue={query ?? ''}
        />
      </div>

      <div className={styles.resultMeta}>
        {courseList.length} course{courseList.length !== 1 ? 's' : ''}
        {query ? ` matching “${query}”` : ''}
      </div>

      <div className={styles.grid}>
        {courseList.length === 0 ? (
          isFiltered ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Icon name="search" size={22} />
              </div>
              <p>No courses match your filters.</p>
              <Link href="/admin/courses" className="btn-secondary">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Icon name="book" size={22} />
              </div>
              <p>No courses yet. Build one from your source material to get started.</p>
              <Link href="/admin/courses/new" className="btn-cta">
                <Icon name="sparkles" size={15} /> Create your first course
              </Link>
            </div>
          )
        ) : (
          courseList.map((course) => (
            <div key={course.id} className={styles.courseCard}>
              <div className={styles.cardTop}>
                <div className={styles.courseTitle}>{course.title}</div>
                <span className={STATUS_PILL[course.status] ?? 'pill pill-draft'}>{course.status}</span>
              </div>
              <div className={styles.courseMeta}>
                <span className={styles.metaItem}>
                  <Icon name="book" size={13} /> {moduleCounts[course.id] ?? 0} modules
                </span>
                <span className={styles.metaItem}>
                  <Icon name="file" size={13} /> {lessonCounts[course.id] ?? 0} lessons
                </span>
                <span className={styles.metaItem}>
                  <Icon name="users" size={13} /> {enrollmentCounts[course.id] ?? 0} enrolled
                </span>
              </div>
              <div className={styles.updatedAt}>Updated {formatDate(course.updatedAt)}</div>
              <div className={styles.cardActions}>
                <Link href={`/admin/courses/${course.id}`} className="btn-secondary">
                  Edit
                </Link>
                <Link href={`/admin/courses/${course.id}/analytics`} className="btn-secondary">
                  Analytics
                </Link>
                <DeleteCourseButton courseId={course.id} className={styles.deleteBtn} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
