'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { LessonContent } from '@/lib/ai/types'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface LessonData {
  id: string
  title: string
  courseId: string
  moduleId: string
  moduleTitle: string
  learningObjectives: string[]
  keyPoints: string[]
  summary: string | null
  content: LessonContent | null
  position: number
}

interface EditState {
  title: string
  summary: string
  learningObjectives: string[]
  keyPoints: string[]
  intro: string
  concepts: Array<{ title: string; body: string }>
  callouts: Array<{ type: 'practice' | 'trivia' | 'tip'; title: string; text: string }>
  keyTakeaways: string[]
}

function makeDefaultEdit(lesson: LessonData): EditState {
  const content = lesson.content
  return {
    title: lesson.title,
    summary: lesson.summary ?? '',
    learningObjectives: lesson.learningObjectives?.length ? lesson.learningObjectives : [''],
    keyPoints: lesson.keyPoints?.length ? lesson.keyPoints : [''],
    intro: content?.intro ?? '',
    concepts: content?.concepts?.length
      ? content.concepts
      : [{ title: '', body: '' }, { title: '', body: '' }, { title: '', body: '' }, { title: '', body: '' }],
    callouts: content?.callouts?.length
      ? content.callouts
      : [
          { type: 'practice', title: 'In practice', text: '' },
          { type: 'trivia', title: 'Did you know', text: '' },
          { type: 'tip', title: 'Tip', text: '' },
        ],
    keyTakeaways: content?.keyTakeaways?.length ? content.keyTakeaways : [''],
  }
}

export default function LessonEditorPage() {
  const params = useParams()
  const courseId = params.id as string
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resizable editor columns — drag the gutters to widen a panel for easier reading.
  const [cols, setCols] = useState({ left: 280, right: 320 })
  const panelsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('courseneo-editor-cols-v1')
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p.left === 'number' && typeof p.right === 'number') setCols({ left: p.left, right: p.right })
      }
    } catch {}
  }, [])

  const startDrag = useCallback(
    (side: 'left' | 'right') => (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = side === 'left' ? cols.left : cols.right
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        const total = panelsRef.current?.getBoundingClientRect().width ?? 1200
        setCols((prev) => {
          if (side === 'left') {
            return { ...prev, left: Math.max(200, Math.min(startW + delta, total - prev.right - 380)) }
          }
          return { ...prev, right: Math.max(220, Math.min(startW - delta, total - prev.left - 380)) }
        })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setCols((prev) => {
          try { localStorage.setItem('courseneo-editor-cols-v1', JSON.stringify(prev)) } catch {}
          return prev
        })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [cols.left, cols.right],
  )

  const resetCols = useCallback(() => {
    setCols({ left: 280, right: 320 })
    try { localStorage.removeItem('courseneo-editor-cols-v1') } catch {}
  }, [])

  useEffect(() => {
    fetch(`/api/lessons/${lessonId}?courseId=${courseId}&adminView=1`)
      .then(r => r.json())
      .then((data: LessonData) => {
        setLesson(data)
        setEdit(makeDefaultEdit(data))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [lessonId, courseId])

  const save = useCallback(async (state: EditState) => {
    setSaving(true)
    try {
      await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.title,
          summary: state.summary,
          learningObjectives: state.learningObjectives.filter(Boolean),
          keyPoints: state.keyPoints.filter(Boolean),
          content: {
            intro: state.intro,
            concepts: state.concepts,
            callouts: state.callouts,
            keyTakeaways: state.keyTakeaways.filter(Boolean),
          },
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [lessonId])

  const scheduleAutoSave = useCallback((next: EditState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(next), 1200)
  }, [save])

  const update = useCallback((patch: Partial<EditState>) => {
    setEdit(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      scheduleAutoSave(next)
      return next
    })
  }, [scheduleAutoSave])

  const handleBlur = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (edit) save(edit)
  }

  if (loading) {
    return <div className={styles.loadingState}>Loading lesson...</div>
  }

  if (!lesson || !edit) {
    return (
      <div className={styles.loadingState}>
        Lesson not found. <Link href={`/admin/courses/${courseId}/outline`} className={styles.backLink}>Back to outline</Link>
      </div>
    )
  }

  const calloutTypes: Array<{ value: 'practice' | 'trivia' | 'tip'; label: string }> = [
    { value: 'practice', label: 'In practice' },
    { value: 'trivia', label: 'Did you know' },
    { value: 'tip', label: 'Tip' },
  ]

  return (
    <div className={styles.editorShell}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <Link href={`/admin/courses/${courseId}/outline`} className={styles.backBtn}>
            <Icon name="arrowLeft" size={15} /> Outline
          </Link>
          <span className={styles.topBarDivider} />
          <span className={styles.moduleLabel}>{lesson.moduleTitle}</span>
        </div>
        <div className={styles.topBarRight}>
          {saved && <span className={styles.savedBadge}>Saved</span>}
          {saving && <span className={styles.savingBadge}>Saving...</span>}
          <button className="btn-primary" onClick={() => edit && save(edit)} disabled={saving}>
            Save
          </button>
        </div>
      </div>

      {/* ── 3-panel layout (draggable gutters) ── */}
      <div
        className={styles.panels}
        ref={panelsRef}
        style={{ gridTemplateColumns: `${cols.left}px 8px minmax(360px, 1fr) 8px ${cols.right}px` }}
      >
        {/* Left: metadata */}
        <aside className={styles.metaPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Lesson Details</span>
          </div>

          <div className={styles.panelBody}>
            <div className="form-group">
              <label className="label">Title</label>
              <input
                className="input"
                value={edit.title}
                onChange={e => update({ title: e.target.value })}
                onBlur={handleBlur}
              />
            </div>

            <div className="form-group">
              <label className="label">Summary</label>
              <textarea
                className="textarea"
                rows={3}
                value={edit.summary}
                onChange={e => update({ summary: e.target.value })}
                onBlur={handleBlur}
                placeholder="One-sentence summary of this lesson"
              />
            </div>

            <div className="form-group">
              <label className="label">Learning Objectives</label>
              {edit.learningObjectives.map((obj, i) => (
                <div key={i} className={styles.listItemRow}>
                  <input
                    className="input"
                    value={obj}
                    onChange={e => {
                      const next = [...edit.learningObjectives]
                      next[i] = e.target.value
                      update({ learningObjectives: next })
                    }}
                    onBlur={handleBlur}
                    placeholder={`Objective ${i + 1}`}
                  />
                  {edit.learningObjectives.length > 1 && (
                    <button
                      className={styles.removeItemBtn}
                      onClick={() => {
                        const next = edit.learningObjectives.filter((_, j) => j !== i)
                        update({ learningObjectives: next })
                      }}
                      aria-label="Remove"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                className={styles.addItemBtn}
                onClick={() => update({ learningObjectives: [...edit.learningObjectives, ''] })}
              >
                + Add objective
              </button>
            </div>

            <div className="form-group">
              <label className="label">Key Points</label>
              {edit.keyPoints.map((kp, i) => (
                <div key={i} className={styles.listItemRow}>
                  <input
                    className="input"
                    value={kp}
                    onChange={e => {
                      const next = [...edit.keyPoints]
                      next[i] = e.target.value
                      update({ keyPoints: next })
                    }}
                    onBlur={handleBlur}
                    placeholder={`Key point ${i + 1}`}
                  />
                  {edit.keyPoints.length > 1 && (
                    <button
                      className={styles.removeItemBtn}
                      onClick={() => {
                        const next = edit.keyPoints.filter((_, j) => j !== i)
                        update({ keyPoints: next })
                      }}
                      aria-label="Remove"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                className={styles.addItemBtn}
                onClick={() => update({ keyPoints: [...edit.keyPoints, ''] })}
              >
                + Add key point
              </button>
            </div>
          </div>
        </aside>

        <div
          className={styles.gutter}
          onPointerDown={startDrag('left')}
          onDoubleClick={resetCols}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize lesson details panel (double-click to reset)"
          title="Drag to resize · double-click to reset"
        />

        {/* Center: content editor */}
        <main className={styles.contentPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Content Editor</span>
          </div>

          <div className={styles.panelBody}>
            <div className="form-group">
              <label className="label">Introduction</label>
              <textarea
                className="textarea"
                rows={4}
                value={edit.intro}
                onChange={e => update({ intro: e.target.value })}
                onBlur={handleBlur}
                placeholder="Opening paragraph that sets the context..."
              />
            </div>

            <div className={styles.sectionHeading}>Concept Cards (2 x 2 grid)</div>
            <div className={styles.conceptEditors}>
              {edit.concepts.slice(0, 4).map((concept, i) => (
                <div key={i} className={styles.conceptEditor}>
                  <div className={styles.conceptEditorNum}>{i + 1}</div>
                  <div className={styles.conceptEditorFields}>
                    <input
                      className="input"
                      value={concept.title}
                      onChange={e => {
                        const next = [...edit.concepts]
                        next[i] = { ...next[i], title: e.target.value }
                        update({ concepts: next })
                      }}
                      onBlur={handleBlur}
                      placeholder="Concept title"
                    />
                    <textarea
                      className="textarea"
                      rows={3}
                      value={concept.body}
                      onChange={e => {
                        const next = [...edit.concepts]
                        next[i] = { ...next[i], body: e.target.value }
                        update({ concepts: next })
                      }}
                      onBlur={handleBlur}
                      placeholder="Explanation..."
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.sectionHeading}>Callouts</div>
            {edit.callouts.map((callout, i) => (
              <div key={i} className={`${styles.calloutEditor} ${styles[`callout_${callout.type}`]}`}>
                <div className={styles.calloutEditorTop}>
                  <select
                    className={styles.calloutTypeSelect}
                    value={callout.type}
                    onChange={e => {
                      const next = [...edit.callouts]
                      next[i] = { ...next[i], type: e.target.value as 'practice' | 'trivia' | 'tip' }
                      update({ callouts: next })
                    }}
                    onBlur={handleBlur}
                  >
                    {calloutTypes.map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    value={callout.title}
                    onChange={e => {
                      const next = [...edit.callouts]
                      next[i] = { ...next[i], title: e.target.value }
                      update({ callouts: next })
                    }}
                    onBlur={handleBlur}
                    placeholder="Callout title"
                  />
                </div>
                <textarea
                  className="textarea"
                  rows={2}
                  value={callout.text}
                  onChange={e => {
                    const next = [...edit.callouts]
                    next[i] = { ...next[i], text: e.target.value }
                    update({ callouts: next })
                  }}
                  onBlur={handleBlur}
                  placeholder="Callout text..."
                />
              </div>
            ))}

            <div className="form-group">
              <label className="label">Key Takeaways</label>
              {edit.keyTakeaways.map((kt, i) => (
                <div key={i} className={styles.listItemRow}>
                  <input
                    className="input"
                    value={kt}
                    onChange={e => {
                      const next = [...edit.keyTakeaways]
                      next[i] = e.target.value
                      update({ keyTakeaways: next })
                    }}
                    onBlur={handleBlur}
                    placeholder={`Takeaway ${i + 1}`}
                  />
                  {edit.keyTakeaways.length > 1 && (
                    <button
                      className={styles.removeItemBtn}
                      onClick={() => {
                        const next = edit.keyTakeaways.filter((_, j) => j !== i)
                        update({ keyTakeaways: next })
                      }}
                      aria-label="Remove"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                className={styles.addItemBtn}
                onClick={() => update({ keyTakeaways: [...edit.keyTakeaways, ''] })}
              >
                + Add takeaway
              </button>
            </div>
          </div>
        </main>

        <div
          className={styles.gutter}
          onPointerDown={startDrag('right')}
          onDoubleClick={resetCols}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview panel (double-click to reset)"
          title="Drag to resize · double-click to reset"
        />

        {/* Right: preview */}
        <aside className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Preview</span>
          </div>
          <div className={styles.previewBody}>
            <h1 className={styles.previewTitle}>{edit.title || 'Untitled Lesson'}</h1>

            {edit.intro && (
              <p className={styles.previewIntro}>{edit.intro}</p>
            )}

            {edit.concepts.some(c => c.title || c.body) && (
              <div className={styles.previewConceptGrid}>
                {edit.concepts.slice(0, 4).filter(c => c.title || c.body).map((c, i) => (
                  <div key={i} className={styles.previewConceptCard}>
                    <h3 className={styles.previewConceptTitle}>{c.title || 'Concept'}</h3>
                    <p className={styles.previewConceptBody}>{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            {edit.callouts.filter(c => c.text).map((callout, i) => (
              <div
                key={i}
                className={`${styles.previewCallout} ${
                  callout.type === 'trivia' ? styles.previewCalloutTrivia :
                  callout.type === 'tip' ? styles.previewCalloutTip : ''
                }`}
              >
                <span className={styles.previewCalloutLabel}>{callout.title}</span>
                <p className={styles.previewCalloutText}>{callout.text}</p>
              </div>
            ))}

            {edit.keyTakeaways.filter(Boolean).length > 0 && (
              <div className={styles.previewTakeaways}>
                <h4 className={styles.previewTakeawaysTitle}>Key Takeaways</h4>
                <ul className={styles.previewTakeawayList}>
                  {edit.keyTakeaways.filter(Boolean).map((kt, i) => (
                    <li key={i} className={styles.previewTakeawayItem}>{kt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
