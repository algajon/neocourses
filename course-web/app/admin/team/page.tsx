import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Icon } from '@/components/Icon'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { teams } from '@/lib/db/schema'
import { buildTeamProgress, getTeamMemberIds } from '@/lib/team-progress'
import { TeamSelector } from './TeamSelector'
import styles from './page.module.css'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatScore(score: number | null) {
  return score == null ? '—' : `${score}%`
}

interface PageProps {
  searchParams: Promise<{ team?: string }>
}

export default async function TeamProgressPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, organizationId } = session.user
  if (role !== 'admin' && role !== 'owner') redirect('/admin/dashboard')
  if (!organizationId) redirect('/admin/dashboard')

  // Teams in this org, for the selector.
  const orgTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.organizationId, organizationId))

  // Only honor a team id that actually belongs to this org (tenant safety).
  const { team: requestedTeam } = await searchParams
  const selectedTeamId =
    requestedTeam && orgTeams.some((t) => t.id === requestedTeam) ? requestedTeam : null

  const memberIds = selectedTeamId ? await getTeamMemberIds(selectedTeamId) : null
  const { learners, courses } = await buildTeamProgress(organizationId, memberIds)
  const selectedTeamName = orgTeams.find((t) => t.id === selectedTeamId)?.name ?? null

  const totalLearners = learners.length
  const totalAssigned = learners.reduce((s, l) => s + l.coursesAssigned, 0)
  const totalCompleted = learners.reduce((s, l) => s + l.coursesCompleted, 0)
  const completionRate = totalAssigned
    ? Math.round((totalCompleted / totalAssigned) * 1000) / 10
    : 0
  const totalOverdue = learners.reduce((s, l) => s + l.overdueCount, 0)

  const scored = learners.filter((l) => l.avgQuizScore != null)
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, l) => s + (l.avgQuizScore ?? 0), 0) / scored.length) * 10) / 10
    : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.breadcrumb}>Admin</div>
          <h1>Team Progress</h1>
          {selectedTeamName && (
            <div className={styles.scopeNote}>Showing {selectedTeamName}</div>
          )}
        </div>
        <div className={styles.headerActions}>
          {orgTeams.length > 0 && (
            <TeamSelector teams={orgTeams} selectedTeamId={selectedTeamId} />
          )}
          <a
            href={selectedTeamId ? `/api/team-progress/export?team=${selectedTeamId}` : '/api/team-progress/export'}
            className="btn-secondary"
            download
          >
            <Icon name="upload" size={15} />
            <span>Download CSV</span>
          </a>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Icon name="users" size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{totalLearners}</div>
            <div className={styles.statLabel}>Total learners</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Icon name="trendingUp" size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{completionRate}%</div>
            <div className={styles.statLabel}>Completion rate</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Icon name="alertTriangle" size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{totalOverdue}</div>
            <div className={styles.statLabel}>Overdue</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Icon name="target" size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{formatScore(avgScore)}</div>
            <div className={styles.statLabel}>Avg quiz score</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Progress</th>
                <th className={styles.numCol}>Avg score</th>
                <th>Status</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {learners.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {selectedTeamName
                      ? `No learners in ${selectedTeamName} yet.`
                      : 'No learners in your organization yet.'}
                  </td>
                </tr>
              ) : (
                learners.map((l) => {
                  const pct = l.coursesAssigned
                    ? Math.round((l.coursesCompleted / l.coursesAssigned) * 100)
                    : 0
                  return (
                    <tr key={l.userId}>
                      <td>
                        <div className={styles.learnerName}>{l.name}</div>
                        <div className={styles.learnerEmail}>{l.email}</div>
                      </td>
                      <td className={styles.progressCell}>
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className={styles.progressMeta}>
                          {l.coursesCompleted} / {l.coursesAssigned} courses
                        </div>
                      </td>
                      <td className={styles.numCol}>{formatScore(l.avgQuizScore)}</td>
                      <td>
                        {l.overdueCount > 0 ? (
                          <span className="pill pill-error">
                            {l.overdueCount} overdue
                          </span>
                        ) : (
                          <span className="pill pill-success">On track</span>
                        )}
                      </td>
                      <td className={styles.lastActive}>{formatDate(l.lastActiveAt)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>By course</h2>
      <div className="card">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Course</th>
                <th className={styles.numCol}>Enrolled</th>
                <th className={styles.numCol}>Completed</th>
                <th>Completion</th>
                <th className={styles.numCol}>Avg score</th>
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No courses in your organization yet.
                  </td>
                </tr>
              ) : (
                courses.map((c) => (
                  <tr key={c.courseId}>
                    <td className={styles.learnerName}>{c.title}</td>
                    <td className={styles.numCol}>{c.enrolled}</td>
                    <td className={styles.numCol}>{c.completed}</td>
                    <td className={styles.progressCell}>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${c.completionRate}%` }}
                        />
                      </div>
                      <div className={styles.progressMeta}>{c.completionRate}%</div>
                    </td>
                    <td className={styles.numCol}>{formatScore(c.avgScore)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
