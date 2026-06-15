'use client'

import { useState, FormEvent } from 'react'
import { useSession } from 'next-auth/react'
import { Icon } from '@/components/Icon'
import { useToast } from '@/components/Toast/ToastProvider'
import styles from './page.module.css'

interface AccountSettingsFormProps {
  initialName: string
  email: string
}

export function AccountSettingsForm({ initialName, email }: AccountSettingsFormProps) {
  const { update } = useSession()
  const { toast } = useToast()

  const [name, setName] = useState(initialName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  async function handleNameSave(e: FormEvent) {
    e.preventDefault()
    setNameError('')
    setNameSuccess('')
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name cannot be empty.')
      return
    }
    setNameSaving(true)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }
      setName(trimmed)
      setNameSuccess('Display name updated.')
      toast({ type: 'success', title: 'Display name updated' })
      await update({ name: trimmed })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setNameError(msg)
      toast({ type: 'error', title: 'Could not update name', description: msg })
    } finally {
      setNameSaving(false)
    }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')
    if (!currentPassword || !newPassword) {
      setPwError('Current and new password are both required.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to change password')
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess('Password changed.')
      toast({ type: 'success', title: 'Password changed' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setPwError(msg)
      toast({ type: 'error', title: 'Could not change password', description: msg })
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Profile</h2>
          <p className={styles.cardDesc}>Update your display name.</p>
        </div>
        <form onSubmit={handleNameSave} className={styles.form}>
          {nameError && <div className={styles.error}>{nameError}</div>}
          {nameSuccess && (
            <div className={styles.successMsg}>
              <Icon name="check" size={14} />
              {nameSuccess}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="account-name" className="label">Display Name</label>
            <input
              id="account-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="account-email" className="label">
              Email
              <span className={styles.readOnly}>read-only</span>
            </label>
            <input
              id="account-email"
              className="input"
              type="email"
              value={email}
              readOnly
              disabled
            />
          </div>

          <div className={styles.formFooter}>
            <button type="submit" className="btn-primary" disabled={nameSaving}>
              {nameSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Password</h2>
          <p className={styles.cardDesc}>Choose a new password of at least 8 characters.</p>
        </div>
        <form onSubmit={handlePasswordSave} className={styles.form}>
          {pwError && <div className={styles.error}>{pwError}</div>}
          {pwSuccess && (
            <div className={styles.successMsg}>
              <Icon name="check" size={14} />
              {pwSuccess}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="current-password" className="label">Current Password</label>
            <input
              id="current-password"
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="new-password" className="label">New Password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm-password" className="label">Confirm New Password</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className={styles.formFooter}>
            <button type="submit" className="btn-primary" disabled={pwSaving}>
              {pwSaving ? 'Saving…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
