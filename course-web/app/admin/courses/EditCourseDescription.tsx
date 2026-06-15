'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EditCourseDescriptionProps {
  courseId: string
  description?: string | null
}

export function EditCourseDescription({ courseId, description }: EditCourseDescriptionProps) {
  const [value, setValue] = useState(description ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    setError('')

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: value }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? 'Save failed')
      }

      setStatus('saved')
      router.refresh()
    } catch (err) {
      setStatus('error')
      setError('Could not save description. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
      <label
        htmlFor="course-description"
        style={{ display: 'block', marginBottom: '0.75rem', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}
      >
        Course description
      </label>
      <textarea
        id="course-description"
        className="textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={5}
        style={{ minHeight: '112px', width: '100%', resize: 'vertical' }}
      />
      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-cta"
          disabled={saving}
          onClick={handleSave}
          style={{ minWidth: 'fit-content' }}
        >
          {saving ? 'Saving…' : 'Save description'}
        </button>
        {status === 'saved' ? (
          <span style={{ color: 'var(--color-success)', fontSize: '13px' }}>Saved</span>
        ) : null}
        {status === 'error' ? (
          <span style={{ color: 'var(--color-danger, #d31f1f)', fontSize: '13px' }}>{error}</span>
        ) : null}
      </div>
    </div>
  )
}
