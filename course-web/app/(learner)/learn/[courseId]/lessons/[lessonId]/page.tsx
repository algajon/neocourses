'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { LessonSlide } from '@/components/LessonSlide'
import { FitSlide } from '@/components/FitSlide'
import type { LessonContent } from '@/lib/ai/types'
import styles from './page.module.css'

interface LessonData {
  id: string
  title: string
  moduleTitle: string
  moduleNumber: number
  lessonNumber: number
  totalLessons: number
  prevLessonId: string | null
  nextLessonId: string | null
  nextIsQuiz: boolean
  quizModuleId: string | null
  courseId: string
  content: LessonContent | null
}

interface PageProps {
  params: { courseId: string; lessonId: string }
}

export default function LessonPage({ params }: PageProps) {
  const router = useRouter()
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/lessons/${params.lessonId}?courseId=${params.courseId}`)
      .then(r => r.json())
      .then((data: LessonData) => {
        setLesson(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.lessonId, params.courseId])

  const handleNext = useCallback(async () => {
    if (!lesson) return
    setMarking(true)
    try {
      await fetch('/api/progress/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, courseId: lesson.courseId }),
      })
    } catch {}

    if (lesson.nextIsQuiz && lesson.quizModuleId) {
      router.push(`/learn/${lesson.courseId}/quiz/${lesson.quizModuleId}`)
    } else if (lesson.nextLessonId) {
      router.push(`/learn/${lesson.courseId}/lessons/${lesson.nextLessonId}`)
    } else {
      router.push(`/learn/${lesson.courseId}`)
    }
    setMarking(false)
  }, [lesson, router])

  if (loading) return <LessonSkeleton />

  if (!lesson) {
    return (
      <div className={styles.error}>
        <p>Lesson not found.</p>
        <Link href={`/learn/${params.courseId}`} className={styles.backLink}>Back to course</Link>
      </div>
    )
  }

  const content = lesson.content

  return (
    <div className={styles.shell}>
      <div className={styles.slide}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Link href={`/learn/${lesson.courseId}`} className={styles.backBtn}><Icon name="arrowLeft" size={15} /> Course</Link>
            <span className={styles.moduleLabel}>{lesson.moduleTitle}</span>
          </div>
          <div className={styles.lessonNum}>
            {lesson.lessonNumber} / {lesson.totalLessons}
          </div>
        </header>

        <div className={styles.body}>
          {content ? (
            <FitSlide>
              <LessonSlide
                content={content}
                lessonTitle={lesson.title}
                moduleTitle={lesson.moduleTitle}
                chapterNum={lesson.moduleNumber}
              />
            </FitSlide>
          ) : (
            <>
              <h1 className={styles.lessonTitle}>{lesson.title}</h1>
              <p className={styles.intro}>Content is being generated. Please check back soon.</p>
            </>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            {lesson.prevLessonId ? (
              <Link
                href={`/learn/${lesson.courseId}/lessons/${lesson.prevLessonId}`}
                className={styles.navBtn}
              >
                <Icon name="arrowLeft" size={15} /> Previous
              </Link>
            ) : (
              <span />
            )}
          </div>

          <div className={styles.progressDots}>
            {Array.from({ length: Math.min(lesson.totalLessons, 9) }).map((_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i + 1 === lesson.lessonNumber ? styles.dotActive : i + 1 < lesson.lessonNumber ? styles.dotDone : ''}`}
              />
            ))}
            {lesson.totalLessons > 9 && <span className={styles.dotMore}>…</span>}
          </div>

          <div className={styles.footerRight}>
            <button
              onClick={handleNext}
              disabled={marking}
              className={styles.navBtnPrimary}
            >
              {marking ? (
                'Saving…'
              ) : lesson.nextIsQuiz ? (
                <>Take Chapter Quiz <Icon name="arrowRight" size={15} /></>
              ) : lesson.nextLessonId ? (
                <>Next <Icon name="arrowRight" size={15} /></>
              ) : (
                <>Complete Course <Icon name="check" size={15} /></>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function LessonSkeleton() {
  return (
    <div className={styles.shell}>
      <div className={styles.slide}>
        <div className={styles.skeleton}>
          <div className={`${styles.skLine} ${styles.skShort}`} />
          <div className={`${styles.skLine} ${styles.skLong}`} />
          <div className={`${styles.skLine} ${styles.skMed}`} />
          <div className={styles.skGrid}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.skCard} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
