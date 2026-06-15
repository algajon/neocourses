'use client'

import { useState, FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
}

interface TeamWithMembers {
  id: string
  name: string
  memberIds: string[]
}

interface TeamsClientProps {
  initialTeams: TeamWithMembers[]
  members: OrgMember[]
}

export function TeamsClient({ initialTeams, members }: TeamsClientProps) {
  const [teams, setTeams] = useState(initialTeams)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialTeams[0]?.id ?? null)
  const [busy, setBusy] = useState(false)

  const memberById = new Map(members.map((m) => [m.id, m]))
  const selected = teams.find((t) => t.id === selectedId) ?? null

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError('')
    const name = newName.trim()
    if (!name) {
      setCreateError('Team name is required.')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create team')
      }
      const { team } = await res.json()
      const created: TeamWithMembers = { id: team.id, name: team.name, memberIds: [] }
      setTeams((prev) => [created, ...prev])
      setSelectedId(created.id)
      setNewName('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  async function patchTeam(teamId: string, payload: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Update failed')
      const { team } = await res.json()
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, name: team.name, memberIds: team.memberIds } : t))
      )
    } catch {
      // silently fail — would surface a toast in production
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(teamId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    await patchTeam(teamId, { name: trimmed })
  }

  async function handleToggleMember(teamId: string, userId: string, isMember: boolean) {
    await patchTeam(teamId, isMember ? { removeUserIds: [userId] } : { addUserIds: [userId] })
  }

  async function handleDelete(teamId: string) {
    if (!confirm('Delete this team? Members keep their enrollments.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setTeams((prev) => {
        const next = prev.filter((t) => t.id !== teamId)
        if (selectedId === teamId) setSelectedId(next[0]?.id ?? null)
        return next
      })
    } catch {
      // silently fail
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.listPanel}>
        <form onSubmit={handleCreate} className={styles.createForm}>
          <input
            type="text"
            className="input"
            placeholder="New team name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-cta" disabled={creating} style={{ flexShrink: 0 }}>
            {creating ? 'Adding…' : 'Create'}
          </button>
        </form>
        {createError && <div className={styles.error}>{createError}</div>}

        <div className={styles.teamList}>
          {teams.length === 0 ? (
            <div className={styles.emptyList}>No teams yet. Create one above.</div>
          ) : (
            teams.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.teamItem} ${selectedId === t.id ? styles.teamItemActive : ''}`}
                onClick={() => setSelectedId(t.id)}
              >
                <span className={styles.teamItemName}>
                  <Icon name="users" size={15} />
                  {t.name}
                </span>
                <span className={styles.teamItemCount}>{t.memberIds.length}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={styles.detailPanel}>
        {!selected ? (
          <div className={styles.detailEmpty}>Select a team to manage its members.</div>
        ) : (
          <TeamDetail
            key={selected.id}
            team={selected}
            members={members}
            memberById={memberById}
            busy={busy}
            onRename={handleRename}
            onToggleMember={handleToggleMember}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}

interface TeamDetailProps {
  team: TeamWithMembers
  members: OrgMember[]
  memberById: Map<string, OrgMember>
  busy: boolean
  onRename: (teamId: string, name: string) => void
  onToggleMember: (teamId: string, userId: string, isMember: boolean) => void
  onDelete: (teamId: string) => void
}

function TeamDetail({ team, members, busy, onRename, onToggleMember, onDelete }: TeamDetailProps) {
  const [nameDraft, setNameDraft] = useState(team.name)
  const memberSet = new Set(team.memberIds)

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <input
          type="text"
          className="input"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft.trim() && nameDraft.trim() !== team.name) onRename(team.id, nameDraft)
          }}
          style={{ flex: 1, fontWeight: 600 }}
        />
        <button
          type="button"
          className={styles.deleteBtn}
          disabled={busy}
          onClick={() => onDelete(team.id)}
        >
          <Icon name="x" size={14} /> Delete
        </button>
      </div>

      <div className={styles.subhead}>
        {team.memberIds.length} member{team.memberIds.length !== 1 ? 's' : ''}
      </div>

      <div className={styles.memberGrid}>
        {members.length === 0 ? (
          <div className={styles.emptyList}>No organization members to add.</div>
        ) : (
          members.map((m) => {
            const isMember = memberSet.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                className={`${styles.memberRow} ${isMember ? styles.memberRowActive : ''}`}
                onClick={() => onToggleMember(team.id, m.id, isMember)}
              >
                <span className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.name}</span>
                  <span className={styles.memberEmail}>{m.email}</span>
                </span>
                <span className={styles.memberToggle}>
                  {isMember ? <Icon name="check" size={16} /> : <span className={styles.addLabel}>Add</span>}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
