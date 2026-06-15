'use client'

import { useRouter } from 'next/navigation'

interface StatusFilterProps {
  statuses: string[]
  current?: string
  className?: string
}

export function StatusFilter({ statuses, current, className }: StatusFilterProps) {
  const router = useRouter()
  return (
    <select
      className={className}
      defaultValue={current ?? ''}
      onChange={(e) => {
        const v = e.target.value
        router.push(v ? `/admin/courses?status=${v}` : '/admin/courses')
      }}
    >
      <option value="">All statuses</option>
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  )
}
