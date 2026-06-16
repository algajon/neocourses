'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast/ToastProvider'

type Action = 'enroll' | 'start-free' | 'purchase' | 'unlock'

interface EnrollButtonProps {
  courseId: string
  /** What this CTA does. Defaults to a free enroll. */
  action?: Action
  className?: string
  label?: string
  /** Formatted price string (e.g. "$29"), used in the demo purchase modal. */
  priceLabel?: string
  /** Course title, used in the purchase confirm modal copy. */
  courseTitle?: string
  /** Where to send the learner after success. Defaults to the course overview. */
  redirectTo?: string
}

const DEMO_MESSAGE =
  'This is a demo — no payment is taken. Confirming will instantly unlock the course for you.'

export function EnrollButton({
  courseId,
  action = 'enroll',
  className,
  label,
  priceLabel,
  courseTitle,
  redirectTo,
}: EnrollButtonProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)

  const isPurchase = action === 'purchase' || action === 'unlock'
  const defaultLabel =
    action === 'unlock'
      ? `Unlock full course${priceLabel ? ` — ${priceLabel}` : ''}`
      : action === 'purchase'
        ? `Get for ${priceLabel ?? ''}`.trim()
        : action === 'start-free'
          ? 'Start free'
          : 'Enroll'

  const pendingLabel = isPurchase ? 'Unlocking…' : 'Enrolling…'
  const destination = redirectTo ?? `/learn/${courseId}`

  async function run() {
    if (pending) return

    if (isPurchase) {
      const ok = await confirm({
        title: courseTitle ? `Get "${courseTitle}"` : 'Get this course',
        message: `${priceLabel ? `${priceLabel}. ` : ''}${DEMO_MESSAGE}`,
        confirmLabel: priceLabel ? `Confirm — ${priceLabel}` : 'Confirm',
        cancelLabel: 'Cancel',
      })
      if (!ok) return
    }

    setPending(true)
    try {
      const endpoint = isPurchase
        ? `/api/courses/${courseId}/purchase`
        : `/api/courses/${courseId}/enroll`
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast({
          type: 'error',
          title: isPurchase ? 'Could not unlock course' : 'Could not enroll',
          description: data?.error ?? 'Please try again.',
        })
        setPending(false)
        return
      }
      toast({
        type: 'success',
        title: isPurchase ? 'Course unlocked' : 'Enrolled',
        description: isPurchase
          ? 'You now have full access (demo — no payment taken).'
          : 'Added to your learning.',
      })
      router.push(destination)
      router.refresh()
    } catch {
      toast({ type: 'error', title: 'Something went wrong', description: 'Please try again.' })
      setPending(false)
    }
  }

  return (
    <button type="button" className={className} onClick={run} disabled={pending}>
      {pending ? pendingLabel : (label ?? defaultLabel)}
    </button>
  )
}
