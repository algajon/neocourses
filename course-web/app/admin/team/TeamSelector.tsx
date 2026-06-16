'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface TeamOption {
  id: string
  name: string
}

interface TeamSelectorProps {
  teams: TeamOption[]
  selectedTeamId: string | null
}

/** Scopes the Team Progress analytics to a team (or all members) via ?team=. */
export function TeamSelector({ teams, selectedTeamId }: TeamSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('team', value)
    else params.delete('team')
    const qs = params.toString()
    router.push(qs ? `/admin/team?${qs}` : '/admin/team')
  }

  return (
    <label className={styles.teamSelect}>
      <Icon name="users" size={14} />
      <span className={styles.teamSelectLabel}>Viewing</span>
      <select
        value={selectedTeamId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter analytics by team"
      >
        <option value="">All members</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}
