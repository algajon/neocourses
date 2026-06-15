'use client'

import { useState, useEffect, useCallback } from 'react'
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
}

interface ChecklistData {
  id: string
  title: string
  courseTitle: string
  items: ChecklistItem[]
}

export default function ChecklistEditorPage() {
  const params = useParams()
  const courseId = params.id as string

  const [checklist, setChecklist] = useState<ChecklistData | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const loadChecklist = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/checklist`)
      if (res.ok) {
        const data: ChecklistData = await res.json()
        setChecklist(data)
        setItems(data.items)
      }
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => { loadChecklist() }, [loadChecklist])

  const save = useCallback(async (current: ChecklistItem[]) => {
    if (!checklist) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/checklists/${checklist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: current }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [checklist])

  const handleRegenerate = async () => {
    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/checklist/regenerate`, { method: 'POST' })
      if (!res.ok) throw new Error('Regeneration failed')
      await loadChecklist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  const updateItem = (idx: number, patch: Partial<ChecklistItem>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  const addItem = () => {
    const newItem: ChecklistItem = {
      id: `new_${Date.now()}`,
      text: '',
      description: '',
      isRequired: false,
      position: items.length,
    }
    setItems(prev => [...prev, newItem])
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, position: i })))
  }

  const moveItem = (idx: number, direction: 'up' | 'down') => {
    setItems(prev => {
      const next = [...prev]
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next.map((item, i) => ({ ...item, position: i }))
    })
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading checklist...</div>
      </div>
    )
  }

  if (!checklist) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          Checklist not found.{' '}
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
            {' / '}Onboarding Checklist
          </p>
          <h1 className={styles.title}>{checklist.courseTitle}</h1>
          <p className={styles.subtitle}>
            {items.length} item{items.length !== 1 ? 's' : ''} · {items.filter(i => i.isRequired).length} required
          </p>
        </div>
        <div className={styles.headerActions}>
          {saved && <span className={styles.savedBadge}>Saved</span>}
          <button
            className="btn-secondary"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating...' : <><Icon name="sparkles" size={15} /> Regenerate checklist</>}
          </button>
          <button
            className="btn-primary"
            onClick={() => save(items)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save checklist'}
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className={styles.infoCard}>
        <p className={styles.infoText}>
          Learners complete this checklist before or after the course.
          Required items must be checked before the course is marked complete.
        </p>
      </div>

      <div className={styles.itemsList}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`${styles.itemCard} ${dragIdx === idx ? styles.dragging : ''}`}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (dragIdx === null || dragIdx === idx) { setDragIdx(null); return }
              setItems(prev => {
                const next = [...prev]
                const [removed] = next.splice(dragIdx, 1)
                next.splice(idx, 0, removed)
                return next.map((it, i) => ({ ...it, position: i }))
              })
              setDragIdx(null)
            }}
            onDragEnd={() => setDragIdx(null)}
          >
            <div className={styles.itemHeader}>
              <span className={styles.dragHandle} title="Drag to reorder">⠿</span>
              <span className={styles.itemNum}>{idx + 1}</span>
              <div className={styles.requiredToggle}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={item.isRequired}
                    onChange={e => updateItem(idx, { isRequired: e.target.checked })}
                    className={styles.toggleInput}
                  />
                  <span className={`${styles.togglePill} ${item.isRequired ? styles.togglePillActive : ''}`}>
                    {item.isRequired ? 'Required' : 'Optional'}
                  </span>
                </label>
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.itemActionBtn}
                  onClick={() => moveItem(idx, 'up')}
                  disabled={idx === 0}
                  aria-label="Move up"
                ><Icon name="arrowRight" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button
                  className={styles.itemActionBtn}
                  onClick={() => moveItem(idx, 'down')}
                  disabled={idx === items.length - 1}
                  aria-label="Move down"
                ><Icon name="arrowRight" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                <button
                  className={`${styles.itemActionBtn} ${styles.itemDeleteBtn}`}
                  onClick={() => removeItem(idx)}
                  aria-label="Delete item"
                ><Icon name="x" size={14} /></button>
              </div>
            </div>

            <div className={styles.itemBody}>
              <div className="form-group">
                <label className="label">Item text</label>
                <input
                  className="input"
                  value={item.text}
                  onChange={e => updateItem(idx, { text: e.target.value })}
                  placeholder="What should the learner do or confirm?"
                />
              </div>
              <div className="form-group">
                <label className="label">Description (optional)</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={item.description ?? ''}
                  onChange={e => updateItem(idx, { description: e.target.value })}
                  placeholder="Additional details or instructions..."
                />
              </div>
            </div>
          </div>
        ))}

        <button className={styles.addItemBtn} onClick={addItem}>
          + Add checklist item
        </button>
      </div>

      {items.length === 0 && (
        <p className={styles.emptyHint}>
          No items yet. Add items above or use Regenerate to auto-create from course content.
        </p>
      )}

      <div className={styles.footer}>
        <button
          className="btn-cta"
          onClick={() => save(items)}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save checklist'}
        </button>
      </div>
    </div>
  )
}
