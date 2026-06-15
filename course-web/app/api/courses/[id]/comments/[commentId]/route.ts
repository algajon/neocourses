import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { eq, and } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, lessonComments } from '@/lib/db/schema'

async function loadComment(courseId: string, commentId: string) {
  const [comment] = await db
    .select()
    .from(lessonComments)
    .where(and(eq(lessonComments.id, commentId), eq(lessonComments.courseId, courseId)))
    .limit(1)
  return comment
}

async function loadCourse(courseId: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  return course
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
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

    const comment = await loadComment(params.id, params.commentId)
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const data = await req.json()
    if (typeof data?.resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 })
    }

    await db
      .update(lessonComments)
      .set({ resolved: data.resolved })
      .where(eq(lessonComments.id, params.commentId))

    return NextResponse.json({ comment: { ...comment, resolved: data.resolved } })
  } catch (error) {
    console.error('[PATCH /api/courses/[id]/comments/[commentId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
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

    const comment = await loadComment(params.id, params.commentId)
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const isAuthor = comment.authorId === session.user.id
    const isAdmin = session.user.role === 'admin' || session.user.role === 'owner'
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.delete(lessonComments).where(eq(lessonComments.id, params.commentId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/courses/[id]/comments/[commentId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
