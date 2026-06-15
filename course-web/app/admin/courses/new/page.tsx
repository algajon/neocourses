'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface Step1Data {
  title: string
  description: string
  courseType: string
  targetAudience: string
}

interface Step2Data {
  difficultyLevel: string
  estimatedHours: string
  certificateEnabled: boolean
}

const COURSE_TYPES = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'internal', label: 'Internal Training' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'product', label: 'Product' },
  { value: 'custom', label: 'Custom' },
]

const DIFFICULTY_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export default function NewCoursePage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [step1, setStep1] = useState<Step1Data>({
    title: '',
    description: '',
    courseType: 'custom',
    targetAudience: '',
  })

  const [step2, setStep2] = useState<Step2Data>({
    difficultyLevel: 'beginner',
    estimatedHours: '',
    certificateEnabled: true,
  })

  function handleStep1Submit(e: FormEvent) {
    e.preventDefault()
    if (!step1.title.trim()) {
      setError('Course title is required.')
      return
    }
    setError('')
    setStep(2)
  }

  async function handleStep2Submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: step1.title,
          description: step1.description,
          courseType: step1.courseType,
          targetAudience: step1.targetAudience,
          difficultyLevel: step2.difficultyLevel,
          estimatedHours: step2.estimatedHours ? Number(step2.estimatedHours) : undefined,
          certificateEnabled: step2.certificateEnabled,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create course')
      }

      const data = await res.json()
      router.push(`/admin/courses/${data.course.id}/upload`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Admin / Courses</div>
      <div className={styles.header}>
        <h1>New Course</h1>
      </div>

      <div className={styles.stepIndicator}>
        <div className={`${styles.step} ${step === 1 ? styles.active : styles.done}`}>
          <span className={styles.stepNum}>{step > 1 ? <Icon name="check" size={14} /> : '1'}</span>
          Basic Info
        </div>
        <div className={styles.stepConnector} />
        <div className={`${styles.step} ${step === 2 ? styles.active : ''}`}>
          <span className={styles.stepNum}>2</span>
          Settings
        </div>
      </div>

      {step === 1 && (
        <div className={styles.card}>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleStep1Submit}>
            <fieldset className={styles.fieldset}>
              <div className={styles.field}>
                <label htmlFor="title" className="label">Course Title *</label>
                <input
                  id="title"
                  className="input"
                  type="text"
                  value={step1.title}
                  onChange={(e) => setStep1({ ...step1, title: e.target.value })}
                  placeholder="e.g. New Employee Onboarding"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="description" className="label">Description</label>
                <textarea
                  id="description"
                  className="textarea"
                  value={step1.description}
                  onChange={(e) => setStep1({ ...step1, description: e.target.value })}
                  placeholder="What will learners gain from this course?"
                  rows={4}
                />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="courseType" className="label">Course Type</label>
                  <select
                    id="courseType"
                    className="select"
                    value={step1.courseType}
                    onChange={(e) => setStep1({ ...step1, courseType: e.target.value })}
                  >
                    {COURSE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="targetAudience" className="label">Target Audience</label>
                  <input
                    id="targetAudience"
                    className="input"
                    type="text"
                    value={step1.targetAudience}
                    onChange={(e) => setStep1({ ...step1, targetAudience: e.target.value })}
                    placeholder="e.g. New hires, Engineers"
                  />
                </div>
              </div>
            </fieldset>
            <div className={styles.footer}>
              <Link href="/admin/courses" className="btn-secondary">Cancel</Link>
              <button type="submit" className="btn-cta">Continue</button>
            </div>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className={styles.card}>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleStep2Submit}>
            <fieldset className={styles.fieldset}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="difficulty" className="label">Difficulty Level</label>
                  <select
                    id="difficulty"
                    className="select"
                    value={step2.difficultyLevel}
                    onChange={(e) => setStep2({ ...step2, difficultyLevel: e.target.value })}
                  >
                    {DIFFICULTY_LEVELS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="estimatedHours" className="label">Estimated Hours</label>
                  <input
                    id="estimatedHours"
                    className="input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={step2.estimatedHours}
                    onChange={(e) => setStep2({ ...step2, estimatedHours: e.target.value })}
                    placeholder="e.g. 2"
                  />
                </div>
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={step2.certificateEnabled}
                  onChange={(e) => setStep2({ ...step2, certificateEnabled: e.target.checked })}
                />
                <span className={styles.checkboxLabel}>Issue completion certificate</span>
              </label>
            </fieldset>
            <div className={styles.footer}>
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="submit" className="btn-cta" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Course'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
