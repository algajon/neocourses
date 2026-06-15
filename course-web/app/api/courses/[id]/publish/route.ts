import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role === 'learner' || role === 'reviewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [existing] = await db
      .select({ id: courses.id, status: courses.status, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const now = new Date()
    await db
      .update(courses)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(eq(courses.id, params.id))

    const [updated] = await db.select().from(courses).where(eq(courses.id, params.id)).limit(1)
    return NextResponse.json({ course: updated })
  } catch (error) {
    console.error('[POST /api/courses/[id]/publish]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role === 'learner' || role === 'reviewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [existing] = await db
      .select({ id: courses.id, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!existing || existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const now = new Date()
    await db
      .update(courses)
      .set({ status: 'ready', updatedAt: now })
      .where(eq(courses.id, params.id))

    const [updated] = await db.select().from(courses).where(eq(courses.id, params.id)).limit(1)
    return NextResponse.json({ course: updated })
  } catch (error) {
    console.error('[DELETE /api/courses/[id]/publish]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
