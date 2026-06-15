'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import styles from './ConfirmDialog.module.css'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return ctx.confirm
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  const close = useCallback(
    (result: boolean) => {
      setState((prev) => {
        prev?.resolve(result)
        return null
      })
    },
    [],
  )

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state ? (
        <ConfirmDialog
          title={state.title}
          message={state.message}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          danger={state.danger}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  )
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    confirmBtnRef.current?.focus()
    return () => {
      previouslyFocused.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'Tab') {
        const root = dialogRef.current
        if (!root) return
        const focusable = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
      >
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        {message ? (
          <p id="confirm-message" className={styles.message}>
            {message}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={danger ? styles.dangerBtn : 'btn-cta'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
