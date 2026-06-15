'use client'

import { useState, useMemo, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast/ToastProvider'
import { Icon } from '@/components/Icon'
import styles from './ImportMembers.module.css'

interface ParsedRow {
  name: string
  email: string
  role: string
}

interface ImportError {
  email: string
  reason: string
}

interface ImportSummary {
  created: number
  skipped: number
  errors: ImportError[]
}

interface ImportMembersProps {
  onImported?: () => void
}

const VALID_ROLES = ['owner', 'admin', 'reviewer', 'learner']

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const nameIdx = header.indexOf('name')
  const emailIdx = header.indexOf('email')
  const roleIdx = header.indexOf('role')
  const hasHeader = emailIdx !== -1 || nameIdx !== -1 || roleIdx !== -1
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const cells = splitCsvLine(line)
    if (hasHeader) {
      return {
        name: (nameIdx !== -1 ? cells[nameIdx] : '')?.trim() ?? '',
        email: (emailIdx !== -1 ? cells[emailIdx] : '')?.trim() ?? '',
        role: (roleIdx !== -1 ? cells[roleIdx] : '')?.trim() ?? '',
      }
    }
    return {
      name: cells[0]?.trim() ?? '',
      email: cells[1]?.trim() ?? '',
      role: cells[2]?.trim() ?? '',
    }
  })
}

export function ImportMembers({ onImported }: ImportMembersProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const parsed = useMemo(() => parseCsv(csv), [csv])
  const validCount = parsed.filter(
    (r) => r.email && (!r.role || VALID_ROLES.includes(r.role.toLowerCase()))
  ).length

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ''))
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleSubmit() {
    if (parsed.length === 0) {
      toast({ type: 'error', title: 'Nothing to import', description: 'Add at least one row.' })
      return
    }
    setSubmitting(true)
    setSummary(null)
    try {
      const res = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Import failed')
      }
      const result: ImportSummary = await res.json()
      setSummary(result)
      toast({
        type: result.errors.length > 0 ? 'info' : 'success',
        title: `Imported ${result.created} member${result.created !== 1 ? 's' : ''}`,
        description: `${result.skipped} skipped, ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}.`,
      })
      if (result.created > 0) {
        if (onImported) onImported()
        else router.refresh()
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button className={styles.trigger} onClick={() => setOpen(true)}>
        <Icon name="upload" size={14} />
        Import CSV
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.title}>Import members from CSV</h2>
        <button className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      <p className={styles.hint}>
        Paste or upload a CSV with a header row: <code>name,email,role</code>. Role is optional and
        defaults to <code>learner</code>. Duplicate emails already in your organization are skipped.
      </p>

      <div className={styles.controls}>
        <label className={styles.fileBtn}>
          <Icon name="upload" size={14} />
          Choose file
          <input type="file" accept=".csv,text/csv" onChange={handleFile} hidden />
        </label>
        <span className={styles.parseInfo}>
          {parsed.length > 0
            ? `${parsed.length} row${parsed.length !== 1 ? 's' : ''} parsed · ${validCount} ready`
            : 'No rows yet'}
        </span>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={'name,email,role\nAda Lovelace,ada@acme.com,learner\nGrace Hopper,grace@acme.com,reviewer'}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={6}
        spellCheck={false}
      />

      {parsed.length > 0 && (
        <div className={styles.previewWrap}>
          <table className={styles.previewTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {parsed.slice(0, 50).map((r, i) => {
                const badRole = !!r.role && !VALID_ROLES.includes(r.role.toLowerCase())
                return (
                  <tr key={i} className={!r.email || badRole ? styles.badRow : undefined}>
                    <td>{r.name || '—'}</td>
                    <td>{r.email || <span className={styles.flag}>missing</span>}</td>
                    <td>
                      {badRole ? (
                        <span className={styles.flag}>{r.role} (invalid)</span>
                      ) : (
                        r.role || 'learner'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {parsed.length > 50 && (
            <div className={styles.more}>…and {parsed.length - 50} more</div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button className="btn-secondary" onClick={() => setCsv('')} disabled={submitting || !csv}>
          Clear
        </button>
        <button className="btn-cta" onClick={handleSubmit} disabled={submitting || parsed.length === 0}>
          {submitting ? 'Importing…' : `Import ${parsed.length || ''} member${parsed.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {summary && (
        <div className={styles.report}>
          <div className={styles.reportStats}>
            <span className={styles.statCreated}>{summary.created} created</span>
            <span className={styles.statSkipped}>{summary.skipped} skipped</span>
            <span className={summary.errors.length ? styles.statError : styles.statSkipped}>
              {summary.errors.length} error{summary.errors.length !== 1 ? 's' : ''}
            </span>
          </div>
          {summary.errors.length > 0 && (
            <ul className={styles.errorList}>
              {summary.errors.map((e, i) => (
                <li key={i}>
                  <strong>{e.email || '(no email)'}</strong>: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
