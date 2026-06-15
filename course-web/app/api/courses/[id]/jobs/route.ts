import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { aiGenerationJobs, courses } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

interface RouteParams {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
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

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  if (
    session.user.role !== 'owner' &&
    session.user.role !== 'admin' &&
    course.createdById !== session.user.id
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [job] = await db
    .select()
    .from(aiGenerationJobs)
    .where(eq(aiGenerationJobs.courseId, courseId))
    .orderBy(desc(aiGenerationJobs.createdAt))
    .limit(1)

  if (!job) {
    return NextResponse.json({ error: 'No job found for this course' }, { status: 404 })
  }

  // progress + statusMessage are persisted as JSON in outputData by the worker,
  // since the ai_generation_jobs table has no dedicated columns for them.
  let progress = 0
  let statusMessage: string | null = null
  if (job.outputData) {
    try {
      const parsed = JSON.parse(job.outputData) as {
        progress?: number
        statusMessage?: string
      }
      if (typeof parsed.progress === 'number') progress = parsed.progress
      if (typeof parsed.statusMessage === 'string') statusMessage = parsed.statusMessage
    } catch {
      // Ignore malformed payloads and fall back to defaults.
    }
  }

  return NextResponse.json({
    job: {
      id: job.id,
      courseId: job.courseId,
      status: job.status,
      progress,
      statusMessage,
      error: job.errorMessage ?? null,
      createdAt: job.createdAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
    },
  })
}
