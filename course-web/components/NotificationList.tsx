'use client'

import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'
import { relativeTime, type NotificationItem } from '@/components/useNotifications'
import styles from './NotificationList.module.css'

interface NotificationListProps {
  items: NotificationItem[]
  unreadCount: number
  onMarkRead: (ids: string[]) => void
  onMarkAllRead: () => void
  onNavigate?: () => void
}

/** Presentational notification list (used inside the nav menus). No positioning. */
export function NotificationList({
  items,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationListProps) {
  const router = useRouter()

  function handleItemClick(n: NotificationItem) {
    if (!n.readAt) onMarkRead([n.id])
    if (n.link) {
      onNavigate?.()
      router.push(n.link)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>
          Notifications
          {unreadCount > 0 && <span className={styles.count}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </span>
        {unreadCount > 0 && (
          <button type="button" className={styles.markAll} onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className={styles.list}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Icon name="check" size={18} />
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
  )
}
