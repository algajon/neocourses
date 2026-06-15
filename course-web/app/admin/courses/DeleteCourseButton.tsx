'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteCourseButtonProps {
  courseId: string
  className?: string
  redirectTo?: string
}

export function DeleteCourseButton({ courseId, className, redirectTo }: DeleteCourseButtonProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    if (!window.confirm('Delete this course? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? 'Delete failed')
      }

      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError('Could not delete course. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <button
        type="button"
        className={className}
        disabled={deleting}
        onClick={handleDelete}
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <div style={{ color: 'var(--color-danger, #d31f1f)', fontSize: '13px' }}>{error}</div> : null}
    </div>
  )
}
