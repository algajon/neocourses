'use client'

import { useState, FormEvent } from 'react'
import styles from './page.module.css'

interface Member {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date | null
  lastLoginAt: Date | null
}

interface MembersClientProps {
  members: Member[]
  currentUserId: string
}

const ROLES = ['owner', 'admin', 'reviewer', 'learner']

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

function rolePillClass(role: string) {
  if (role === 'owner') return 'pill pill-success'
  if (role === 'admin') return 'pill pill-info'
  if (role === 'reviewer') return 'pill pill-warning'
  return 'pill pill-draft'
}

export function MembersClient({ members: initialMembers, currentUserId }: MembersClientProps) {
  const [members, setMembers] = useState(initialMembers)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteRole, setInviteRole] = useState('learner')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviting, setInviting] = useState(false)
  const [roleChanging, setRoleChanging] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    if (!inviteName.trim()) {
      setInviteError('Name is required.')
      return
    }
    if (!inviteEmail.trim()) {
      setInviteError('Email is required.')
      return
    }
    if (!invitePassword.trim()) {
      setInviteError('Password is required.')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim(), password: invitePassword.trim(), role: inviteRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to invite member')
      }
      const { member: newMember } = await res.json()
      setMembers((prev) => [newMember, ...prev])
      setInviteName('')
      setInviteEmail('')
      setInvitePassword('')
      setInviteRole('learner')
      setInviteSuccess(`${newMember.name || newMember.email} has been added.`)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setRoleChanging(memberId)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('Failed to update role')
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
    } catch {
      // silently fail — in production would show a toast
    } finally {
      setRoleChanging(null)
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the organization?')) return
    setRemoving(memberId)
    try {
      const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove member')
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      // silently fail
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
      <div className={styles.inviteCard}>
        <h2 className={styles.inviteTitle}>Add New Member</h2>
        {inviteError && <div className={styles.error}>{inviteError}</div>}
        {inviteSuccess && <div className={styles.success}>{inviteSuccess}</div>}
        <form onSubmit={handleInvite} className={styles.inviteForm}>
          <div className={styles.inviteFields}>
            <input
              type="text"
              className="input"
              placeholder="Full name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <input
              type="email"
              className="input"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <input
              type="password"
              className="input"
              placeholder="Password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <select
              className="select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <button type="submit" className="btn-cta" disabled={inviting} style={{ flexShrink: 0 }}>
              {inviting ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>No members found.</td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id}>
                    <td className={styles.nameCell}>
                      {member.name}
                      {member.id === currentUserId && (
                        <span className={styles.youBadge}>you</span>
                      )}
                    </td>
                    <td className={styles.emailCell}>{member.email}</td>
                    <td>
                      {member.id === currentUserId ? (
                        <span className={rolePillClass(member.role)}>{member.role}</span>
                      ) : (
                        <select
                          className={styles.roleSelect}
                          value={member.role}
                          disabled={roleChanging === member.id}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={styles.dateCell}>{formatDate(member.createdAt)}</td>
                    <td className={styles.dateCell}>{formatDate(member.lastLoginAt)}</td>
                    <td className={styles.actionsCell}>
                      {member.id !== currentUserId && (
                        <button
                          className={styles.removeBtn}
                          disabled={removing === member.id}
                          onClick={() => handleRemove(member.id)}
                        >
                          {removing === member.id ? '…' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
