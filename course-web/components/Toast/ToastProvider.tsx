'use client'

import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import styles from './Toast.module.css'

type ToastType = 'success' | 'error' | 'info'

interface ToastInput {
  type: ToastType
  title: string
  description?: string
}

interface ToastItem extends ToastInput {
  id: string
  leaving: boolean
}

interface ToastContextValue {
  toast: (input: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 4000
const EXIT_MS = 220

const ICONS: Record<ToastType, IconName> = {
  success: 'check',
  error: 'x',
  info: 'info',
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    const exit = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timers.current.delete(id)
    }, EXIT_MS)
    timers.current.set(id, exit)
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { ...input, id, leaving: false }])
      const auto = setTimeout(() => remove(id), DURATION)
      timers.current.set(id, auto)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={styles.viewport} role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${styles[t.type]} ${t.leaving ? styles.leaving : ''}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <span className={styles.iconWrap}>
              <Icon name={ICONS[t.type]} size={16} />
            </span>
            <div className={styles.body}>
              <div className={styles.title}>{t.title}</div>
              {t.description ? <div className={styles.description}>{t.description}</div> : null}
            </div>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
