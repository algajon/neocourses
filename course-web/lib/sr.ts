/**
 * SM-2-style spaced-repetition scheduler.
 *
 * grade: 0 = again, 1 = hard, 2 = good, 3 = easy.
 * Below-"good" grades (0, 1) reset the interval; "good"/"easy" grow it by ease.
 * Ease is nudged per the classic SM-2 quality response and floored at 1.3.
 */
export function nextReview(
  prev: { ease: number; intervalDays: number },
  grade: 0 | 1 | 2 | 3,
): { ease: number; intervalDays: number; dueAt: Date } {
  const prevEase = prev.ease > 0 ? prev.ease : 2.5
  const prevInterval = prev.intervalDays > 0 ? prev.intervalDays : 0

  // SM-2 quality on a 0–5 scale; map our 0–3 grades onto it.
  const quality = [2, 3, 4, 5][grade]
  let ease = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease < 1.3) ease = 1.3

  let intervalDays: number
  if (grade === 0) {
    // Failed recall — see it again today.
    intervalDays = 0
  } else if (grade === 1) {
    // Hard — short fixed step.
    intervalDays = 1
  } else if (prevInterval === 0) {
    intervalDays = grade === 3 ? 3 : 1
  } else if (prevInterval === 1) {
    intervalDays = grade === 3 ? 6 : 4
  } else {
    intervalDays = Math.round(prevInterval * ease)
  }

  const dueAt = new Date()
  dueAt.setDate(dueAt.getDate() + intervalDays)

  return { ease, intervalDays, dueAt }
}
