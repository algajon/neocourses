'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface Flashcard {
  id: string
  courseId: string
  lessonId: string
  front: string
  back: string
}

// Keep each sitting short and achievable rather than dumping every due card.
const SESSION_SIZE = 15

const GRADES: Array<{
  grade: 0 | 1 | 2 | 3
  label: string
  hint: string
  key: string
}> = [
  { grade: 0, label: 'Forgot', hint: 'See it again soon', key: '1' },
  { grade: 1, label: 'Hard', hint: 'Comes back tomorrow', key: '2' },
  { grade: 2, label: 'Good', hint: 'Normal interval', key: '3' },
  { grade: 3, label: 'Easy', hint: 'Push it further out', key: '4' },
]

type Phase = 'loading' | 'intro' | 'review' | 'summary'

interface PageProps {
  params: { courseId: string }
}

export default function FlashcardsPage({ params }: PageProps) {
  const { courseId } = params
  const [phase, setPhase] = useState<Phase>('loading')
  const [allDue, setAllDue] = useState<Flashcard[]>([])
  const [queue, setQueue] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [knew, setKnew] = useState(0)
  const [missed, setMissed] = useState(0)

  const loadDue = useCallback(() => {
    setPhase('loading')
    fetch(`/api/flashcards?courseId=${courseId}`)
      .then((r) => r.json())
      .then((data: { due?: Flashcard[] }) => {
        setAllDue(data.due ?? [])
        setPhase('intro')
      })
      .catch(() => {
        setAllDue([])
        setPhase('intro')
      })
  }, [courseId])

  useEffect(() => {
    loadDue()
  }, [loadDue])

  const startSession = useCallback(() => {
    setQueue(allDue.slice(0, SESSION_SIZE))
    setIndex(0)
    setRevealed(false)
    setKnew(0)
    setMissed(0)
    setPhase('review')
  }, [allDue])

  const current = queue[index] ?? null
  const reviewedCount = knew + missed

  const handleGrade = useCallback(
    async (grade: 0 | 1 | 2 | 3) => {
      if (!current || submitting) return
      setSubmitting(true)
      try {
        await fetch('/api/flashcards/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flashcardId: current.id, grade }),
        })
      } catch {
        // Advance anyway; the scheduler is idempotent on retry.
      }
      if (grade >= 2) setKnew((c) => c + 1)
      else setMissed((c) => c + 1)
      setRevealed(false)
      setSubmitting(false)
      if (index + 1 >= queue.length) {
        setPhase('summary')
      } else {
        setIndex((i) => i + 1)
      }
    },
    [current, submitting, index, queue.length],
  )

  // Keyboard: Space/Enter flips; 1–4 grade once revealed.
  useEffect(() => {
    if (phase !== 'review') return
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealed) setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        handleGrade((Number(e.key) - 1) as 0 | 1 | 2 | 3)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, revealed, handleGrade])

  const dueCount = allDue.length
  const sessionTotal = queue.length

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.breadcrumb}>
          <Link href={`/learn/${courseId}`} className={styles.breadcrumbLink}>
            <Icon name="arrowLeft" size={14} /> Course
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Flashcards</span>
        </div>

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <div className={styles.cardShell}>
            <div className={styles.skeleton} />
          </div>
        )}

        {/* ── Intro / start ── */}
        {phase === 'intro' && (
          <div className={styles.intro}>
            <div className={styles.introIcon}>
              <Icon name="sparkles" size={26} />
            </div>
            {dueCount > 0 ? (
              <>
                <h1 className={styles.introTitle}>
                  {dueCount} card{dueCount !== 1 ? 's' : ''} ready to review
                </h1>
                <p className={styles.introText}>
                  Flashcards use spaced repetition: cards you find hard come back sooner,
                  cards you know drift further out. A quick {Math.min(dueCount, SESSION_SIZE)}-card
                  session keeps this course fresh in your memory.
                </p>
                <button type="button" className={styles.primaryBtn} onClick={startSession}>
                  Start review
                </button>
                <p className={styles.kbdHint}>
                  <kbd className={styles.kbd}>Space</kbd> flip ·{' '}
                  <kbd className={styles.kbd}>1</kbd>–<kbd className={styles.kbd}>4</kbd> rate
                </p>
              </>
            ) : (
              <>
                <h1 className={styles.introTitle}>You&rsquo;re all caught up</h1>
                <p className={styles.introText}>
                  No cards are due right now. Spaced repetition will surface them again
                  when it&rsquo;s the right time to refresh.
                </p>
                <Link href={`/learn/${courseId}`} className={styles.primaryBtn}>
                  Back to course
                </Link>
              </>
            )}
          </div>
        )}

        {/* ── Review ── */}
        {phase === 'review' && current && (
          <>
            <div className={styles.progressRow}>
              <span className={styles.progressCount}>
                Card {index + 1} of {sessionTotal}
              </span>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${(index / sessionTotal) * 100}%` }}
                />
              </div>
            </div>

            <div className={styles.cardShell}>
              <button
                type="button"
                className={`${styles.flip} ${revealed ? styles.flipped : ''}`}
                onClick={() => !revealed && setRevealed(true)}
                aria-label={revealed ? 'Answer' : 'Reveal answer'}
              >
                <div className={`${styles.face} ${styles.faceFront}`}>
                  <span className={styles.faceLabel}>Question</span>
                  <p className={styles.faceText}>{current.front}</p>
                  <span className={styles.flipHint}>
                    <Icon name="eye" size={14} /> Tap or press Space to flip
                  </span>
                </div>
                <div className={`${styles.face} ${styles.faceBack}`}>
                  <span className={styles.faceLabel}>Answer</span>
                  <p className={styles.faceText}>{current.back}</p>
                </div>
              </button>
            </div>

            {revealed ? (
              <div className={styles.gradeBlock}>
                <p className={styles.gradePrompt}>How well did you remember it?</p>
                <div className={styles.grades}>
                  {GRADES.map((g) => (
                    <button
                      key={g.grade}
                      type="button"
                      className={`${styles.gradeBtn} ${styles[`grade${g.grade}`]}`}
                      onClick={() => handleGrade(g.grade)}
                      disabled={submitting}
                    >
                      <span className={styles.gradeKey}>{g.key}</span>
                      <span className={styles.gradeLabel}>{g.label}</span>
                      <span className={styles.gradeHint}>{g.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.revealBtn}
                onClick={() => setRevealed(true)}
              >
                <Icon name="eye" size={16} /> Show answer
              </button>
            )}
          </>
        )}

        {/* ── Summary ── */}
        {phase === 'summary' && (
          <div className={styles.intro}>
            <div className={styles.doneIcon}>
              <Icon name="check" size={28} />
            </div>
            <h1 className={styles.introTitle}>Session complete</h1>
            <div className={styles.summaryStats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{reviewedCount}</span>
                <span className={styles.statLabel}>reviewed</span>
              </div>
              <div className={`${styles.stat} ${styles.statGood}`}>
                <span className={styles.statValue}>{knew}</span>
                <span className={styles.statLabel}>knew it</span>
              </div>
              <div className={`${styles.stat} ${styles.statMiss}`}>
                <span className={styles.statValue}>{missed}</span>
                <span className={styles.statLabel}>to revisit</span>
              </div>
            </div>
            <p className={styles.introText}>
              {dueCount > sessionTotal
                ? `${dueCount - sessionTotal} more card${dueCount - sessionTotal !== 1 ? 's' : ''} still due. Keep the streak going?`
                : 'Nicely done. Cards you found tricky will resurface sooner.'}
            </p>
            <div className={styles.summaryActions}>
              {dueCount > sessionTotal && (
                <button type="button" className={styles.primaryBtn} onClick={loadDue}>
                  Review more
                </button>
              )}
              <Link
                href={`/learn/${courseId}`}
                className={dueCount > sessionTotal ? styles.secondaryBtn : styles.primaryBtn}
              >
                Back to course
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
