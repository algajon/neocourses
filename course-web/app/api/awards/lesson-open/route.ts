import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { recordActivity } from '@/lib/gamification'

/**
 * Lightweight "lesson opened" signal. Awards the one-time explorer badge (and
 * its in-app notification) the first time a learner opens any lesson. Idempotent
 * and best-effort — re-opening lessons is a no-op. Returns immediately.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await recordActivity(session.user.id, { kind: 'lesson_open' })

  return NextResponse.json({ ok: true })
}
