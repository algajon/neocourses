'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
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
  correctAnswer: string
  explanation: string | null
  position: number
}

interface QuizData {
  id: string
  title: string
  moduleTitle: string
  passingScore: number
  questions: QuizQuestion[]
}

function makeBlankQuestion(position: number): Omit<QuizQuestion, 'id'> {
  return {
    questionText: '',
    questionType: 'multiple_choice',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correctAnswer: 'a',
    explanation: '',
    position,
  }
}

export default function QuizEditorPage() {
  const params = useParams()
  const courseId = params.id as string
  const moduleId = params.moduleId as string

  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const loadQuiz = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/quiz/${moduleId}`)
      if (res.ok) {
        const data: QuizData = await res.json()
        setQuiz(data)
        setQuestions(data.questions)
      }
    } finally {
      setLoading(false)
    }
  }, [courseId, moduleId])

  useEffect(() => { loadQuiz() }, [loadQuiz])

  const save = useCallback(async (qs: QuizQuestion[]) => {
    if (!quiz) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/quiz/${quiz.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: qs }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [quiz])

  const handleRegenerate = async () => {
    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/quiz/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId }),
      })
      if (!res.ok) throw new Error('Regeneration failed')
      await loadQuiz()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions(prev => {
      const next = prev.map((q, i) => i === idx ? { ...q, ...patch } : q)
      return next
    })
  }

  const updateOption = (qIdx: number, optId: string, text: string) => {
    setQuestions(prev => {
      const next = [...prev]
      const q = next[qIdx]
      if (!q.options) return next
      next[qIdx] = {
        ...q,
        options: q.options.map(o => o.id === optId ? { ...o, text } : o),
      }
      return next
    })
  }

  const addQuestion = () => {
    const newQ: QuizQuestion = {
      id: `new_${Date.now()}`,
      ...makeBlankQuestion(questions.length),
    }
    setQuestions(prev => [...prev, newQ])
  }

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, position: i })))
  }

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    setQuestions(prev => {
      const next = [...prev]
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next.map((q, i) => ({ ...q, position: i }))
    })
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading quiz...</div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          Quiz not found.{' '}
          <Link href={`/admin/courses/${courseId}/outline`} className={styles.backLink}>Back to outline</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.breadcrumb}>
            <Link href={`/admin/courses/${courseId}/outline`} className={styles.breadcrumbLink}>Outline</Link>
            {' / '}Quiz Editor
          </p>
          <h1 className={styles.title}>{quiz.moduleTitle}</h1>
          <p className={styles.subtitle}>
            {questions.length} question{questions.length !== 1 ? 's' : ''} · Passing score: {Math.round(quiz.passingScore * 100)}%
          </p>
        </div>
        <div className={styles.headerActions}>
          {saved && <span className={styles.savedBadge}>Saved</span>}
          <button
            className="btn-secondary"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating...' : <><Icon name="sparkles" size={15} /> Regenerate quiz</>}
          </button>
          <button
            className="btn-primary"
            onClick={() => save(questions)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save quiz'}
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className={styles.questionsList}>
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`${styles.questionCard} ${dragIdx === idx ? styles.dragging : ''}`}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => {
              e.preventDefault()
            }}
            onDrop={() => {
              if (dragIdx === null || dragIdx === idx) { setDragIdx(null); return }
              setQuestions(prev => {
                const next = [...prev]
                const [removed] = next.splice(dragIdx, 1)
                next.splice(idx, 0, removed)
                return next.map((item, i) => ({ ...item, position: i }))
              })
              setDragIdx(null)
            }}
            onDragEnd={() => setDragIdx(null)}
          >
            <div className={styles.questionHeader}>
              <div className={styles.questionDragHandle} title="Drag to reorder">⠿</div>
              <div className={styles.questionNum}>Q{idx + 1}</div>
              <div className={styles.questionActions}>
                <button
                  className={styles.qActionBtn}
                  onClick={() => moveQuestion(idx, 'up')}
                  disabled={idx === 0}
                  aria-label="Move up"
                ><Icon name="arrowRight" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button
                  className={styles.qActionBtn}
                  onClick={() => moveQuestion(idx, 'down')}
                  disabled={idx === questions.length - 1}
                  aria-label="Move down"
                ><Icon name="arrowRight" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                <button
                  className={`${styles.qActionBtn} ${styles.qDeleteBtn}`}
                  onClick={() => removeQuestion(idx)}
                  aria-label="Delete question"
                ><Icon name="x" size={14} /></button>
              </div>
            </div>

            <div className={styles.questionBody}>
              <div className="form-group">
                <label className="label">Question text</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={q.questionText}
                  onChange={e => updateQuestion(idx, { questionText: e.target.value })}
                  placeholder="Enter the question..."
                />
              </div>

              <div className={styles.questionRow}>
                <div className="form-group" style={{ flex: '0 0 180px' }}>
                  <label className="label">Type</label>
                  <select
                    className="select"
                    value={q.questionType}
                    onChange={e => updateQuestion(idx, { questionType: e.target.value as QuizQuestion['questionType'] })}
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short answer</option>
                  </select>
                </div>

                <div className="form-group" style={{ flex: '0 0 180px' }}>
                  <label className="label">Correct answer</label>
                  {q.questionType === 'multiple_choice' && q.options ? (
                    <select
                      className="select"
                      value={q.correctAnswer}
                      onChange={e => updateQuestion(idx, { correctAnswer: e.target.value })}
                    >
                      {q.options.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.id.toUpperCase()}: {o.text || '(empty)'}
                        </option>
                      ))}
                    </select>
                  ) : q.questionType === 'true_false' ? (
                    <select
                      className="select"
                      value={q.correctAnswer}
                      onChange={e => updateQuestion(idx, { correctAnswer: e.target.value })}
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <input
                      className="input"
                      value={q.correctAnswer}
                      onChange={e => updateQuestion(idx, { correctAnswer: e.target.value })}
                      placeholder="Expected answer..."
                    />
                  )}
                </div>
              </div>

              {q.questionType === 'multiple_choice' && q.options && (
                <div className="form-group">
                  <label className="label">Options</label>
                  <div className={styles.optionsList}>
                    {q.options.map(opt => (
                      <div key={opt.id} className={styles.optionRow}>
                        <span className={`${styles.optionId} ${q.correctAnswer === opt.id ? styles.optionCorrect : ''}`}>
                          {opt.id.toUpperCase()}
                        </span>
                        <input
                          className="input"
                          value={opt.text}
                          onChange={e => updateOption(idx, opt.id, e.target.value)}
                          placeholder={`Option ${opt.id.toUpperCase()}`}
                        />
                        {q.correctAnswer === opt.id && (
                          <span className={styles.correctMark} title="Correct answer"><Icon name="check" size={14} /></span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="label">Explanation (shown after answering)</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={q.explanation ?? ''}
                  onChange={e => updateQuestion(idx, { explanation: e.target.value })}
                  placeholder="Why is this the correct answer?"
                />
              </div>
            </div>
          </div>
        ))}

        <button className={styles.addQuestionBtn} onClick={addQuestion}>
          + Add question
        </button>
      </div>

      <div className={styles.footer}>
        <button
          className="btn-cta"
          onClick={() => save(questions)}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save quiz'}
        </button>
      </div>
    </div>
  )
}
