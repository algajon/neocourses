import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { aiTutorMessages } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

interface RouteParams {
  params: { courseId: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const messages = await db
    .select()
    .from(aiTutorMessages)
    .where(
      and(
        eq(aiTutorMessages.courseId, params.courseId),
        eq(aiTutorMessages.userId, session.user.id),
      ),
    )
    .orderBy(aiTutorMessages.createdAt)

  return NextResponse.json({
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
  })
}
