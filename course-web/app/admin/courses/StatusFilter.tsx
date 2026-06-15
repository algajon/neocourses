'use client'

import Link from 'next/link'

interface StatusFilterProps {
  statuses: string[]
  current?: string
  query?: string
  className?: string
}

function buildHref(status: string | null, query?: string) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (query) params.set('q', query)
  const qs = params.toString()
  return qs ? `/admin/courses?${qs}` : '/admin/courses'
}

export function StatusFilter({ statuses, current, query, className }: StatusFilterProps) {
  const tabs = [{ value: '', label: 'All' }, ...statuses.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]
  return (
    <div className={className} role="tablist">
      {tabs.map((tab) => {
        const active = (current ?? '') === tab.value
        return (
          <Link
            key={tab.value || 'all'}
            href={buildHref(tab.value || null, query)}
            className={active ? 'pill pill-accent' : 'pill pill-draft'}
            aria-selected={active}
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
