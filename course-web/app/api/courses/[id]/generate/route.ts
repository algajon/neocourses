import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, sourceMaterials, aiGenerationJobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { enqueueCourseGeneration } from '@/lib/queue'

interface RouteParams {
  params: { id: string }
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: courseId } = params

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  if (
    session.user.role !== 'owner' &&
    session.user.role !== 'admin' &&
    course.createdById !== session.user.id
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const materials = await db
    .select({ id: sourceMaterials.id })
    .from(sourceMaterials)
    .where(eq(sourceMaterials.courseId, courseId))

  if (materials.length === 0) {
    return NextResponse.json(
      { error: 'Course has no source materials' },
      { status: 400 },
    )
  }

  const jobId = uuidv4()
  const now = new Date()

  await db.insert(aiGenerationJobs).values({
    id: jobId,
    courseId,
    jobType: 'course_generation',
    status: 'pending',
    outputData: JSON.stringify({ progress: 0, statusMessage: 'Queued' }),
    createdAt: now,
  })

  await db
    .update(courses)
    .set({ status: 'processing', updatedAt: now })
    .where(eq(courses.id, courseId))

  await enqueueCourseGeneration({ courseId, jobId })

  return NextResponse.json({ jobId }, { status: 202 })
}
