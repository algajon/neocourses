// Sales / pricing helpers shared across catalog, course detail, enroll/purchase,
// and lesson gating. Payment is a PLACEHOLDER (no real charge) — "purchasing"
// just flips enrollment.paid = true.

export type PricingModel = 'free' | 'paid' | 'first_chapter_free'

export interface PricedCourse {
  pricingModel?: string | null
  priceCents?: number | null
}

export interface AccessEnrollment {
  paid?: boolean | null
}

export function priceModelOf(course: PricedCourse): PricingModel {
  const m = course.pricingModel
  return m === 'paid' || m === 'first_chapter_free' ? m : 'free'
}

/** "$29", "$29.99", or "Free". */
export function formatPrice(cents: number | null | undefined): string {
  const c = cents ?? 0
  if (c <= 0) return 'Free'
  const dollars = c / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

/** Short label for a badge/CTA, e.g. "Free", "$29", "First chapter free". */
export function pricingLabel(course: PricedCourse): string {
  const model = priceModelOf(course)
  if (model === 'free') return 'Free'
  if (model === 'first_chapter_free') return 'First chapter free'
  return formatPrice(course.priceCents)
}

/** Does this enrollment have full access to all chapters? */
export function hasFullAccess(course: PricedCourse, enrollment: AccessEnrollment | null | undefined): boolean {
  const model = priceModelOf(course)
  if (model === 'free') return true
  return !!enrollment?.paid
}

/**
 * Is a lesson locked for this learner? Locked when the course is
 * first_chapter_free, the learner hasn't unlocked (paid), and the lesson is
 * outside the first chapter (module index > 0). Paid courses gate at enrollment,
 * so any enrolled learner there already has access.
 */
export function isLessonLocked(
  course: PricedCourse,
  enrollment: AccessEnrollment | null | undefined,
  moduleIndex: number,
): boolean {
  if (priceModelOf(course) !== 'first_chapter_free') return false
  if (hasFullAccess(course, enrollment)) return false
  return moduleIndex > 0
}

/** Whether a learner can enroll for free (free course or first-chapter-free). */
export function canEnrollFree(course: PricedCourse): boolean {
  return priceModelOf(course) !== 'paid'
}
