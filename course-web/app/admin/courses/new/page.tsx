'use client'

import { useState, FormEvent, Fragment, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { courseGradient } from '@/lib/gradient'
import type { PricingModel } from '@/lib/pricing'
import styles from './page.module.css'

// The full course-creation pipeline. Steps 1–2 are this form; 3–6 happen after
// the course is created (shown here so admins see the whole process up front).
const PIPELINE = ['Basic Info', 'Settings', 'Upload', 'Generate', 'Review', 'Publish']

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
  pricingModel: PricingModel
  price: string
  thumbnailUrl: string
}

const PRICING_OPTIONS: { value: PricingModel; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
  { value: 'first_chapter_free', label: 'First chapter free' },
]

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
    pricingModel: 'free',
    price: '',
    thumbnailUrl: '',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const needsPrice = step2.pricingModel !== 'free'
  const previewBackground = step2.thumbnailUrl
    ? `url(${step2.thumbnailUrl}) center / cover no-repeat`
    : courseGradient(step1.title || 'courseneo')

  async function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/courses/thumbnail', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Image upload failed')
      }
      const data = await res.json()
      setStep2((s) => ({ ...s, thumbnailUrl: data.url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  function clearThumbnail() {
    setStep2((s) => ({ ...s, thumbnailUrl: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
    setError('')

    const priceCents = needsPrice ? Math.round(Number(step2.price) * 100) : 0
    if (needsPrice && (!Number.isFinite(priceCents) || priceCents <= 0)) {
      setError('Enter a price greater than $0 for a paid course.')
      return
    }

    setSubmitting(true)

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
          pricingModel: step2.pricingModel,
          priceCents,
          thumbnailUrl: step2.thumbnailUrl || null,
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
        {PIPELINE.map((label, idx) => {
          const n = idx + 1
          const state = n < step ? 'done' : n === step ? 'active' : 'upcoming'
          return (
            <Fragment key={label}>
              {idx > 0 && <div className={styles.stepConnector} />}
              <div
                className={`${styles.step} ${state === 'active' ? styles.active : ''} ${state === 'done' ? styles.done : ''}`}
              >
                <span className={styles.stepNum}>
                  {state === 'done' ? <Icon name="check" size={14} /> : n}
                </span>
                {label}
              </div>
            </Fragment>
          )
        })}
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

              <div className={styles.field}>
                <span className="label">Pricing</span>
                <div className={styles.segmented} role="radiogroup" aria-label="Pricing">
                  {PRICING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={step2.pricingModel === opt.value}
                      className={`${styles.segment} ${step2.pricingModel === opt.value ? styles.segmentActive : ''}`}
                      onClick={() => setStep2({ ...step2, pricingModel: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {needsPrice && (
                  <div className={styles.priceField}>
                    <span className={styles.pricePrefix}>$</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={step2.price}
                      onChange={(e) => setStep2({ ...step2, price: e.target.value })}
                      placeholder="29.00"
                      aria-label="Price in dollars"
                    />
                  </div>
                )}
                {step2.pricingModel === 'first_chapter_free' && (
                  <p className={styles.hint}>
                    Learners enroll free and can read the first chapter; later chapters unlock after purchase.
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <span className="label">Course image</span>
                <div
                  className={styles.imagePreview}
                  style={{ background: previewBackground }}
                  aria-label="Course image preview"
                >
                  {!step2.thumbnailUrl && <Icon name="image" size={22} />}
                </div>
                <p className={styles.hint}>
                  {step2.thumbnailUrl
                    ? 'Using your uploaded image.'
                    : 'Auto-generated gradient preview. The final gradient is derived from the course ID once created.'}
                </p>
                <div className={styles.imageActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleThumbnailChange}
                    className={styles.fileInput}
                    id="thumbnail"
                  />
                  <label htmlFor="thumbnail" className="btn-secondary">
                    {uploading ? 'Uploading…' : step2.thumbnailUrl ? 'Replace image' : 'Upload image'}
                  </label>
                  {step2.thumbnailUrl && (
                    <button type="button" className={styles.removeBtn} onClick={clearThumbnail}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
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
