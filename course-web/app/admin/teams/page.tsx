import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { eq, sql, desc, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { teams, teamMembers, users } from '@/lib/db/schema'
import { TeamsClient } from './TeamsClient'
import styles from './page.module.css'

export default async function TeamsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role } = session.user
  if (role !== 'admin' && role !== 'owner') redirect('/admin/dashboard')

  const orgId = session.user.organizationId

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
  const memberRows = teamIds.length
    ? await db
        .select()
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, teamIds))
    : []

  const teamsWithMembers = orgTeams.map((t) => ({
    id: t.id,
    name: t.name,
    memberIds: memberRows.filter((m) => m.teamId === t.id).map((m) => m.userId),
  }))

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Admin</div>
      <div className={styles.header}>
        <h1>Teams</h1>
        <span className={styles.count}>
          {orgTeams.length} team{orgTeams.length !== 1 ? 's' : ''}
        </span>
      </div>

      <TeamsClient initialTeams={teamsWithMembers} members={orgMembers} />
    </div>
  )
}
