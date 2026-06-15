import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, modules, lessons } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const courseModules = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, params.id))
      .orderBy(asc(modules.position))

    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, params.id))
      .orderBy(asc(lessons.position))

    const result = courseModules.map((m) => ({
      ...m,
      lessons: courseLessons.filter((l) => l.moduleId === m.id),
    }))

    return NextResponse.json({ modules: result })
  } catch (error) {
    console.error('[GET /api/courses/[id]/modules]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const body = await req.json()
    const { title, description, order } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const existingModules = await db
      .select({ position: modules.position })
      .from(modules)
      .where(eq(modules.courseId, params.id))

    const nextPosition =
      order ?? (existingModules.length ? Math.max(...existingModules.map((m) => m.position)) + 1 : 0)

    const now = new Date()
    const id = uuidv4()

    await db.insert(modules).values({
      id,
      courseId: params.id,
      title,
      description: description ?? null,
      position: nextPosition,
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await db.select().from(modules).where(eq(modules.id, id)).limit(1)
    return NextResponse.json({ module: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/courses/[id]/modules]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
