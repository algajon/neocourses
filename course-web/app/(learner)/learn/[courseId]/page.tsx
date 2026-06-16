import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Icon } from '@/components/Icon'
import { EnrollButton } from '@/components/EnrollButton'
import { priceModelOf, pricingLabel, formatPrice, hasFullAccess } from '@/lib/pricing'
import { courseGradient } from '@/lib/gradient'
import styles from './page.module.css'

interface PageProps {
  params: { courseId: string }
}

async function getCourseData(courseId: string, userId: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course) return null

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId)))
    .limit(1)

  const moduleList = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(lessons.position)

  // lessons.position is per-module, so a global sort needs module order first.
  const modOrder = new Map(moduleList.map((m, i) => [m.id, i]))
  const lessonList = [...lessonRows].sort(
    (a, b) =>
      (modOrder.get(a.moduleId) ?? 0) - (modOrder.get(b.moduleId) ?? 0) ||
      a.position - b.position,
  )

  const completedLessons = enrollment
    ? await db
        .select({ lessonId: lessonProgress.lessonId })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollment.id),
            eq(lessonProgress.userId, userId),
          ),
        )
    : []

  const completedSet = new Set(completedLessons.map(lp => lp.lessonId))

  return { course, enrollment, moduleList, lessonList, completedSet }
}

export default async function CourseOverviewPage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const data = await getCourseData(params.courseId, session.user.id)
  if (!data) notFound()

  const { course, enrollment, moduleList, lessonList, completedSet } = data

  const allLessonIds = lessonList.map(l => l.id)
  const totalLessons = allLessonIds.length
  const completedCount = allLessonIds.filter(id => completedSet.has(id)).length
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  const firstIncompleteLessonId = lessonList.find(l => !completedSet.has(l.id))?.id

  const difficultyLabel: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  }

  const model = priceModelOf(course)
  const priceText = formatPrice(course.priceCents)
  const isEnrolled = !!enrollment
  const hasAccess = hasFullAccess(course, enrollment)

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.breadcrumb}>
            <Link href="/learn" className={styles.breadcrumbLink}>My Learning</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{course.title}</span>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.heroLeft}>
              <div
                className={styles.banner}
                style={
                  course.thumbnailUrl
                    ? { backgroundImage: `url(${course.thumbnailUrl})` }
                    : { backgroundImage: courseGradient(course.id) }
                }
                role="img"
                aria-label={`${course.title} cover`}
              >
                <span
                  className={`${styles.bannerPrice} ${model === 'free' ? styles.bannerPriceFree : ''}`}
                >
                  {pricingLabel(course)}
                </span>
              </div>
              <div className={styles.tags}>
                <span className={styles.tag}>{difficultyLabel[course.difficultyLevel] ?? course.difficultyLevel}</span>
                <span className={styles.tag}>{course.courseType}</span>
                {course.estimatedMinutes && (
                  <span className={styles.tagNeutral}>{Math.round(course.estimatedMinutes / 60)}h estimated</span>
                )}
              </div>
              <h1 className={styles.title}>{course.title}</h1>
              {course.description && (
                <p className={styles.description}>{course.description}</p>
              )}
            </div>

            <div className={styles.heroRight}>
              {!isEnrolled ? (
                <div className={styles.enrollCard}>
                  <div className={styles.priceRow}>
                    <span className={styles.priceValue}>
                      {model === 'free' ? 'Free' : priceText}
                    </span>
                    <span className={styles.priceModel}>{pricingLabel(course)}</span>
                  </div>

                  {model === 'paid' ? (
                    <>
                      <EnrollButton
                        courseId={course.id}
                        action="purchase"
                        priceLabel={priceText}
                        courseTitle={course.title}
                        className={styles.ctaBtn}
                      />
                      <p className={styles.enrollNote}>
                        Purchase to enroll and unlock every chapter.
                      </p>
                    </>
                  ) : model === 'first_chapter_free' ? (
                    <>
                      <EnrollButton
                        courseId={course.id}
                        action="start-free"
                        courseTitle={course.title}
                        className={styles.ctaBtn}
                      />
                      <p className={styles.enrollNote}>
                        Chapters 2+ unlock for {priceText}.
                      </p>
                    </>
                  ) : (
                    <>
                      <EnrollButton
                        courseId={course.id}
                        action="enroll"
                        className={styles.ctaBtn}
                      />
                      <p className={styles.enrollNote}>Enroll free to start learning.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.progressCard}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressLabel}>Your progress</span>
                    <span className={styles.progressPct}>{progressPct}%</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className={styles.progressSub}>{completedCount} of {totalLessons} lessons</p>

                  {firstIncompleteLessonId ? (
                    <Link
                      href={`/learn/${course.id}/lessons/${firstIncompleteLessonId}`}
                      className={styles.ctaBtn}
                    >
                      Continue Learning
                    </Link>
                  ) : (
                    <Link href={`/learn/${course.id}/certificate`} className={styles.ctaBtn}>
                      View Certificate
                    </Link>
                  )}

                  {!hasAccess && (
                    <>
                      <EnrollButton
                        courseId={course.id}
                        action="unlock"
                        priceLabel={priceText}
                        courseTitle={course.title}
                        className={styles.unlockBtn}
                      />
                      <p className={styles.progressSub}>
                        Chapters 2+ are locked. Unlock the full course for {priceText}.
                      </p>
                    </>
                  )}

                  <Link href={`/learn/${course.id}/flashcards`} className={styles.flashcardsLink}>
                    <Icon name="book" size={15} /> Flashcards
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.contentInner}>
          <h2 className={styles.roadmapTitle}>Course Roadmap</h2>
          <div className={styles.roadmap}>
            {moduleList.map((mod, modIdx) => {
              const modLessons = lessonList.filter(l => l.moduleId === mod.id)
              const allModLessonsCompleted = modLessons.every(l => completedSet.has(l.id))

              const globalLessonsBefore = lessonList.filter(l => {
                const lessonModIdx = moduleList.findIndex(m => m.id === l.moduleId)
                if (lessonModIdx < modIdx) return true
                if (lessonModIdx === modIdx) {
                  const pos = modLessons.findIndex(ml => ml.id === l.id)
                  return false
                }
                return false
              })

              return (
                <div key={mod.id} className={styles.moduleItem}>
                  <div className={styles.moduleHeader}>
                    <div className={`${styles.moduleStatus} ${allModLessonsCompleted ? styles.moduleStatusDone : ''}`}>
                      {allModLessonsCompleted ? <Icon name="check" size={16} /> : modIdx + 1}
                    </div>
                    <div className={styles.moduleInfo}>
                      <h3 className={styles.moduleTitle}>{mod.title}</h3>
                      {mod.description && (
                        <p className={styles.moduleDescription}>{mod.description}</p>
                      )}
                    </div>
                    <span className={styles.moduleMeta}>
                      {modLessons.filter(l => completedSet.has(l.id)).length}/{modLessons.length} lessons
                    </span>
                  </div>

                  <div className={styles.lessonList}>
                    {modLessons.map((lesson, lessonIdx) => {
                      const globalIdx = lessonList.findIndex(l => l.id === lesson.id)
                      const prevLesson = globalIdx > 0 ? lessonList[globalIdx - 1] : null
                      const isUnlocked = globalIdx === 0 || (prevLesson ? completedSet.has(prevLesson.id) : false)
                      const isDone = completedSet.has(lesson.id)

                      return (
                        <div
                          key={lesson.id}
                          className={`${styles.lessonItem} ${!isUnlocked ? styles.lessonLocked : ''} ${isDone ? styles.lessonDone : ''}`}
                        >
                          <div className={styles.lessonIcon}>
                            {isDone ? <Icon name="check" size={16} /> : !isUnlocked ? <Icon name="lock" size={16} /> : <Icon name="play" size={16} />}
                          </div>
                          <div className={styles.lessonMeta}>
                            {isUnlocked ? (
                              <Link
                                href={`/learn/${course.id}/lessons/${lesson.id}`}
                                className={styles.lessonTitle}
                              >
                                {lesson.title}
                              </Link>
                            ) : (
                              <span className={styles.lessonTitleLocked}>{lesson.title}</span>
                            )}
                            {lesson.estimatedMinutes && (
                              <span className={styles.lessonDuration}>{lesson.estimatedMinutes} min</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
