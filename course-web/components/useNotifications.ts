'use client'

import { useCallback, useEffect, useState } from 'react'

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 30_000

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 45) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  const diffWk = Math.round(diffDay / 7)
  if (diffWk < 5) return `${diffWk}w ago`
  return new Date(iso).toLocaleDateString()
}

/** Shared notification state: list, unread count, read mutations, 30s poll. */
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { notifications: NotificationItem[]; unreadCount: number }
      setItems(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // transient — keep last known state
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [load])

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setItems(prev => prev.map(n => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)))
    setUnreadCount(prev => Math.max(0, prev - ids.length))
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch {
      load()
    }
  }, [load])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setItems(prev => prev.map(n => (n.readAt ? n : { ...n, readAt: now })))
    setUnreadCount(0)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      load()
    }
  }, [load])

  return { items, unreadCount, markRead, markAllRead, reload: load }
}
