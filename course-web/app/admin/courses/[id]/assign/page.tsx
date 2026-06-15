import { getServerSession } from 'next-auth/next'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, sql, desc, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, enrollments, teams, teamMembers, users } from '@/lib/db/schema'
import { AssignClient } from './AssignClient'
import styles from './page.module.css'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AssignPage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role } = session.user
  if (role !== 'admin' && role !== 'owner') redirect('/admin/dashboard')

  const orgId = session.user.organizationId
  const { id } = await params

  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1)
  if (!course || (orgId && course.organizationId !== orgId)) notFound()

  const orgMembers = orgId
    ? await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.organizationId, orgId))
        .orderBy(sql`${users.name} asc`)
    : []

  const orgTeams = orgId
    ? await db
        .select()
        .from(teams)
        .where(eq(teams.organizationId, orgId))
        .orderBy(desc(teams.createdAt))
    : []

  const teamIds = orgTeams.map((t) => t.id)
  const teamMemberRows = teamIds.length
    ? await db.select().from(teamMembers).where(inArray(teamMembers.teamId, teamIds))
    : []

  const teamsWithCounts = orgTeams.map((t) => ({
    id: t.id,
    name: t.name,
    memberCount: teamMemberRows.filter((m) => m.teamId === t.id).length,
  }))

  const existingEnrollments = await db
    .select({ userId: enrollments.userId, required: enrollments.required, dueAt: enrollments.dueAt })
    .from(enrollments)
    .where(eq(enrollments.courseId, id))

  const assignedById = new Map(orgMembers.map((m) => [m.id, m]))
  const assigned = existingEnrollments
    .map((e) => {
      const member = assignedById.get(e.userId)
      return member
        ? { id: member.id, name: member.name, email: member.email, required: e.required, dueAt: e.dueAt }
        : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const assignedIds = existingEnrollments.map((e) => e.userId)

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/admin/courses" className={styles.crumbLink}>Courses</Link>
        <span>/</span>
        <Link href={`/admin/courses/${id}`} className={styles.crumbLink}>{course.title}</Link>
        <span>/</span>
        <span>Assign</span>
      </div>
      <div className={styles.header}>
        <h1>Assign “{course.title}”</h1>
      </div>

      <AssignClient
        courseId={id}
        members={orgMembers}
        teams={teamsWithCounts}
        initialAssigned={assigned}
        initialAssignedIds={assignedIds}
      />
    </div>
  )
}
