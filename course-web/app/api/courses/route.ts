import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, modules, enrollments } from '@/lib/db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId, role, id: userId } = session.user

    const rows = await db
      .select({
        id: courses.id,
        organizationId: courses.organizationId,
        createdById: courses.createdById,
        title: courses.title,
        description: courses.description,
        status: courses.status,
        courseType: courses.courseType,
        difficultyLevel: courses.difficultyLevel,
        estimatedMinutes: courses.estimatedMinutes,
        thumbnailUrl: courses.thumbnailUrl,
        tags: courses.tags,
        certificateEnabled: courses.certificateEnabled,
        passingScore: courses.passingScore,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        publishedAt: courses.publishedAt,
      })
      .from(courses)
      .where(
        role === 'learner'
          ? eq(courses.status, 'published')
          : eq(courses.organizationId, organizationId ?? '')
      )
      .orderBy(desc(courses.createdAt))

    const courseIds = rows.map((r) => r.id)

    const moduleCounts = courseIds.length
      ? await db
          .select({ courseId: modules.courseId, total: count(modules.id) })
          .from(modules)
          .where(sql`${modules.courseId} IN ${courseIds}`)
          .groupBy(modules.courseId)
      : []

    const enrollmentCounts = courseIds.length
      ? await db
          .select({ courseId: enrollments.courseId, total: count(enrollments.id) })
          .from(enrollments)
          .where(sql`${enrollments.courseId} IN ${courseIds}`)
          .groupBy(enrollments.courseId)
      : []

    const moduleCountMap = new Map(moduleCounts.map((m) => [m.courseId, m.total]))
    const enrollmentCountMap = new Map(enrollmentCounts.map((e) => [e.courseId, e.total]))

    const result = rows.map((c) => ({
      ...c,
      moduleCount: moduleCountMap.get(c.id) ?? 0,
      enrollmentCount: enrollmentCountMap.get(c.id) ?? 0,
    }))

    return NextResponse.json({ courses: result })
  } catch (error) {
    console.error('[GET /api/courses]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId, id: userId, role } = session.user
    if (role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title,
      description,
      courseType,
      targetAudience,
      difficultyLevel,
      estimatedHours,
      certificateEnabled,
    } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const now = new Date()
    const id = uuidv4()

    await db.insert(courses).values({
      id,
      organizationId: organizationId ?? null,
      createdById: userId,
      title,
      description: description ?? null,
      courseType: courseType ?? 'custom',
      difficultyLevel: difficultyLevel ?? 'beginner',
      estimatedMinutes: estimatedHours != null ? Math.round(estimatedHours * 60) : null,
      certificateEnabled: certificateEnabled ?? false,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await db.select().from(courses).where(eq(courses.id, id)).limit(1)
    return NextResponse.json({ course: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/courses]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
