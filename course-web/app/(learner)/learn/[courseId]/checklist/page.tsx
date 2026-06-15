'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface ChecklistItem {
  id: string
  text: string
  description: string | null
  isRequired: boolean
  position: number
  completedAt: string | null
}

interface ChecklistData {
  id: string
  title: string
  courseId: string
  items: ChecklistItem[]
}

export default function ChecklistPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId

  const [checklist, setChecklist] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/checklist/${courseId}`)
      .then(r => r.json())
      .then((data: ChecklistData) => {
        setChecklist(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load checklist.')
        setLoading(false)
      })
  }, [courseId])

  const toggleItem = useCallback(async (itemId: string, currentlyDone: boolean) => {
    setToggling(prev => ({ ...prev, [itemId]: true }))
    try {
      const res = await fetch('/api/checklist/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItemId: itemId, courseId, completed: !currentlyDone }),
      })
      const data = await res.json()
      if (data.completedAt !== undefined) {
        setChecklist(prev =>
          prev
            ? {
                ...prev,
                items: prev.items.map(it =>
                  it.id === itemId ? { ...it, completedAt: data.completedAt } : it,
                ),
              }
            : prev,
        )
      }
    } catch {
      /* silent */
    } finally {
      setToggling(prev => ({ ...prev, [itemId]: false }))
    }
  }, [courseId])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.skeleton}>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className={styles.skItem} />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || !checklist) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.errorText}>{error ?? 'Checklist not found.'}</p>
          <Link href={`/learn/${courseId}`} className={styles.backLink}>Back to course</Link>
        </div>
      </div>
    )
  }

  const completedCount = checklist.items.filter(it => !!it.completedAt).length
  const total = checklist.items.length
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const requiredItems = checklist.items.filter(it => it.isRequired)
  const requiredDone = requiredItems.filter(it => !!it.completedAt).length

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.breadcrumb}>
          <Link href={`/learn/${courseId}`} className={styles.breadcrumbLink}>Course</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{checklist.title}</span>
        </div>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{checklist.title}</h1>
            <p className={styles.subtitle}>
              {completedCount} of {total} completed
              {requiredItems.length > 0 && (
                <span className={styles.requiredNote}>
                  {' '}· {requiredDone}/{requiredItems.length} required
                </span>
              )}
            </p>
          </div>
          <div className={styles.circleProgress} aria-label={`${pct}% complete`}>
            <svg viewBox="0 0 36 36" className={styles.circleSvg}>
              <circle cx="18" cy="18" r="15.9" className={styles.circleTrack} />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                className={styles.circleFill}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset="25"
              />
            </svg>
            <span className={styles.circlePct}>{pct}%</span>
          </div>
        </div>

        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>

        <ul className={styles.list}>
          {checklist.items
            .sort((a, b) => a.position - b.position)
            .map(item => {
              const done = !!item.completedAt
              const busy = !!toggling[item.id]
              return (
                <li key={item.id} className={`${styles.item} ${done ? styles.itemDone : ''}`}>
                  <button
                    className={`${styles.checkbox} ${done ? styles.checkboxDone : ''}`}
                    onClick={() => toggleItem(item.id, done)}
                    disabled={busy}
                    aria-label={done ? `Uncheck ${item.text}` : `Check ${item.text}`}
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className={styles.itemContent}>
                    <div className={styles.itemRow}>
                      <span className={styles.itemText}>{item.text}</span>
                      {item.isRequired && (
                        <span className={styles.requiredBadge}>Required</span>
                      )}
                    </div>
                    {item.description && (
                      <p className={styles.itemDescription}>{item.description}</p>
                    )}
                    {done && item.completedAt && (
                      <span className={styles.completedAt}>
                        Completed {new Date(item.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
        </ul>

        {pct === 100 && (
          <div className={styles.allDone}>
            <span className={styles.allDoneIcon}><Icon name="check" size={18} /></span>
            <div>
              <p className={styles.allDoneTitle}>All items completed!</p>
              <p className={styles.allDoneSub}>You have finished the onboarding checklist.</p>
            </div>
            <Link href={`/learn/${courseId}`} className={styles.btnAccent}>
              Back to Course
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
