'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useSession } from 'next-auth/react'
import styles from './page.module.css'

interface OrgData {
  id: string
  name: string
  slug: string
}

export default function OrgSettingsPage() {
  const { data: session } = useSession()
  const [org, setOrg] = useState<OrgData | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch('/api/org')
        if (!res.ok) throw new Error('Failed to load organization')
        const data: OrgData = await res.json()
        setOrg(data)
        setName(data.name)
      } catch (err) {
        setError('Could not load organization settings.')
      } finally {
        setLoading(false)
      }
    }
    loadOrg()
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Organization name is required.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }
      const updated: OrgData = await res.json()
      setOrg(updated)
      setName(updated.name)
      setSuccess('Organization settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Admin / Settings</div>
      <div className={styles.header}>
        <h1>Organization</h1>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>General</h2>
          <p className={styles.cardDesc}>Basic information about your organization.</p>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Loading…</div>
        ) : (
          <form onSubmit={handleSave} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <div className={styles.field}>
              <label htmlFor="org-name" className="label">Organization Name</label>
              <input
                id="org-name"
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="org-slug" className="label">
                Slug
                <span className={styles.readOnly}>read-only</span>
              </label>
              <input
                id="org-slug"
                className="input"
                type="text"
                value={org?.slug ?? ''}
                readOnly
                disabled
              />
              <span className={styles.hint}>The URL-friendly identifier for your organization. Cannot be changed after creation.</span>
            </div>

            <div className={styles.formFooter}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
