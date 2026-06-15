import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { modules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; moduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [mod] = await db
      .select()
      .from(modules)
      .where(and(eq(modules.id, params.moduleId), eq(modules.courseId, params.id)))
      .limit(1)

    if (!mod) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    return NextResponse.json({ module: mod })
  } catch (error) {
    console.error('[GET /api/courses/[id]/modules/[moduleId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; moduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [existing] = await db
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.id, params.moduleId), eq(modules.courseId, params.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    const body = await req.json()
    const { title, description, order } = body

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (order !== undefined) updates.position = order

    await db.update(modules).set(updates).where(eq(modules.id, params.moduleId))

    const [updated] = await db.select().from(modules).where(eq(modules.id, params.moduleId)).limit(1)
    return NextResponse.json({ module: updated })
  } catch (error) {
    console.error('[PUT /api/courses/[id]/modules/[moduleId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; moduleId: string } }
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
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.id, params.moduleId), eq(modules.courseId, params.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    await db.delete(modules).where(eq(modules.id, params.moduleId))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/courses/[id]/modules/[moduleId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
