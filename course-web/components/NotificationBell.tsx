'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import styles from './NotificationBell.module.css'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 30_000

function relativeTime(iso: string): string {
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

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as {
        notifications: NotificationItem[]
        unreadCount: number
      }
      setItems(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // transient network failure — keep last known state
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setItems(prev =>
      prev.map(n => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    )
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

  const handleItemClick = useCallback(
    async (n: NotificationItem) => {
      if (!n.readAt) await markRead([n.id])
      if (n.link) {
        setOpen(false)
        router.push(n.link)
      }
    },
    [markRead, router],
  )

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.bell}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="info" size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAll} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {items.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <Icon name="check" size={20} />
                </span>
                <p className={styles.emptyText}>You&apos;re all caught up.</p>
              </div>
            ) : (
              items.map(n => {
                const unread = !n.readAt
                const Tag = n.link ? 'button' : 'div'
                return (
                  <Tag
                    key={n.id}
                    className={`${styles.item} ${unread ? styles.itemUnread : ''} ${n.link ? styles.itemClickable : ''}`}
                    onClick={() => handleItemClick(n)}
                    role="menuitem"
                    type={n.link ? 'button' : undefined}
                  >
                    {unread && <span className={styles.dot} aria-hidden="true" />}
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemText}>{n.body}</span>
                      <span className={styles.itemTime}>{relativeTime(n.createdAt)}</span>
                    </span>
                  </Tag>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
