import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { eq, and } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { teams } from '@/lib/db/schema'
import { buildTeamProgress, getTeamMemberIds } from '@/lib/team-progress'

function csvCell(value: string | number | null): string {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, organizationId } = session.user
    if (role !== 'admin' && role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // Scope to a team only if it belongs to the caller's org (tenant safety).
    const teamId = req.nextUrl.searchParams.get('team')
    let memberIds: string[] | null = null
    if (teamId) {
      const [t] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, teamId), eq(teams.organizationId, organizationId)))
        .limit(1)
      memberIds = t ? await getTeamMemberIds(teamId) : []
    }

    const { learners, courses } = await buildTeamProgress(organizationId, memberIds)

    const lines: string[] = []
    lines.push('Learners')
    lines.push(
      ['Name', 'Email', 'Courses Assigned', 'Courses Completed', 'Avg Quiz Score', 'Overdue', 'Last Active']
        .map(csvCell)
        .join(',')
    )
    for (const l of learners) {
      lines.push(
        [
          l.name,
          l.email,
          l.coursesAssigned,
          l.coursesCompleted,
          l.avgQuizScore == null ? '' : l.avgQuizScore,
          l.overdueCount,
          l.lastActiveAt ?? '',
        ]
          .map(csvCell)
          .join(',')
      )
    }

    lines.push('')
    lines.push('Courses')
    lines.push(
      ['Course', 'Enrolled', 'Completed', 'Completion Rate %', 'Avg Score'].map(csvCell).join(',')
    )
    for (const c of courses) {
      lines.push(
        [c.title, c.enrolled, c.completed, c.completionRate, c.avgScore == null ? '' : c.avgScore]
          .map(csvCell)
          .join(',')
      )
    }

    const csv = lines.join('\n')
    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="team-progress-${stamp}.csv"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/team-progress/export]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
