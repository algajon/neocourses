import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, lessons } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface RouteParams {
  params: { courseId: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, params.courseId))
    .limit(1)

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const lessonList = await db
    .select({ title: lessons.title })
    .from(lessons)
    .where(eq(lessons.courseId, params.courseId))
    .orderBy(lessons.position)

  return NextResponse.json({
    title: course.title,
    lessonTitles: lessonList.map(l => l.title),
  })
}
