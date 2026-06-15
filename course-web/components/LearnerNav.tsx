'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationList } from '@/components/NotificationList'
import { useNotifications } from '@/components/useNotifications'
import { Icon } from '@/components/Icon'
import styles from './LearnerNav.module.css'

interface LearnerNavProps {
  user: {
    name: string
    email: string
    role: string
  }
}

const LINKS = [
  { href: '/learn', label: 'My Learning' },
  { href: '/learn/catalog', label: 'Catalog' },
  { href: '/learn/certificates', label: 'Certificates' },
]

export function LearnerNav({ user }: LearnerNavProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { items, unreadCount, markRead, markAllRead } = useNotifications()

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  function isActive(href: string) {
    if (href === '/learn') return pathname === '/learn'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className={styles.nav} aria-label="Primary">
      <div className={styles.navInner}>
        <div className={styles.navLeft}>
          <button
            type="button"
            className={styles.navToggle}
            onClick={() => setNavOpen(o => !o)}
            aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={navOpen}
            aria-controls="learner-nav-links"
          >
            <Icon name={navOpen ? 'x' : 'menu'} size={18} />
          </button>
          <Link href="/learn" className={styles.wordmark} aria-label="courseneo home">
            course<span className={styles.neo}>neo</span>
          </Link>
          <div
            id="learner-nav-links"
            className={`${styles.links} ${navOpen ? styles.linksOpen : ''}`}
          >
            {LINKS.map(link => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? styles.linkActive : styles.link}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setNavOpen(false)}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
        <div className={styles.navRight}>
          <div className={styles.userMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.userTrigger}
              onClick={() => setMenuOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className={styles.userAvatar}>
                {user.name?.[0]?.toUpperCase() ?? 'U'}
                {unreadCount > 0 && <span className={styles.avatarDot} aria-label={`${unreadCount} unread notifications`} />}
              </span>
              <span className={styles.userName}>{user.name}</span>
            </button>
            {menuOpen && (
              <div className={styles.dropdown} role="menu">
                <div className={styles.dropdownHeader}>
                  <span className={styles.dropdownName}>{user.name}</span>
                  <span className={styles.dropdownEmail}>{user.email}</span>
                </div>

                <div className={styles.notifSection}>
                  <NotificationList
                    items={items}
                    unreadCount={unreadCount}
                    onMarkRead={markRead}
                    onMarkAllRead={markAllRead}
                    onNavigate={() => setMenuOpen(false)}
                  />
                </div>

                <div className={styles.menuDivider} />

                <ThemeToggle variant="menu" className={styles.menuLink} />

                <Link
                  href="/settings"
                  className={styles.menuLink}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="settings" size={14} />
                  Settings
                </Link>
                <button
                  type="button"
                  className={styles.signOut}
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
