'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Icon, type IconName } from '@/components/Icon'
import styles from './CommandPalette.module.css'

interface CommandItem {
  id: string
  label: string
  hint?: string
  group: string
  icon: IconName
  run: () => void
}

interface CourseLite {
  id: string
  title: string
}

const LEARNER_NAV: Array<{ label: string; href: string; icon: IconName }> = [
  { label: 'My Learning', href: '/learn', icon: 'book' },
  { label: 'Catalog', href: '/learn/catalog', icon: 'folder' },
  { label: 'Certificates', href: '/learn/certificates', icon: 'certificate' },
  { label: 'Settings', href: '/settings', icon: 'key' },
]

const ADMIN_NAV: Array<{ label: string; href: string; icon: IconName }> = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'barChart' },
  { label: 'Courses', href: '/admin/courses', icon: 'folder' },
  { label: 'Teams', href: '/admin/teams', icon: 'users' },
  { label: 'Members', href: '/admin/members', icon: 'users' },
  { label: 'Analytics', href: '/admin/team', icon: 'trendingUp' },
]

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'white' ? 'dark' : 'white'
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem('courseneo-theme', next)
  } catch {}
}

export function CommandPalette() {
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role
  const isAdmin = role === 'admin' || role === 'owner'

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [courses, setCourses] = useState<CourseLite[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || courses.length > 0 || !session?.user) return
    let cancelled = false
    fetch('/api/courses')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data?.courses) return
        setCourses(
          data.courses
            .filter((c: CourseLite) => c?.id && c?.title)
            .map((c: CourseLite) => ({ id: c.id, title: c.title }))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, courses.length, session?.user])

  const items = useMemo<CommandItem[]>(() => {
    const nav = isAdmin ? [...ADMIN_NAV, ...LEARNER_NAV] : LEARNER_NAV
    const navItems: CommandItem[] = nav.map(n => ({
      id: `nav:${n.href}`,
      label: n.label,
      group: 'Navigate',
      icon: n.icon,
      run: () => {
        router.push(n.href)
        close()
      },
    }))

    const courseBase = isAdmin ? '/admin/courses' : '/learn'
    const courseItems: CommandItem[] = courses.map(c => ({
      id: `course:${c.id}`,
      label: c.title,
      hint: 'Course',
      group: 'Courses',
      icon: 'book',
      run: () => {
        router.push(`${courseBase}/${c.id}`)
        close()
      },
    }))

    const actions: CommandItem[] = [
      {
        id: 'action:theme',
        label: 'Toggle theme',
        group: 'Actions',
        icon: 'eye',
        run: () => {
          toggleTheme()
          close()
        },
      },
      {
        id: 'action:signout',
        label: 'Sign out',
        group: 'Actions',
        icon: 'lock',
        run: () => {
          close()
          signOut({ callbackUrl: '/login' })
        },
      },
    ]

    return [...navItems, ...courseItems, ...actions]
  }, [isAdmin, courses, router, close])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(it => {
      const hay = `${it.label} ${it.group}`.toLowerCase()
      let i = 0
      for (const ch of q) {
        i = hay.indexOf(ch, i)
        if (i === -1) return false
        i += 1
      }
      return true
    })
  }, [items, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  const groups = useMemo(() => {
    const order = ['Navigate', 'Courses', 'Actions']
    const map = new Map<string, CommandItem[]>()
    for (const it of filtered) {
      const arr = map.get(it.group) ?? []
      arr.push(it)
      map.set(it.group, arr)
    }
    return order
      .filter(g => map.has(g))
      .map(g => ({ group: g, items: map.get(g)! }))
  }, [filtered])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => (filtered.length ? (a + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[active]?.run()
    }
  }

  if (!open) return null

  let flatIndex = -1

  return (
    <div
      className={styles.backdrop}
      onMouseDown={e => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className={styles.searchRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search actions, courses, pages…"
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <div className={styles.list} ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <div className={styles.empty}>No matches</div>
          ) : (
            groups.map(({ group, items: groupItems }) => (
              <div key={group} className={styles.group}>
                <div className={styles.groupLabel}>{group}</div>
                {groupItems.map(it => {
                  flatIndex += 1
                  const idx = flatIndex
                  const isActive = idx === active
                  return (
                    <button
                      key={it.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-index={idx}
                      className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                      onMouseMove={() => setActive(idx)}
                      onClick={() => it.run()}
                    >
                      <span className={styles.itemIcon}>
                        <Icon name={it.icon} size={16} />
                      </span>
                      <span className={styles.itemLabel}>{it.label}</span>
                      {it.hint && <span className={styles.itemHint}>{it.hint}</span>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
