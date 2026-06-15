'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast/ToastProvider'
import styles from './page.module.css'

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
}

interface TeamOption {
  id: string
  name: string
  memberCount: number
}

interface AssignedRow {
  id: string
  name: string
  email: string
  required: boolean | null
  dueAt: Date | string | null
}

interface AssignClientProps {
  courseId: string
  members: OrgMember[]
  teams: TeamOption[]
  initialAssigned: AssignedRow[]
  initialAssignedIds: string[]
}

function formatDate(d: Date | string | null) {
  if (!d) return null
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function AssignClient({
  courseId,
  members,
  teams,
  initialAssigned,
  initialAssignedIds,
}: AssignClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [teamId, setTeamId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [required, setRequired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const assignedIds = new Set(initialAssignedIds)

  function toggleUser(id: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAssign() {
    setError('')
    setSuccess('')
    if (selectedUsers.size === 0 && !teamId) {
      setError('Select at least one learner or a team.')
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { required }
      if (selectedUsers.size) payload.userIds = [...selectedUsers]
      if (teamId) payload.teamId = teamId
      if (dueAt) payload.dueAt = new Date(dueAt).toISOString()

      const res = await fetch(`/api/courses/${courseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Assignment failed')
      }
      const data = await res.json()
      const summary =
        `Assigned to ${data.assigned} learner${data.assigned !== 1 ? 's' : ''}` +
        (data.skipped ? ` (${data.skipped} already enrolled)` : '') + '.'
      setSuccess(summary)
      toast({ type: 'success', title: 'Course assigned', description: summary })
      setSelectedUsers(new Set())
      setTeamId('')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      toast({ type: 'error', title: 'Assignment failed', description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.formPanel}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Learners</div>
          <div className={styles.memberGrid}>
            {members.length === 0 ? (
              <div className={styles.empty}>No members in this organization.</div>
            ) : (
              members.map((m) => {
                const already = assignedIds.has(m.id)
                const checked = selectedUsers.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={already}
                    className={`${styles.memberRow} ${checked ? styles.memberRowActive : ''} ${
                      already ? styles.memberRowDisabled : ''
                    }`}
                    onClick={() => toggleUser(m.id)}
                  >
                    <span className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.name}</span>
                      <span className={styles.memberEmail}>{m.email}</span>
                    </span>
                    <span className={styles.memberToggle}>
                      {already ? (
                        <span className={styles.assignedTag}>Assigned</span>
                      ) : checked ? (
                        <Icon name="check" size={16} />
                      ) : (
                        <span className={styles.addLabel}>Select</span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Or assign a whole team</div>
          <select
            className="select"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.memberCount} member{t.memberCount !== 1 ? 's' : ''})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.optionsRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="dueAt">Due date</label>
            <input
              id="dueAt"
              type="date"
              className="input"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <span>Mark as required</span>
          </label>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <button
          type="button"
          className="btn-cta"
          disabled={submitting}
          onClick={handleAssign}
        >
          {submitting ? 'Assigning…' : 'Assign course'}
        </button>
      </div>

      <div className={styles.assignedPanel}>
        <div className={styles.sectionLabel}>
          Already assigned ({initialAssigned.length})
        </div>
        {initialAssigned.length === 0 ? (
          <div className={styles.empty}>No one is assigned yet.</div>
        ) : (
          <div className={styles.assignedList}>
            {initialAssigned.map((a) => {
              const due = formatDate(a.dueAt)
              return (
                <div key={a.id} className={styles.assignedItem}>
                  <span className={styles.memberInfo}>
                    <span className={styles.memberName}>{a.name}</span>
                    <span className={styles.memberEmail}>{a.email}</span>
                  </span>
                  <span className={styles.assignedMeta}>
                    {a.required && <span className="pill pill-warning">Required</span>}
                    {due && <span className={styles.dueText}>Due {due}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
