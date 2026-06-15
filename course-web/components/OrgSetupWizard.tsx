'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/Icon'
import styles from './OrgSetupWizard.module.css'

interface WizardStep {
  title: string
  body: string
  href: string
  cta: string
  icon: IconName
  done: boolean
}

export interface OrgSetupWizardProps {
  hasCourse: boolean
  hasTeamMember: boolean
  hasPublishedCourse: boolean
  // Link target for "Generate & publish" — a real course when one exists, else the courses list.
  generateHref: string
}

const STORAGE_KEY = 'courseneo-org-setup-skipped-v1'

export function OrgSetupWizard({
  hasCourse,
  hasTeamMember,
  hasPublishedCourse,
  generateHref,
}: OrgSetupWizardProps) {
  const [mounted, setMounted] = useState(false)
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) setSkipped(true)
    } catch {
      /* storage unavailable — keep showing */
    }
  }, [])

  const skip = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore unavailable storage */
    }
    setSkipped(true)
  }

  // Avoid SSR/client markup mismatch from localStorage; render nothing until mounted.
  if (!mounted || skipped) return null

  const steps: WizardStep[] = [
    {
      title: 'Create your first course',
      body: 'Spin up a course and add your source material — PDFs, docs, or plain text.',
      href: '/admin/courses/new',
      cta: 'New course',
      icon: 'folder',
      done: hasCourse,
    },
    {
      title: 'Add your team',
      body: 'Invite reviewers and learners so they can help build and take your courses.',
      href: '/admin/members',
      cta: 'Invite members',
      icon: 'users',
      done: hasTeamMember,
    },
    {
      title: 'Generate & publish',
      body: 'Let AI draft lessons and quizzes, then publish so your team can enroll.',
      href: generateHref,
      cta: 'Open courses',
      icon: 'sparkles',
      done: hasPublishedCourse,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const progress = Math.round((doneCount / steps.length) * 100)

  return (
    <section className={styles.wizard} aria-label="First-run setup">
      <div className={styles.head}>
        <div className={styles.headIcon}>
          <Icon name="sparkles" size={20} />
        </div>
        <div className={styles.headText}>
          <h2>Welcome — let’s set up your workspace</h2>
          <p>Three quick steps to get your team learning. Knock them out in any order.</p>
        </div>
        <button type="button" className={styles.skip} onClick={skip}>
          Skip setup
        </button>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {doneCount} of {steps.length} done
        </span>
      </div>

      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li
            key={step.title}
            className={`${styles.step} ${step.done ? styles.stepDone : ''}`}
          >
            <div className={styles.stepMarker} aria-hidden="true">
              {step.done ? <Icon name="check" size={16} /> : <span>{i + 1}</span>}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>
                <Icon name={step.icon} size={15} />
                <span>{step.title}</span>
                <span className={`pill ${step.done ? 'pill-success' : 'pill-draft'}`}>
                  {step.done ? 'Done' : 'To do'}
                </span>
              </div>
              <p className={styles.stepText}>{step.body}</p>
            </div>
            <Link
              href={step.href}
              className={step.done ? 'btn-secondary' : 'btn-cta'}
            >
              {step.done ? 'Review' : step.cta}
              <Icon name="arrowRight" size={15} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
