'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { pingNotifications } from '@/components/useNotifications'
import styles from './page.module.css'

interface QuizOption {
  id: string
  text: string
}

interface QuizQuestion {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  options: QuizOption[] | null
  position: number
}

interface QuizData {
  id: string
  title: string
  passingScore: number
  courseId: string
  moduleId: string
  questions: QuizQuestion[]
}

interface PageProps {
  params: { courseId: string; moduleId: string }
}

export default function QuizPage({ params }: PageProps) {
  const router = useRouter()
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/quiz/by-module/${params.moduleId}`)
      .then(r => {
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then((data: QuizData) => {
        if (!active) return
        setQuiz(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError('Could not load quiz.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.moduleId])

  const currentQuestion = quiz?.questions[currentIdx]
  const totalQuestions = quiz?.questions.length ?? 0
  const isLast = currentIdx === totalQuestions - 1
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : ''
  const canAdvance = currentAnswer.trim().length > 0
  const answeredCount = quiz
    ? quiz.questions.filter(q => (answers[q.id] ?? '').trim().length > 0).length
    : 0

  const handleAnswer = useCallback(
    (value: string) => {
      if (!currentQuestion) return
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))
    },
    [currentQuestion],
  )

  const handleNext = useCallback(() => {
    setCurrentIdx(i => (i < totalQuestions - 1 ? i + 1 : i))
  }, [totalQuestions])

  const handlePrev = useCallback(() => {
    setCurrentIdx(i => (i > 0 ? i - 1 : i))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!quiz) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/quiz/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          moduleId: params.moduleId,
          courseId: params.courseId,
          answers,
        }),
      })
      const data = await res.json()
      if (data.attemptId) {
        // Finishing a quiz can earn awards (Quiz Taker, Quiz Ace) — surface them.
        pingNotifications()
        router.push(
          `/learn/${params.courseId}/quiz/${params.moduleId}/results?attempt=${data.attemptId}`,
        )
      } else {
        setError('Failed to submit quiz. Please try again.')
        setSubmitting(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }, [quiz, params, answers, router])

  // The selectable values for the current question, in display order.
  const choiceValues: string[] = (() => {
    if (!currentQuestion) return []
    if (currentQuestion.questionType === 'multiple_choice' && currentQuestion.options) {
      return currentQuestion.options.map(o => o.id)
    }
    if (currentQuestion.questionType === 'true_false') return ['True', 'False']
    return []
  })()

  // Keyboard: arrows move selection within the group, 1-9 jump to a choice,
  // Enter advances / submits. Short-answer questions opt out (textarea owns keys).
  const handleGroupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (choiceValues.length === 0) return
      const idx = choiceValues.indexOf(currentAnswer)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        const next = idx < 0 ? 0 : (idx + 1) % choiceValues.length
        handleAnswer(choiceValues[next])
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const prev =
          idx < 0 ? choiceValues.length - 1 : (idx - 1 + choiceValues.length) % choiceValues.length
        handleAnswer(choiceValues[prev])
      } else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key) - 1
        if (n < choiceValues.length) {
          e.preventDefault()
          handleAnswer(choiceValues[n])
        }
      }
    },
    [choiceValues, currentAnswer, handleAnswer],
  )

  // Enter at the card level advances or submits once the current question is answered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA' || tag === 'A' || tag === 'BUTTON') return
      if (!canAdvance || submitting) return
      e.preventDefault()
      if (isLast) handleSubmit()
      else handleNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAdvance, submitting, isLast, handleSubmit, handleNext])

  if (loading) return <QuizSkeleton />

  if (error && !quiz) {
    return (
      <div className={styles.shell}>
        <div className={styles.stateCard} role="alert">
          <div className={styles.stateIcon}>
            <Icon name="alertTriangle" size={22} />
          </div>
          <p className={styles.stateTitle}>{error}</p>
          <p className={styles.stateSub}>The quiz could not be loaded right now.</p>
          <Link href={`/learn/${params.courseId}`} className={styles.stateLink}>
            <Icon name="arrowLeft" size={15} /> Back to course
          </Link>
        </div>
      </div>
    )
  }

  if (!quiz || totalQuestions === 0) {
    return (
      <div className={styles.shell}>
        <div className={styles.stateCard}>
          <div className={styles.stateIcon}>
            <Icon name="info" size={22} />
          </div>
          <p className={styles.stateTitle}>No questions yet</p>
          <p className={styles.stateSub}>This module doesn’t have a quiz to take.</p>
          <Link href={`/learn/${params.courseId}`} className={styles.stateLink}>
            <Icon name="arrowLeft" size={15} /> Back to course
          </Link>
        </div>
      </div>
    )
  }

  const q = currentQuestion!
  const pct = Math.round((answeredCount / totalQuestions) * 100)

  return (
    <div className={styles.shell}>
      <div className={styles.quizCard}>
        <header className={styles.header}>
          <Link href={`/learn/${params.courseId}`} className={styles.backBtn}>
            <Icon name="arrowLeft" size={14} /> Course
          </Link>
          <div className={styles.quizTitle}>{quiz.title}</div>
          <div className={styles.progress} aria-live="polite">
            <span className={styles.progressCurrent}>{currentIdx + 1}</span>
            <span className={styles.progressDivider}>/</span>
            {totalQuestions}
          </div>
        </header>

        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={answeredCount}
          aria-label={`${answeredCount} of ${totalQuestions} questions answered`}
        >
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>

        <div className={styles.body}>
          <div className={styles.questionNum}>
            Question {currentIdx + 1} of {totalQuestions}
          </div>
          <h2 className={styles.questionText} id={`q-${q.id}-label`}>
            {q.questionText}
          </h2>

          {q.questionType === 'multiple_choice' && q.options && (
            <div
              className={styles.options}
              role="radiogroup"
              aria-labelledby={`q-${q.id}-label`}
              ref={groupRef}
              onKeyDown={handleGroupKeyDown}
            >
              {q.options.map((opt, i) => {
                const selected = currentAnswer === opt.id
                return (
                  <label
                    key={opt.id}
                    className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt.id}
                      checked={selected}
                      onChange={() => handleAnswer(opt.id)}
                      className={styles.radioInput}
                      tabIndex={selected || (!currentAnswer && i === 0) ? 0 : -1}
                    />
                    <span className={styles.optionKey} aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className={styles.optionMark} aria-hidden="true" />
                    <span className={styles.optionText}>{opt.text}</span>
                  </label>
                )
              })}
            </div>
          )}

          {q.questionType === 'true_false' && (
            <div
              className={styles.trueFalse}
              role="radiogroup"
              aria-labelledby={`q-${q.id}-label`}
              ref={groupRef}
              onKeyDown={handleGroupKeyDown}
            >
              {['True', 'False'].map((val, i) => {
                const selected = currentAnswer === val
                return (
                  <label
                    key={val}
                    className={`${styles.tfOption} ${selected ? styles.tfSelected : ''}`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={val}
                      checked={selected}
                      onChange={() => handleAnswer(val)}
                      className={styles.radioInput}
                      tabIndex={selected || (!currentAnswer && i === 0) ? 0 : -1}
                    />
                    <span className={styles.tfLabel}>{val}</span>
                  </label>
                )
              })}
            </div>
          )}

          {q.questionType === 'short_answer' && (
            <textarea
              className={styles.shortAnswer}
              placeholder="Type your answer here…"
              value={currentAnswer}
              onChange={e => handleAnswer(e.target.value)}
              aria-labelledby={`q-${q.id}-label`}
              rows={4}
            />
          )}

          {q.questionType !== 'short_answer' && choiceValues.length > 0 && (
            <p className={styles.kbdHint}>
              Use <kbd className={styles.kbd}>↑</kbd> <kbd className={styles.kbd}>↓</kbd> or number
              keys to choose, <kbd className={styles.kbd}>Enter</kbd> to continue.
            </p>
          )}
        </div>

        {error && quiz && (
          <p className={styles.inlineError} role="alert">
            {error}
          </p>
        )}

        <footer className={styles.footer}>
          <button
            className={styles.prevBtn}
            onClick={handlePrev}
            disabled={currentIdx === 0}
            type="button"
          >
            <Icon name="arrowLeft" size={14} /> Back
          </button>

          <div className={styles.dots} aria-hidden="true">
            {quiz.questions.map((qq, i) => (
              <button
                key={qq.id}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={`${styles.dot} ${
                  i === currentIdx
                    ? styles.dotActive
                    : (answers[qq.id] ?? '').trim()
                      ? styles.dotDone
                      : ''
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!canAdvance || submitting}
              type="button"
            >
              {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              className={styles.nextBtn}
              onClick={handleNext}
              disabled={!canAdvance}
              type="button"
            >
              Next <Icon name="arrowRight" size={14} />
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function QuizSkeleton() {
  return (
    <div className={styles.shell}>
      <div className={styles.quizCard} aria-busy="true" aria-label="Loading quiz">
        <div className={styles.skHeader}>
          <div className={`${styles.skLine} ${styles.skShort}`} />
          <div className={`${styles.skLine} ${styles.skPill}`} />
        </div>
        <div className={styles.skBar} />
        <div className={styles.skeleton}>
          <div className={`${styles.skLine} ${styles.skTiny}`} />
          <div className={`${styles.skLine} ${styles.skLong}`} />
          <div className={`${styles.skLine} ${styles.skMed}`} />
          <div className={styles.skOptions}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.skOpt} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
