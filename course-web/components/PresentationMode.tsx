'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { LessonContent } from '@/lib/ai/types'
import { Icon } from '@/components/Icon'
import { LessonSlide } from '@/components/LessonSlide'
import styles from './PresentationMode.module.css'

interface PresentationLesson {
  moduleTitle: string
  moduleNum: number
  lessonTitle: string
  lessonNum: number
  totalInModule: number
  content: LessonContent
}

interface PresentationModule {
  title: string
  position: number
  lessons: Array<{ title: string; content: LessonContent | null }>
}

interface Props {
  courseTitle: string
  modules: PresentationModule[]
  onClose: () => void
}

function buildSlides(modules: PresentationModule[]): PresentationLesson[] {
  const slides: PresentationLesson[] = []
  modules.forEach((mod, mIdx) => {
    const withContent = mod.lessons.filter(l => l.content !== null)
    withContent.forEach((lesson, lIdx) => {
      slides.push({
        moduleTitle: mod.title,
        moduleNum: mIdx + 1,
        lessonTitle: lesson.title,
        lessonNum: lIdx + 1,
        totalInModule: withContent.length,
        content: lesson.content as LessonContent,
      })
    })
  })
  return slides
}

export function PresentationMode({ courseTitle, modules, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)

  const slides = useMemo(() => buildSlides(modules), [modules])
  const slide = slides[idx]

  const next = useCallback(() => {
    setIdx(i => (i < slides.length - 1 ? i + 1 : i))
  }, [slides.length])

  const prev = useCallback(() => {
    setIdx(i => (i > 0 ? i - 1 : i))
  }, [])

  const close = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    onClose()
  }, [onClose])

  // Enter fullscreen on the presentation container when it mounts; the browser
  // requires the call to originate from a user gesture, so this runs from the
  // click that mounted the component (still within the gesture window).
  useEffect(() => {
    const el = containerRef.current
    if (el && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  // Native fullscreen exit (Esc / browser chrome) must also tear down the overlay.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) onClose()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, close])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const wake = () => {
      setControlsVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setControlsVisible(false), 2600)
    }
    window.addEventListener('mousemove', wake)
    wake()
    return () => {
      window.removeEventListener('mousemove', wake)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div ref={containerRef} className={styles.overlay}>
      <div className={`${styles.header} ${controlsVisible ? '' : styles.controlHidden}`}>
        <button className={styles.exitBtn} onClick={close} title="Exit presentation">
          <Icon name="minimize" size={15} />
        </button>

        <div className={styles.logo}>
          <span className={styles.logoDot} />
          <span className={styles.logoText}>
            course<span className={styles.logoAccent}>neo</span>
          </span>
        </div>

        <span className={styles.counter}>
          {slides.length === 0 ? '0 / 0' : `${idx + 1} / ${slides.length}`}
        </span>
      </div>

      <div className={styles.stage}>
        {slide ? (
          <div className={styles.slide}>
            <LessonSlide
              content={slide.content}
              lessonTitle={slide.lessonTitle}
              moduleTitle={slide.moduleTitle}
              chapterNum={slide.moduleNum}
            />
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No generated lesson content to present yet.</p>
            <p className={styles.emptySub}>{courseTitle}</p>
          </div>
        )}
      </div>

      <div className={`${styles.footer} ${controlsVisible ? '' : styles.controlHidden}`}>
        <span className={styles.escHint}>Press Esc to exit</span>
        <div className={styles.navControls}>
          <button
            className={styles.navBtn}
            onClick={prev}
            disabled={idx === 0}
            title="Previous slide"
          >
            <Icon name="arrowLeft" size={16} />
          </button>
          <button
            className={styles.navBtn}
            onClick={next}
            disabled={slides.length === 0 || idx === slides.length - 1}
            title="Next slide"
          >
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
