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
const REFRESH_EVENT = 'notifications:refresh'

/**
 * Nudge the notification poller to reload now (instead of waiting for the 30s
 * tick). Call right after an action that may have created an award notification
 * server-side — e.g. completing a lesson, finishing a quiz, opening a lesson.
 */
export function pingNotifications(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REFRESH_EVENT))
  }
}

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
  // Flips true after the first fetch resolves, so consumers can seed a baseline
  // off the real server response instead of the empty initial state.
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { notifications: NotificationItem[]; unreadCount: number }
      setItems(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // transient — keep last known state
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)

    // Reload on demand after award-generating actions. A second delayed reload
    // covers the brief window where the notification row is still being written
    // (createNotification is fire-and-forget on the server).
    function onRefresh() {
      load()
      setTimeout(load, 1800)
    }
    window.addEventListener(REFRESH_EVENT, onRefresh)

    return () => {
      clearInterval(id)
      window.removeEventListener(REFRESH_EVENT, onRefresh)
    }
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

  return { items, unreadCount, loaded, markRead, markAllRead, reload: load }
}
