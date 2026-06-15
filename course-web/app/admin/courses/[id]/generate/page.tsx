'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface SourceMaterial {
  id: string
  fileName: string
  fileType: string
  status: string
}

interface GenerationJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  statusMessage: string | null
  error: string | null
}

const STEPS = [
  { key: 'materials', label: 'Analyzing source materials...' },
  { key: 'structure', label: 'Generating course structure...' },
  { key: 'lessons', label: 'Writing lessons...' },
  { key: 'quizzes', label: 'Creating quizzes...' },
  { key: 'checklist', label: 'Building onboarding checklist...' },
]

export default function GeneratePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [materials, setMaterials] = useState<SourceMaterial[]>([])
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const pollJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/jobs`)
      if (!res.ok) return
      const data = await res.json()
      const latest: GenerationJob | null = data.job ?? null
      setJob(latest)
      if (latest?.status === 'completed' || latest?.status === 'failed') {
        stopPolling()
      }
    } catch {}
  }, [courseId])

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/upload`)
        if (res.ok) {
          const data = await res.json()
          setMaterials(data.sourceMaterials ?? [])
        }
      } catch {}
    }

    const checkExistingJob = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/jobs`)
        if (res.ok) {
          const data = await res.json()
          const latest: GenerationJob | null = data.job ?? null
          if (latest && (latest.status === 'pending' || latest.status === 'running')) {
            setJob(latest)
            pollRef.current = setInterval(pollJob, 2000)
          } else if (latest) {
            setJob(latest)
          }
        }
      } catch {}
    }

    loadMaterials()
    checkExistingJob()

    return () => stopPolling()
  }, [courseId, pollJob])

  const handleGenerate = async () => {
    setIsStarting(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/generate`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to start generation')
      }
      await res.json()
      pollRef.current = setInterval(pollJob, 2000)
      pollJob()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
    } finally {
      setIsStarting(false)
    }
  }

  const handleRetry = () => {
    setJob(null)
    setError(null)
  }

  const currentStepIndex = (() => {
    if (!job) return -1
    if (job.status === 'completed') return STEPS.length
    if (job.status === 'failed') return -1
    const p = job.progress ?? 0
    return Math.min(Math.floor((p / 100) * STEPS.length), STEPS.length - 1)
  })()

  const isRunning = job?.status === 'pending' || job?.status === 'running'
  const isDone = job?.status === 'completed'
  const isFailed = job?.status === 'failed'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>Course Setup</p>
        <h1 className={styles.title}>Generate Course Content</h1>
        <p className={styles.subtitle}>
          The AI will analyze your source materials and generate a complete course structure with lessons and quizzes.
        </p>
      </header>

      {materials.length > 0 && (
        <div className={`card ${styles.materialsCard}`}>
          <h3 className={styles.materialsTitle}>Source materials ({materials.length})</h3>
          <div className={styles.materialsList}>
            {materials.map(m => (
              <div key={m.id} className={styles.materialItem}>
                <span className={styles.materialIcon}><Icon name="file" size={16} /></span>
                <span className={styles.materialName}>{m.fileName}</span>
                <span className={`pill ${m.status === 'ready' ? 'pill-success' : 'pill-warning'}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isRunning && !isDone && !isFailed && (
        <div className={styles.startCard}>
          {error && (
            <div className={styles.errorBanner}>
              <strong>Error:</strong> {error}
            </div>
          )}
          {materials.length === 0 ? (
            <p className={styles.noMaterials}>
              No source materials found.{' '}
              <button
                className={styles.linkBtn}
                onClick={() => router.push(`/admin/courses/${courseId}/upload`)}
              >
                Upload files first
              </button>
              .
            </p>
          ) : (
            <button
              className={`btn-cta ${styles.generateBtn}`}
              onClick={handleGenerate}
              disabled={isStarting || materials.length === 0}
            >
              {isStarting ? (
                <>
                  <span className={styles.spinner} />
                  Starting...
                </>
              ) : (
                <><Icon name="sparkles" size={16} /> Generate Full Course</>
              )}
            </button>
          )}
        </div>
      )}

      {(isRunning || isDone || isFailed) && (
        <div className={`card ${styles.progressCard}`}>
          <div className={styles.progressHeader}>
            {isRunning && <span className={styles.runningBadge}>Running</span>}
            {isDone && <span className="pill pill-success">Complete</span>}
            {isFailed && <span className="pill pill-error">Failed</span>}
            <div className="progress-bar" style={{ flex: 1 }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${isDone ? 100 : job?.progress ?? 0}%` }}
              />
            </div>
            <span className={styles.progressPct}>
              {isDone ? 100 : job?.progress ?? 0}%
            </span>
          </div>

          <div className={styles.steps}>
            {STEPS.map((step, idx) => {
              let state: 'done' | 'active' | 'pending' = 'pending'
              if (isDone || idx < currentStepIndex) state = 'done'
              else if (isRunning && idx === currentStepIndex) state = 'active'

              return (
                <div key={step.key} className={`${styles.step} ${styles[state]}`}>
                  <span className={styles.stepIcon}>
                    {state === 'done' ? <Icon name="check" size={14} /> : state === 'active' ? <span className={styles.spinnerSmall} /> : '○'}
                  </span>
                  <span className={styles.stepLabel}>{step.label}</span>
                </div>
              )
            })}
          </div>

          {job?.statusMessage && isRunning && (
            <p className={styles.statusMsg}>{job.statusMessage}</p>
          )}

          {isFailed && (
            <div className={styles.failureBox}>
              <p className={styles.failureText}>{job?.error ?? 'Generation failed. Please try again.'}</p>
              <button className="btn-secondary" onClick={handleRetry}>Retry</button>
            </div>
          )}

          {isDone && (
            <div className={styles.successBox}>
              <p className={styles.successText}>Your course has been generated successfully!</p>
              <button
                className="btn-cta"
                onClick={() => router.push(`/admin/courses/${courseId}/outline`)}
              >
                Review Course <Icon name="arrowRight" size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
