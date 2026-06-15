import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { lessonNotes } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: { lessonId: string }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lessonId } = params

  const [note] = await db
    .select({ body: lessonNotes.body, updatedAt: lessonNotes.updatedAt })
    .from(lessonNotes)
    .where(and(eq(lessonNotes.userId, session.user.id), eq(lessonNotes.lessonId, lessonId)))
    .limit(1)

  return NextResponse.json({ note: note ?? null })
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lessonId } = params

  const body = await req.json()
  const { courseId, body: noteBody } = body as { courseId: string; body: string }

  if (!courseId) {
    return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })
  }

  const trimmed = typeof noteBody === 'string' ? noteBody.trim() : ''

  const [existing] = await db
    .select({ id: lessonNotes.id })
    .from(lessonNotes)
    .where(and(eq(lessonNotes.userId, session.user.id), eq(lessonNotes.lessonId, lessonId)))
    .limit(1)

  if (!trimmed) {
    if (existing) {
      await db.delete(lessonNotes).where(eq(lessonNotes.id, existing.id))
    }
    return NextResponse.json({ ok: true, updatedAt: null })
  }

  const now = new Date()

  if (existing) {
    await db
      .update(lessonNotes)
      .set({ body: noteBody, updatedAt: now })
      .where(eq(lessonNotes.id, existing.id))
  } else {
    await db.insert(lessonNotes).values({
      id: uuidv4(),
      userId: session.user.id,
      courseId,
      lessonId,
      body: noteBody,
      createdAt: now,
      updatedAt: now,
    })
  }

  return NextResponse.json({ ok: true, updatedAt: now })
}
