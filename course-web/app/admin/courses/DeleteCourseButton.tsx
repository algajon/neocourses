'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast/ToastProvider'
import { useConfirm } from '@/components/ConfirmDialog'

interface DeleteCourseButtonProps {
  courseId: string
  className?: string
  redirectTo?: string
}

export function DeleteCourseButton({ courseId, className, redirectTo }: DeleteCourseButtonProps) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this course?',
      message: 'This action cannot be undone. All modules, lessons, and source materials will be removed.',
      confirmLabel: 'Delete course',
      cancelLabel: 'Cancel',
      danger: true,
    })
    if (!ok) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error ?? 'Delete failed')
      }

      toast({ type: 'success', title: 'Course deleted' })

      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch {
      toast({
        type: 'error',
        title: 'Could not delete course',
        description: 'Please try again.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={deleting}
      onClick={handleDelete}
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
