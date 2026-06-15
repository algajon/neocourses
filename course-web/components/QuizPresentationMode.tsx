'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from '@/components/Icon'
import styles from './QuizPresentationMode.module.css'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

interface QuizOption {
  id: string
  text: string
}

export interface QuizPresentationQuestion {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  options: QuizOption[] | null
  correctAnswer: string
  explanation: string | null
}

interface Props {
  title: string
  questions: QuizPresentationQuestion[]
  onClose: () => void
}

// Each question renders a uniform list of {id,label,text} so multiple_choice,
// true_false, and short_answer all flow through the same reveal logic.
function optionsFor(q: QuizPresentationQuestion): { id: string; label: string; text: string }[] {
  if (q.questionType === 'true_false') {
    return [
      { id: 'true', label: 'T', text: 'True' },
      { id: 'false', label: 'F', text: 'False' },
    ]
  }
  if (q.questionType === 'multiple_choice' && q.options) {
    return q.options.map((opt, i) => ({
      id: opt.id,
      label: OPTION_LABELS[i] ?? String(i + 1),
      text: opt.text,
    }))
  }
  return []
}

export function QuizPresentationMode({ title, questions, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const total = questions.length
  const q = questions[idx]

  const close = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    onClose()
  }, [onClose])

  // → / Space first reveals the answer, then advances to the next question.
  const next = useCallback(() => {
    if (!revealed) {
      setRevealed(true)
      return
    }
    setIdx(i => {
      if (i < total - 1) {
        setRevealed(false)
        return i + 1
      }
      return i
    })
  }, [revealed, total])

  const prev = useCallback(() => {
    setIdx(i => {
      if (revealed) return i
      if (i > 0) return i - 1
      return i
    })
    setRevealed(false)
  }, [revealed])

  // Enter fullscreen from the click gesture that mounted this component.
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

  const options = q ? optionsFor(q) : []

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
          {total === 0 ? '0 / 0' : `${idx + 1} / ${total}`}
        </span>
      </div>

      <div className={styles.stage}>
        {q ? (
          <div className={styles.slide}>
            <span className={styles.quizTag}>{title}</span>
            <p className={styles.question}>{q.questionText}</p>

            {options.length > 0 ? (
              <div className={styles.optionsGrid}>
                {options.map(opt => {
                  const isCorrect = opt.id === q.correctAnswer
                  return (
                    <div
                      key={opt.id}
                      className={`${styles.option}
                        ${revealed && isCorrect ? styles.optionCorrect : ''}
                        ${revealed && !isCorrect ? styles.optionDim : ''}`}
                    >
                      <span
                        className={`${styles.optionBadge} ${revealed && isCorrect ? styles.optionBadgeCorrect : ''}`}
                      >
                        {opt.label}
                      </span>
                      <span className={styles.optionText}>{opt.text}</span>
                      {revealed && isCorrect && (
                        <span className={styles.checkIcon}>
                          <Icon name="check" size={20} />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.shortAnswer}>
                <span className={styles.shortAnswerLabel}>Short answer</span>
                {revealed ? (
                  <p className={styles.shortAnswerText}>{q.correctAnswer}</p>
                ) : (
                  <p className={styles.shortAnswerPrompt}>Type your answer, then reveal.</p>
                )}
              </div>
            )}

            {revealed && q.explanation && (
              <div className={styles.explanation}>
                <span className={styles.explanationLabel}>Explanation</span>
                <p className={styles.explanationText}>{q.explanation}</p>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyText}>This quiz has no questions yet.</p>
            <p className={styles.emptySub}>{title}</p>
          </div>
        )}
      </div>

      <div className={`${styles.footer} ${controlsVisible ? '' : styles.controlHidden}`}>
        <span className={styles.escHint}>Press Esc to exit</span>

        <div className={styles.dots}>
          {questions.map((qq, i) => (
            <span
              key={qq.id}
              className={`${styles.dot} ${i === idx ? styles.dotActive : ''}`}
            />
          ))}
        </div>

        <div className={styles.navControls}>
          <button
            className={styles.revealBtn}
            onClick={next}
            disabled={total === 0 || (revealed && idx === total - 1)}
          >
            {revealed ? 'Next' : 'Reveal answer'}
          </button>
          <button
            className={styles.navBtn}
            onClick={prev}
            disabled={idx === 0 || revealed}
            title="Previous question"
          >
            <Icon name="arrowLeft" size={16} />
          </button>
          <button
            className={styles.navBtn}
            onClick={next}
            disabled={total === 0 || (revealed && idx === total - 1)}
            title={revealed ? 'Next question' : 'Reveal answer'}
          >
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
