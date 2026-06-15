'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import styles from './LessonNotes.module.css'

interface LessonNotesProps {
  courseId: string
  lessonId: string
}

type SaveState = 'idle' | 'saving' | 'saved'

export function LessonNotes({ courseId, lessonId }: LessonNotesProps) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef('')

  const save = useCallback(
    async (value: string) => {
      if (value === lastSavedRef.current) return
      setSaveState('saving')
      try {
        await fetch(`/api/lessons/${lessonId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, body: value }),
        })
        lastSavedRef.current = value
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
    },
    [courseId, lessonId],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/lessons/${lessonId}/notes?courseId=${courseId}`)
      .then(r => r.json())
      .then((data: { note: { body: string; updatedAt: string } | null }) => {
        if (cancelled) return
        const loaded = data.note?.body ?? ''
        setBody(loaded)
        lastSavedRef.current = loaded
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, lessonId, courseId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (toggleRef.current?.contains(target)) return
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setBody(value)
    setSaveState('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 800)
  }

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    save(body)
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={`${styles.toggle} ${open ? styles.toggleActive : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Notes"
        aria-expanded={open}
      >
        <Icon name="edit" size={15} />
        <span className={styles.toggleLabel}>Notes</span>
      </button>

      {open && (
        <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Lesson notes">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <Icon name="edit" size={15} />
              <span>Notes</span>
            </div>
            <div className={styles.panelMeta}>
              {saveState === 'saving' && <span className={styles.status}>Saving…</span>}
              {saveState === 'saved' && (
                <span className={`${styles.status} ${styles.statusSaved}`}>
                  <Icon name="check" size={13} /> Saved
                </span>
              )}
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close notes"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>

          <textarea
            className={styles.textarea}
            value={body}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={loading ? 'Loading…' : 'Write your notes for this lesson…'}
            disabled={loading}
            autoFocus
          />
        </div>
      )}
    </>
  )
}
