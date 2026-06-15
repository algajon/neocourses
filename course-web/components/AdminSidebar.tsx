'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ThemeToggle } from './ThemeToggle'
import { NotificationList } from './NotificationList'
import { useNotifications } from './useNotifications'
import { Icon } from './Icon'
import styles from './AdminSidebar.module.css'

interface AdminSidebarUser {
  name?: string | null
  email?: string | null
  role?: string
}

interface AdminSidebarProps {
  user: AdminSidebarUser
}

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      </svg>
    ),
  },
  {
    label: 'Courses',
    href: '/admin/courses',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 3.5C2 2.67 2.67 2 3.5 2h9C13.33 2 14 2.67 14 3.5v9c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9Z" stroke="currentColor" strokeWidth="1.25" fill="none" />
        <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Teams',
    href: '/admin/teams',
    icon: <Icon name="users" size={16} />,
  },
  {
    label: 'Team Progress',
    href: '/admin/team',
    icon: <Icon name="barChart" size={16} />,
  },
  {
    label: 'Members',
    href: '/admin/members',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.25" />
        <path d="M1.5 13c0-2.485 2.015-4.5 4.5-4.5S10.5 10.515 10.5 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        <circle cx="11.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.25" opacity=".5" />
        <path d="M13 13c0-1.657-1.12-3.07-2.666-3.44" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity=".5" />
      </svg>
    ),
  },
  {
    label: 'Organization',
    href: '/admin/org',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 2.25a5.75 5.75 0 0 1 4.16 1.72l.42-.42 1.06 1.06-.42.42A5.75 5.75 0 0 1 13.75 8a5.75 5.75 0 0 1-1.72 4.16l.42.42-1.06 1.06-.42-.42A5.75 5.75 0 0 1 8 13.75a5.75 5.75 0 0 1-4.16-1.72l-.42.42-1.06-1.06.42-.42A5.75 5.75 0 0 1 2.25 8a5.75 5.75 0 0 1 1.72-4.16l-.42-.42 1.06-1.06.42.42A5.75 5.75 0 0 1 8 2.25Z" stroke="currentColor" strokeWidth="1.25" />
        <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    ),
  },
]

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { items, unreadCount, markRead, markAllRead } = useNotifications()

  useEffect(() => {
    setOpen(false)
    setNotifOpen(false)
  }, [pathname])

  return (
    <div className={`admin-shell-nav ${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
      <div className={styles.logo}>
        <span className={styles.logoText}>
          course<span className={styles.logoAccent}>neo</span>
        </span>
        <button
          type="button"
          className={styles.mobileToggle}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="admin-nav-panel"
        >
          <Icon name={open ? 'x' : 'menu'} size={18} />
        </button>
      </div>

      <div className={styles.panel} id="admin-nav-panel">
      <div className={styles.navSection} id="admin-nav-label">Workspace</div>
      <nav className={styles.nav} aria-labelledby="admin-nav-label">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/admin/dashboard'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.userIdentity}>
            <span className={styles.userName}>{user.name ?? user.email}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        </div>

        {notifOpen && (
          <div className={styles.notifPanel}>
            <NotificationList
              items={items}
              unreadCount={unreadCount}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onNavigate={() => setNotifOpen(false)}
            />
          </div>
        )}

        <button
          type="button"
          className={styles.footerRow}
          onClick={() => setNotifOpen(o => !o)}
          aria-expanded={notifOpen}
        >
          <Icon name="bell" size={14} />
          Notifications
          {unreadCount > 0 && <span className={styles.footerBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>

        <ThemeToggle variant="menu" className={styles.footerRow} />

        <Link href="/admin/account" className={styles.settingsLink}>
          <Icon name="settings" size={14} />
          Settings
        </Link>
        <button
          className={styles.signOutBtn}
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9.5 9.5 12 7m0 0L9.5 4.5M12 7H5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      </div>
      </div>
    </div>
  )
}
