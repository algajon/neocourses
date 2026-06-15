'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import styles from './OnboardingTour.module.css'

interface Step {
  title: string
  body: string
  icon: IconName
  illustration: ReactNode
}

// Inline SVGs draw with currentColor and animate via .module.css keyframes keyed off
// the data-active step class, so they re-trigger their entrance on each transition.
function CourseIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" className={styles.art}>
      <rect className={styles.artDraw} x="20" y="14" width="80" height="52" rx="6" stroke="currentColor" strokeWidth="2.5" />
      <line className={styles.artDraw} x1="20" y1="30" x2="100" y2="30" stroke="currentColor" strokeWidth="2.5" />
      <line className={styles.artLine} x1="32" y1="42" x2="74" y2="42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line className={styles.artLine} x1="32" y1="52" x2="60" y2="52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle className={styles.artPop} cx="86" cy="49" r="7" stroke="currentColor" strokeWidth="2.5" />
      <line className={styles.artPop} x1="86" y1="46" x2="86" y2="52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line className={styles.artPop} x1="83" y1="49" x2="89" y2="49" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function GenerateIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" className={styles.art}>
      <rect className={styles.artDraw} x="18" y="20" width="40" height="48" rx="5" stroke="currentColor" strokeWidth="2.5" />
      <line className={styles.artLine} x1="26" y1="32" x2="50" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line className={styles.artLine} x1="26" y1="42" x2="50" y2="42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line className={styles.artLine} x1="26" y1="52" x2="42" y2="52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path className={styles.artLine} d="M62 44h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path className={styles.artLine} d="M72 38l8 6-8 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <g className={styles.artFloat}>
        <path d="M96 16l2.4 6.4L105 25l-6.6 2.6L96 34l-2.4-6.4L87 25l6.6-2.6L96 16z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M104 40l1.4 3.8L109 45l-3.6 1.4L104 50l-1.4-3.8L99 45l3.6-1.4L104 40z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function PublishIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" className={styles.art}>
      <rect className={styles.artDraw} x="24" y="16" width="72" height="48" rx="6" stroke="currentColor" strokeWidth="2.5" />
      <line className={styles.artLine} x1="34" y1="30" x2="74" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line className={styles.artLine} x1="34" y1="40" x2="64" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle className={styles.artPop} cx="86" cy="54" r="14" stroke="currentColor" strokeWidth="2.5" />
      <path className={styles.artCheck} d="M80 54l5 5 9-10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CatalogIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" className={styles.art}>
      <rect className={styles.artDraw} x="16" y="22" width="26" height="34" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <rect className={styles.artFloat} x="47" y="22" width="26" height="34" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <rect className={styles.artDraw} x="78" y="22" width="26" height="34" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <circle className={styles.artPop} cx="88" cy="50" r="11" stroke="currentColor" strokeWidth="2.5" />
      <line className={styles.artPop} x1="96" y1="58" x2="104" y2="66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function PaceIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" className={styles.art}>
      <path className={styles.artLine} d="M24 60h72" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle className={styles.artPop} cx="32" cy="60" r="6" stroke="currentColor" strokeWidth="2.5" />
      <path className={styles.artCheck} d="M29 60l2.5 2.5L35 58" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className={styles.artPop} cx="60" cy="60" r="6" stroke="currentColor" strokeWidth="2.5" />
      <circle className={styles.artDraw} cx="88" cy="60" r="6" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3" />
      <g className={styles.artFloat}>
        <rect x="50" y="22" width="20" height="22" rx="3" stroke="currentColor" strokeWidth="2.5" />
        <line x1="56" y1="30" x2="64" y2="30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="56" y1="36" x2="64" y2="36" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function CertificateIllustration() {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" className={styles.art}>
      <circle className={styles.artDraw} cx="60" cy="34" r="20" stroke="currentColor" strokeWidth="2.5" />
      <path className={styles.artCheck} d="M52 34l5 5 11-12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path className={styles.artPop} d="M50 52l-5 18 15-8 15 8-5-18" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

const CREATE_STEPS: Step[] = [
  {
    title: 'Create a course',
    body: 'Start from Courses → New Course. Give it a title and pick a type to get going.',
    icon: 'folder',
    illustration: <CourseIllustration />,
  },
  {
    title: 'Add materials & generate',
    body: 'Upload PDFs or text, then let the AI generate lessons, quizzes, and a checklist from your sources.',
    icon: 'sparkles',
    illustration: <GenerateIllustration />,
  },
  {
    title: 'Review & publish',
    body: 'Edit the outline and lessons, preview as a learner, then publish so trainees can enroll.',
    icon: 'eye',
    illustration: <PublishIllustration />,
  },
]

const LEARN_STEPS: Step[] = [
  {
    title: 'Browse the catalog',
    body: 'Find courses in the Catalog and enroll in the one you want to take.',
    icon: 'book',
    illustration: <CatalogIllustration />,
  },
  {
    title: 'Learn at your pace',
    body: 'Work through lessons module by module — lessons unlock as you complete them.',
    icon: 'map',
    illustration: <PaceIllustration />,
  },
  {
    title: 'Pass quizzes & earn certificates',
    body: 'Pass each chapter quiz to advance, and earn a certificate when you finish.',
    icon: 'certificate',
    illustration: <CertificateIllustration />,
  },
]

function storageKey(role: string) {
  const group = role === 'learner' ? 'learner' : 'creator'
  return `courseneo-onboarded-v1-${group}`
}

export function OnboardingTour({ role }: { role: string }) {
  const isLearner = role === 'learner'
  const steps = isLearner ? LEARN_STEPS : CREATE_STEPS
  const key = storageKey(role)

  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    try {
      if (!window.localStorage.getItem(key)) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [key])

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(key, '1')
    } catch {
      /* ignore unavailable storage */
    }
    setOpen(false)
  }, [key])

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        dismiss()
        return i
      }
      return i + 1
    })
  }, [steps.length, dismiss])

  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!open) return
    cardRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss, goNext, goBack])

  if (!mounted || !open) return null

  const step = steps[index]
  const isLast = index === steps.length - 1
  const labelId = 'onboarding-title'

  return (
    <div className={styles.backdrop} onClick={dismiss}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label="Getting started tour"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Skip tour">
          <Icon name="x" size={18} />
        </button>

        <div className={styles.illustrationWrap} key={`art-${index}`}>
          <div className={styles.illustrationGlow} aria-hidden="true" />
          {step.illustration}
        </div>

        <div className={styles.body} key={`body-${index}`}>
          <span className={styles.badge}>
            <Icon name={step.icon} size={14} />
            Step {index + 1} of {steps.length}
          </span>
          <h2 id={labelId} className={styles.title}>
            {step.title}
          </h2>
          <p className={styles.text}>{step.body}</p>
        </div>

        <div className={styles.dots} role="tablist" aria-label="Tour steps">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.skip}
            onClick={dismiss}
          >
            Skip
          </button>
          <div className={styles.nav}>
            {index > 0 && (
              <button type="button" className={styles.secondary} onClick={goBack}>
                <Icon name="arrowLeft" size={16} />
                Back
              </button>
            )}
            <button type="button" className={styles.primary} onClick={goNext}>
              {isLast ? (isLearner ? 'Get started' : 'Finish') : 'Next'}
              {!isLast && <Icon name="arrowRight" size={16} />}
              {isLast && <Icon name="check" size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
