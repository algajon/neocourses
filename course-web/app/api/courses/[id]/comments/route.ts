import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { v4 as uuidv4 } from 'uuid'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, lessonComments, users } from '@/lib/db/schema'

async function loadCourse(courseId: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  return course
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const course = await loadCourse(params.id)
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const lessonId = req.nextUrl.searchParams.get('lessonId')

    const whereClause = lessonId
      ? and(eq(lessonComments.courseId, params.id), eq(lessonComments.lessonId, lessonId))
      : and(eq(lessonComments.courseId, params.id), isNull(lessonComments.lessonId))

    const rows = await db
      .select({
        id: lessonComments.id,
        courseId: lessonComments.courseId,
        lessonId: lessonComments.lessonId,
        authorId: lessonComments.authorId,
        authorName: users.name,
        body: lessonComments.body,
        resolved: lessonComments.resolved,
        createdAt: lessonComments.createdAt,
      })
      .from(lessonComments)
      .leftJoin(users, eq(lessonComments.authorId, users.id))
      .where(whereClause)
      .orderBy(desc(lessonComments.createdAt))

    return NextResponse.json({ comments: rows })
  } catch (error) {
    console.error('[GET /api/courses/[id]/comments]', error)
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

    const course = await loadCourse(params.id)
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await req.json()
    const body = typeof data?.body === 'string' ? data.body.trim() : ''
    const lessonId = typeof data?.lessonId === 'string' && data.lessonId ? data.lessonId : null

    if (!body) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
    }

    const id = uuidv4()
    const createdAt = new Date()

    await db.insert(lessonComments).values({
      id,
      courseId: params.id,
      lessonId,
      authorId: session.user.id,
      body,
      resolved: false,
      createdAt,
    })

    return NextResponse.json({
      comment: {
        id,
        courseId: params.id,
        lessonId,
        authorId: session.user.id,
        authorName: session.user.name,
        body,
        resolved: false,
        createdAt,
      },
    })
  } catch (error) {
    console.error('[POST /api/courses/[id]/comments]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
