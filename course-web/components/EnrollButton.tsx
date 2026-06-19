'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast/ToastProvider'

interface EnrollButtonProps {
  courseId: string
  className?: string
  label?: string
  /** Where to send the learner after enrolling. Defaults to the course overview. */
  redirectTo?: string
}

export function EnrollButton({ courseId, className, label, redirectTo }: EnrollButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)

  const destination = redirectTo ?? `/learn/${courseId}`

  async function run() {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast({ type: 'error', title: 'Could not enroll', description: data?.error ?? 'Please try again.' })
        setPending(false)
        return
      }
      toast({ type: 'success', title: 'Enrolled', description: 'Added to your learning.' })
      router.push(destination)
      router.refresh()
    } catch {
      toast({ type: 'error', title: 'Something went wrong', description: 'Please try again.' })
      setPending(false)
    }
  }

  return (
    <button type="button" className={className} onClick={run} disabled={pending}>
      {pending ? 'Enrolling…' : (label ?? 'Enroll')}
    </button>
  )
}
