import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { MembersClient } from './MembersClient'
import { ImportMembers } from './ImportMembers'
import styles from './page.module.css'

export default async function MembersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgId = session.user.organizationId

  const memberList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(orgId ? eq(users.organizationId, orgId) : sql`1=1`)
    .orderBy(sql`${users.createdAt} desc`)

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Admin</div>
      <div className={styles.header}>
        <h1>Members</h1>
        <span className={styles.count}>{memberList.length} member{memberList.length !== 1 ? 's' : ''}</span>
        <div className={styles.headerActions}>
          <ImportMembers />
        </div>
      </div>

      <MembersClient members={memberList} currentUserId={session.user.id} />
    </div>
  )
}
