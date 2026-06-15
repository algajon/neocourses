'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EnrollButtonProps {
  courseId: string
  className?: string
  label?: string
}

export function EnrollButton({ courseId, className, label = 'Enroll' }: EnrollButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleEnroll() {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, { method: 'POST' })
      if (!res.ok) {
        setPending(false)
        return
      }
      router.push(`/learn/${courseId}`)
      router.refresh()
    } catch {
      setPending(false)
    }
  }

  return (
    <button type="button" className={className} onClick={handleEnroll} disabled={pending}>
      {pending ? 'Enrolling…' : label}
    </button>
  )
}
