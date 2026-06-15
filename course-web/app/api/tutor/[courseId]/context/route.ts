import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, lessons, sourceMaterials } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

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
    .where(and(eq(courses.id, params.courseId), eq(courses.organizationId, session.user.organizationId ?? '')))
    .limit(1)

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const lessonList = await db
    .select({ title: lessons.title })
    .from(lessons)
    .where(eq(lessons.courseId, params.courseId))
    .orderBy(lessons.position)

  const sources = await db
    .select({ fileName: sourceMaterials.fileName, extractedText: sourceMaterials.extractedText })
    .from(sourceMaterials)
    .where(eq(sourceMaterials.courseId, params.courseId))

  const sourceFiles = sources
    .filter(s => (s.extractedText ?? '').trim().length > 0)
    .map(s => s.fileName)

  return NextResponse.json({
    title: course.title,
    lessonTitles: lessonList.map(l => l.title),
    grounded: sourceFiles.length > 0 || lessonList.length > 0,
    sourceFiles,
  })
}
