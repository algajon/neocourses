import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, count, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, modules, lessons, enrollments, sourceMaterials } from '@/lib/db/schema'
import { Icon } from '@/components/Icon'
import { DeleteCourseButton } from '../DeleteCourseButton'
import { EditCourseDescription } from '../EditCourseDescription'
import styles from './page.module.css'

const STATUS_PILL: Record<string, string> = {
  draft: 'pill pill-draft',
  processing: 'pill pill-info',
  ready: 'pill pill-warning',
  published: 'pill pill-success',
  archived: 'pill pill-draft',
}

type CourseStatus = 'draft' | 'processing' | 'ready' | 'published' | 'archived'

const PROGRESS_STEPS: { key: CourseStatus | string; label: string; href: (id: string) => string }[] = [
  { key: 'upload', label: 'Upload', href: (id) => `/admin/courses/${id}/upload` },
  { key: 'generate', label: 'Generate', href: (id) => `/admin/courses/${id}/generate` },
  { key: 'review', label: 'Review', href: (id) => `/admin/courses/${id}/outline` },
  { key: 'publish', label: 'Publish', href: (id) => `/admin/courses/${id}` },
]

function getActiveStep(status: string): number {
  if (status === 'draft') return 0
  if (status === 'processing') return 1
  if (status === 'ready') return 2
  if (status === 'published' || status === 'archived') return 4
  return 0
}

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CourseOverviewPage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1)

  if (!course) notFound()

  const moduleList = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(modules.position)

  const lessonCountsRaw = await db
    .select({ moduleId: lessons.moduleId, count: count() })
    .from(lessons)
    .where(eq(lessons.courseId, id))
    .groupBy(lessons.moduleId)

  const lessonCounts = Object.fromEntries(lessonCountsRaw.map((r) => [r.moduleId, r.count]))

  const [{ count: enrolledCount }] = await db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.courseId, id))

  const [{ count: materialCount }] = await db
    .select({ count: count() })
    .from(sourceMaterials)
    .where(eq(sourceMaterials.courseId, id))

  const activeStep = getActiveStep(course.status)

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/admin/courses">Courses</Link> / {course.title}
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1>{course.title}</h1>
            <span className={STATUS_PILL[course.status] ?? 'pill pill-draft'}>{course.status}</span>
          </div>
          <div className={styles.meta}>
            {course.courseType && <span className={styles.metaItem}>{course.courseType}</span>}
            {course.difficultyLevel && <span className={styles.metaItem}>{course.difficultyLevel}</span>}
            <span className={styles.metaItem}>{enrolledCount} enrolled</span>
            <span className={styles.metaItem}>Created {formatDate(course.createdAt)}</span>
            {course.publishedAt && <span className={styles.metaItem}>Published {formatDate(course.publishedAt)}</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/admin/courses/${id}/assign`} className="btn-secondary">
            <Icon name="users" size={15} /> Assign learners
          </Link>
          <Link href={`/admin/courses/${id}/analytics`} className="btn-secondary">Analytics</Link>
          {course.status === 'published' ? (
            <Link href={`/admin/courses/${id}/preview`} className="btn-secondary">Preview</Link>
          ) : null}
          {course.status !== 'published' ? (
            <Link href={`/admin/courses/${id}/outline`} className="btn-cta">Edit &amp; Publish</Link>
          ) : (
            <Link href={`/admin/courses/${id}/outline`} className="btn-primary">Edit</Link>
          )}
          <DeleteCourseButton courseId={id} redirectTo="/admin/courses" className="btn-secondary" />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Progress</h2>
        </div>
        <div className={styles.progressSteps}>
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < activeStep
            const isActive = i === activeStep
            return (
              <div key={step.key} style={{ display: 'contents' }}>
                <div className={`${styles.progressStep} ${isDone ? styles.done : ''} ${isActive ? styles.active : ''}`}>
                  <div className={styles.stepCircle}>{isDone ? <Icon name="check" size={15} /> : i + 1}</div>
                  <div className={styles.stepLabel}>
                    {isActive ? (
                      <Link href={step.href(id)} style={{ color: 'inherit', textDecoration: 'none' }}>{step.label}</Link>
                    ) : (
                      step.label
                    )}
                  </div>
                </div>
                {i < PROGRESS_STEPS.length - 1 && (
                  <div className={`${styles.stepLine} ${isDone ? styles.done : ''}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.descriptionBlock}>
        <EditCourseDescription courseId={id} description={course.description} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Quick Actions</h2>
        </div>
        <div className={styles.actionsGrid}>
          <Link href={`/admin/courses/${id}/upload`} className={styles.actionCard}>
            <span className={styles.actionLabel}>Upload Materials</span>
            <span className={styles.actionDesc}>{materialCount} file{materialCount !== 1 ? 's' : ''} uploaded</span>
          </Link>
          <Link href={`/admin/courses/${id}/generate`} className={styles.actionCard}>
            <span className={styles.actionLabel}>Generate AI Content</span>
            <span className={styles.actionDesc}>Create lessons from source files</span>
          </Link>
          <Link href={`/admin/courses/${id}/outline`} className={styles.actionCard}>
            <span className={styles.actionLabel}>Edit Outline</span>
            <span className={styles.actionDesc}>Review and adjust structure</span>
          </Link>
          <Link href={`/admin/courses/${id}/preview`} className={styles.actionCard}>
            <span className={styles.actionLabel}>Preview</span>
            <span className={styles.actionDesc}>See learner view</span>
          </Link>
          <Link href={`/admin/courses/${id}/analytics`} className={styles.actionCard}>
            <span className={styles.actionLabel}>Analytics</span>
            <span className={styles.actionDesc}>{enrolledCount} learner{enrolledCount !== 1 ? 's' : ''} enrolled</span>
          </Link>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Modules</h2>
        </div>
        {moduleList.length === 0 ? (
          <div className={styles.emptyModules}>
            No modules yet. <Link href={`/admin/courses/${id}/generate`}>Generate content</Link> to create modules automatically.
          </div>
        ) : (
          <ul className={styles.moduleList}>
            {moduleList.map((mod, idx) => (
              <li key={mod.id} className={styles.moduleRow}>
                <div>
                  <div className={styles.moduleTitle}>{idx + 1}. {mod.title}</div>
                  <div className={styles.moduleMeta}>{lessonCounts[mod.id] ?? 0} lesson{(lessonCounts[mod.id] ?? 0) !== 1 ? 's' : ''}</div>
                </div>
                <Link href={`/admin/courses/${id}/outline`} className="btn-secondary">View</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
