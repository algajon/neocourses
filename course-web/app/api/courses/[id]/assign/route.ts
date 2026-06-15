import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { v4 as uuidv4 } from 'uuid'
import { eq, and, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, teamMembers, teams, users } from '@/lib/db/schema'
import { createNotification } from '@/lib/notify'

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
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = session.user.organizationId
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.organizationId !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : []
    const teamId: string | undefined = typeof body?.teamId === 'string' ? body.teamId : undefined
    const required = body?.required === true
    const dueAt = typeof body?.dueAt === 'string' && body.dueAt ? new Date(body.dueAt) : null

    if (dueAt && isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
    }

    const targetIds = new Set<string>(userIds)

    if (teamId) {
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
      if (!team || team.organizationId !== orgId) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 })
      }
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
      members.forEach((m) => targetIds.add(m.userId))
    }

    if (targetIds.size === 0) {
      return NextResponse.json({ error: 'No targets selected' }, { status: 400 })
    }

    // Restrict to users that belong to this org.
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, [...targetIds]), eq(users.organizationId, orgId)))
    const validIds = orgUsers.map((u) => u.id)

    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid targets' }, { status: 400 })
    }

    const existing = await db
      .select({ userId: enrollments.userId })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, params.id), inArray(enrollments.userId, validIds)))
    const alreadyEnrolled = new Set(existing.map((e) => e.userId))

    const toAssign = validIds.filter((uid) => !alreadyEnrolled.has(uid))

    let assignedCount = 0
    for (const userId of toAssign) {
      await db.insert(enrollments).values({
        id: uuidv4(),
        userId,
        courseId: params.id,
        enrolledAt: new Date(),
        progressPercent: 0,
        status: 'in_progress',
        assignedById: session.user.id,
        dueAt,
        required,
      })

      await createNotification({
        userId,
        type: 'assignment',
        title: 'New course assigned',
        body: course.title,
        link: '/learn/' + params.id,
      })
      assignedCount++
    }

    return NextResponse.json({
      success: true,
      assigned: assignedCount,
      skipped: validIds.length - assignedCount,
    })
  } catch (error) {
    console.error('[POST /api/courses/[id]/assign]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
