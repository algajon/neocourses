import { randomUUID } from 'crypto'
import { and, eq, count, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  learnerStats,
  learnerBadges,
  lessonProgress,
  quizAttempts,
  enrollments,
} from '@/lib/db/schema'
import type { IconName } from '@/components/Icon'
import { createNotification } from '@/lib/notify'

// ---------------------------------------------------------------------------
// Point values & streak rules
// ---------------------------------------------------------------------------

export const POINTS = {
  lessonComplete: 10,
  quizPass: 25,
} as const

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeDef {
  key: string
  label: string
  description: string
  icon: IconName
}

/**
 * Canonical badge catalog. Order here is the display order on My Learning.
 * `key` is the stable identifier stored in learner_badges.badgeKey.
 */
export const BADGES: BadgeDef[] = [
  {
    key: 'lesson_explorer',
    label: 'Curious Mind',
    description: 'Open your first lesson',
    icon: 'sparkles',
  },
  {
    key: 'first_lesson',
    label: 'First Steps',
    description: 'Complete your first lesson',
    icon: 'play',
  },
  {
    key: 'first_quiz',
    label: 'Quiz Taker',
    description: 'Complete your first quiz',
    icon: 'edit',
  },
  {
    key: 'quiz_ace',
    label: 'Quiz Ace',
    description: 'Score 100% on a quiz',
    icon: 'star',
  },
  {
    key: 'fast_learner',
    label: 'Fast Learner',
    description: 'Complete 10 lessons',
    icon: 'trendingUp',
  },
  {
    key: 'first_course',
    label: 'Course Complete',
    description: 'Finish your first course',
    icon: 'certificate',
  },
  {
    key: 'streak_7',
    label: 'On a Roll',
    description: 'Keep a 7-day learning streak',
    icon: 'target',
  },
]

const BADGE_KEYS = new Set(BADGES.map((b) => b.key))
const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]))

// ---------------------------------------------------------------------------
// Date helpers (UTC calendar days, YYYY-MM-DD)
// ---------------------------------------------------------------------------

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function diffInDays(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`)
  const to = Date.parse(`${toKey}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

// ---------------------------------------------------------------------------
// recordActivity — the single award hook
// ---------------------------------------------------------------------------

export interface ActivityInput {
  // 'lesson_open' is a lightweight event fired when a learner opens a lesson; it
  // grants the explorer badge but does not award points or touch the streak.
  kind: 'lesson' | 'quiz' | 'lesson_open'
  // score is a 0..1 fraction (matches quizAttempts.score). Only meaningful for quizzes.
  score?: number
  // Whether the quiz attempt passed. Lessons ignore this.
  passed?: boolean
}

/**
 * Best-effort gamification update. Awards points, advances the daily streak, and
 * grants any newly-earned badges. Never throws into the caller — all failures are
 * swallowed and logged, so a gamification hiccup can never break lesson/quiz flow.
 */
export async function recordActivity(
  userId: string,
  activity: ActivityInput,
): Promise<void> {
  try {
    await recordActivityInner(userId, activity)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[gamification] recordActivity failed for user=${userId}: ${detail}`)
  }
}

async function recordActivityInner(userId: string, activity: ActivityInput): Promise<void> {
  const now = new Date()

  // Opening a lesson is not "learning activity" worth points or a streak day — it
  // only unlocks the one-time explorer badge. Handle it before any stats writes.
  if (activity.kind === 'lesson_open') {
    await notifyBadges(userId, await grantBadges(userId, ['lesson_explorer'], now))
    return
  }

  const today = dayKey(now)

  // Quiz points only count on a pass; lessons always count.
  const earned =
    activity.kind === 'lesson'
      ? POINTS.lessonComplete
      : activity.passed
        ? POINTS.quizPass
        : 0

  const [existing] = await db
    .select()
    .from(learnerStats)
    .where(eq(learnerStats.userId, userId))
    .limit(1)

  let currentStreak: number

  if (!existing) {
    currentStreak = 1
    await db.insert(learnerStats).values({
      id: randomUUID(),
      userId,
      points: earned,
      currentStreakDays: 1,
      longestStreakDays: 1,
      lastActivityDate: today,
      updatedAt: now,
    })
  } else {
    const last = existing.lastActivityDate
    if (!last) {
      currentStreak = 1
    } else {
      const gap = diffInDays(last, today)
      if (gap <= 0) {
        // Same day (or clock skew): keep the streak as-is.
        currentStreak = existing.currentStreakDays || 1
      } else if (gap === 1) {
        currentStreak = existing.currentStreakDays + 1
      } else {
        // Missed one or more days: streak resets to today.
        currentStreak = 1
      }
    }

    const longest = Math.max(existing.longestStreakDays, currentStreak)
    await db
      .update(learnerStats)
      .set({
        points: existing.points + earned,
        currentStreakDays: currentStreak,
        longestStreakDays: longest,
        lastActivityDate: today,
        updatedAt: now,
      })
      .where(eq(learnerStats.userId, userId))
  }

  const newlyEarned = await evaluateBadges(userId, activity, currentStreak, now)
  await notifyBadges(userId, newlyEarned)
}

/**
 * Idempotently grants the given badge keys to a learner. The unique
 * (userId, badgeKey) index makes re-awards a no-op; `returning` yields only the
 * rows actually inserted — i.e. badges the learner did not already hold.
 */
async function grantBadges(userId: string, keys: string[], now: Date): Promise<string[]> {
  const rows = [...new Set(keys)]
    .filter((key) => BADGE_KEYS.has(key))
    .map((key) => ({ id: randomUUID(), userId, badgeKey: key, earnedAt: now }))

  if (rows.length === 0) return []

  const inserted = await db
    .insert(learnerBadges)
    .values(rows)
    .onConflictDoNothing()
    .returning({ badgeKey: learnerBadges.badgeKey })

  return inserted.map((r) => r.badgeKey)
}

/** Fires a best-effort in-app notification for each genuinely-earned badge. */
async function notifyBadges(userId: string, earnedKeys: string[]): Promise<void> {
  for (const key of earnedKeys) {
    const badge = BADGE_BY_KEY.get(key)
    if (!badge) continue
    void createNotification({
      userId,
      type: 'badge',
      title: `Achievement unlocked: ${badge.label}`,
      body: badge.description,
      link: '/learn',
    }).catch(() => {})
  }
}

/**
 * Determines which badge keys are newly satisfied and inserts them idempotently.
 * Returns the keys that were actually inserted this call (not previously held), so
 * the caller can notify exactly once per genuinely-earned badge.
 */
async function evaluateBadges(
  userId: string,
  activity: ActivityInput,
  currentStreak: number,
  now: Date,
): Promise<string[]> {
  const toAward = new Set<string>()

  if (activity.kind === 'lesson') {
    toAward.add('first_lesson')

    const [{ value: lessonCount }] = await db
      .select({ value: count() })
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId))

    if (lessonCount >= 10) toAward.add('fast_learner')
  }

  if (activity.kind === 'quiz') {
    // Finishing any quiz (pass or fail) earns the Quiz Taker badge once.
    toAward.add('first_quiz')
    if ((activity.score ?? 0) >= 1) toAward.add('quiz_ace')
  }

  if (currentStreak >= 7) toAward.add('streak_7')

  // first_course: any completed enrollment for this learner.
  const [{ value: completedCourses }] = await db
    .select({ value: count() })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), isNotNull(enrollments.completedAt)))

  if (completedCourses >= 1) toAward.add('first_course')

  return grantBadges(userId, [...toAward], now)
}

// ---------------------------------------------------------------------------
// Read model for the My Learning stats strip
// ---------------------------------------------------------------------------

export interface GamificationSummary {
  points: number
  currentStreakDays: number
  longestStreakDays: number
  earnedBadgeKeys: string[]
}

export async function getGamificationSummary(userId: string): Promise<GamificationSummary> {
  const [stats] = await db
    .select()
    .from(learnerStats)
    .where(eq(learnerStats.userId, userId))
    .limit(1)

  const earned = await db
    .select({ badgeKey: learnerBadges.badgeKey })
    .from(learnerBadges)
    .where(eq(learnerBadges.userId, userId))

  return {
    points: stats?.points ?? 0,
    currentStreakDays: stats?.currentStreakDays ?? 0,
    longestStreakDays: stats?.longestStreakDays ?? 0,
    earnedBadgeKeys: earned.map((e) => e.badgeKey),
  }
}
