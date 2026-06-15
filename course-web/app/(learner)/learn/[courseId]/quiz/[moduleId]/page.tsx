'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

  useEffect(() => {
    fetch(`/api/quiz/by-module/${params.moduleId}`)
      .then(r => r.json())
      .then((data: QuizData) => {
        setQuiz(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load quiz.')
        setLoading(false)
      })
  }, [params.moduleId])

  const currentQuestion = quiz?.questions[currentIdx]
  const totalQuestions = quiz?.questions.length ?? 0
  const isLast = currentIdx === totalQuestions - 1
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : ''
  const canAdvance = currentAnswer.trim().length > 0

  const handleAnswer = useCallback((value: string) => {
    if (!currentQuestion) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))
  }, [currentQuestion])

  const handleNext = useCallback(() => {
    if (!isLast) {
      setCurrentIdx(i => i + 1)
    }
  }, [isLast])

  const handleSubmit = useCallback(async () => {
    if (!quiz) return
    setSubmitting(true)
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
        router.push(`/learn/${params.courseId}/quiz/${params.moduleId}/results?attempt=${data.attemptId}`)
      } else {
        setError('Failed to submit quiz. Please try again.')
        setSubmitting(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }, [quiz, params, answers, router])

  if (loading) return <QuizSkeleton />

  if (error || !quiz) {
    return (
      <div className={styles.errorState}>
        <p className={styles.errorText}>{error ?? 'Quiz not found.'}</p>
        <Link href={`/learn/${params.courseId}`} className={styles.backLink}>Back to course</Link>
      </div>
    )
  }

  const q = currentQuestion!

  return (
    <div className={styles.shell}>
      <div className={styles.quizCard}>
        <header className={styles.header}>
          <Link href={`/learn/${params.courseId}`} className={styles.backBtn}>← Course</Link>
          <div className={styles.quizTitle}>{quiz.title}</div>
          <div className={styles.progress}>
            {currentIdx + 1} / {totalQuestions}
          </div>
        </header>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((currentIdx + (canAdvance ? 1 : 0)) / totalQuestions) * 100}%` }}
          />
        </div>

        <div className={styles.body}>
          <div className={styles.questionNum}>Question {currentIdx + 1}</div>
          <h2 className={styles.questionText}>{q.questionText}</h2>

          {q.questionType === 'multiple_choice' && q.options && (
            <div className={styles.options}>
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`${styles.option} ${currentAnswer === opt.id ? styles.optionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt.id}
                    checked={currentAnswer === opt.id}
                    onChange={() => handleAnswer(opt.id)}
                    className={styles.radioInput}
                  />
                  <span className={styles.optionMark} />
                  <span className={styles.optionText}>{opt.text}</span>
                </label>
              ))}
            </div>
          )}

          {q.questionType === 'true_false' && (
            <div className={styles.trueFalse}>
              {['True', 'False'].map(val => (
                <label
                  key={val}
                  className={`${styles.tfOption} ${currentAnswer === val ? styles.tfSelected : ''}`}
                >
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={val}
                    checked={currentAnswer === val}
                    onChange={() => handleAnswer(val)}
                    className={styles.radioInput}
                  />
                  <span className={styles.tfLabel}>{val}</span>
                </label>
              ))}
            </div>
          )}

          {q.questionType === 'short_answer' && (
            <textarea
              className={styles.shortAnswer}
              placeholder="Type your answer here…"
              value={currentAnswer}
              onChange={e => handleAnswer(e.target.value)}
              rows={4}
            />
          )}
        </div>

        <footer className={styles.footer}>
          {currentIdx > 0 && (
            <button
              className={styles.prevBtn}
              onClick={() => setCurrentIdx(i => i - 1)}
            >
              ← Back
            </button>
          )}
          <div className={styles.dots}>
            {quiz.questions.map((_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i === currentIdx ? styles.dotActive : answers[quiz.questions[i].id] ? styles.dotDone : ''}`}
              />
            ))}
          </div>
          {isLast ? (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!canAdvance || submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              className={styles.nextBtn}
              onClick={handleNext}
              disabled={!canAdvance}
            >
              Next →
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
      <div className={styles.quizCard}>
        <div className={styles.skeleton}>
          <div className={`${styles.skLine} ${styles.skShort}`} />
          <div className={`${styles.skLine} ${styles.skLong}`} />
          <div className={styles.skOptions}>
            {[1, 2, 3, 4].map(i => <div key={i} className={styles.skOpt} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
