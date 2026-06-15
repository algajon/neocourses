import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  courses,
  modules,
  lessons,
  quizzes,
  sourceMaterials,
  enrollments,
  lessonProgress,
  onboardingChecklists,
  checklistItems,
  checklistProgress,
  aiGenerationJobs,
  aiTutorMessages,
  certificates,
  quizAttempts,
  quizQuestions,
} from '@/lib/db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'

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
      .select()
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

    const courseQuizzes = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, params.id))

    const modulesWithContent = courseModules.map((m) => ({
      ...m,
      lessons: courseLessons.filter((l) => l.moduleId === m.id),
      quizzes: courseQuizzes.filter((q) => q.moduleId === m.id),
    }))

    return NextResponse.json({ course: { ...course, modules: modulesWithContent } })
  } catch (error) {
    console.error('[GET /api/courses/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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

    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      title,
      description,
      courseType,
      difficultyLevel,
      estimatedHours,
      certificateEnabled,
      status,
    } = body

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (courseType !== undefined) updates.courseType = courseType
    if (difficultyLevel !== undefined) updates.difficultyLevel = difficultyLevel
    if (estimatedHours !== undefined) updates.estimatedMinutes = Math.round(estimatedHours * 60)
    if (certificateEnabled !== undefined) updates.certificateEnabled = certificateEnabled
    if (status !== undefined) updates.status = status

    await db.update(courses).set(updates).where(eq(courses.id, params.id))

    const [updated] = await db.select().from(courses).where(eq(courses.id, params.id)).limit(1)
    return NextResponse.json({ course: updated })
  } catch (error) {
    console.error('[PUT /api/courses/[id]]', error)
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
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const moduleIds = (
      await db
        .select({ id: modules.id })
        .from(modules)
        .where(eq(modules.courseId, params.id))
    ).map((m) => m.id)

    const lessonIds = (
      await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.courseId, params.id))
    ).map((l) => l.id)

    const quizIds = (
      await db
        .select({ id: quizzes.id })
        .from(quizzes)
        .where(eq(quizzes.courseId, params.id))
    ).map((q) => q.id)

    const checklistIds = (
      await db
        .select({ id: onboardingChecklists.id })
        .from(onboardingChecklists)
        .where(eq(onboardingChecklists.courseId, params.id))
    ).map((c) => c.id)

    const checklistItemIds = checklistIds.length
      ? (
          await db
            .select({ id: checklistItems.id })
            .from(checklistItems)
            .where(inArray(checklistItems.checklistId, checklistIds))
        ).map((i) => i.id)
      : []

    if (checklistItemIds.length) {
      await db
        .delete(checklistProgress)
        .where(inArray(checklistProgress.checklistItemId, checklistItemIds))
    }

    if (quizIds.length) {
      await db.delete(quizAttempts).where(inArray(quizAttempts.quizId, quizIds))
      await db.delete(quizQuestions).where(inArray(quizQuestions.quizId, quizIds))
    }

    await db.delete(aiTutorMessages).where(eq(aiTutorMessages.courseId, params.id))
    await db.delete(certificates).where(eq(certificates.courseId, params.id))
    await db.delete(aiGenerationJobs).where(eq(aiGenerationJobs.courseId, params.id))
    await db.delete(lessonProgress).where(eq(lessonProgress.courseId, params.id))

    if (lessonIds.length) {
      await db.delete(lessons).where(inArray(lessons.id, lessonIds))
    }

    if (quizIds.length) {
      await db.delete(quizzes).where(inArray(quizzes.id, quizIds))
    }

    if (moduleIds.length) {
      await db.delete(modules).where(inArray(modules.id, moduleIds))
    }

    if (checklistIds.length) {
      await db.delete(checklistItems).where(inArray(checklistItems.checklistId, checklistIds))
      await db
        .delete(onboardingChecklists)
        .where(inArray(onboardingChecklists.id, checklistIds))
    }

    await db.delete(enrollments).where(eq(enrollments.courseId, params.id))
    await db.delete(sourceMaterials).where(eq(sourceMaterials.courseId, params.id))
    await db.delete(courses).where(eq(courses.id, params.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/courses/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
