'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import styles from './CertificateModal.module.css'

export interface CertificateModalData {
  courseId: string
  courseTitle: string
  recipientName: string
  description?: string | null
  difficultyLevel?: string | null
  /** Formatted issue date. When null, the certificate is shown as a locked preview. */
  issuedDate?: string | null
  verificationCode?: string | null
}

interface CertificateModalProps {
  data: CertificateModalData
  onClose: () => void
}

function levelLabel(level?: string | null) {
  if (!level) return null
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export function CertificateModal({ data, onClose }: CertificateModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const locked = !data.issuedDate

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
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
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-modal-title"
      >
        <button
          ref={closeBtnRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close certificate preview"
        >
          <Icon name="x" size={18} />
        </button>

        <div className={`${styles.certWrap} ${locked ? styles.certWrapLocked : ''}`}>
          <div className={styles.certBorder}>
            <div className={styles.certInner}>
              <div className={styles.certHeader}>
                <div className={styles.wordmark}>
                  course<span className={styles.neo}>neo</span>
                </div>
                {locked ? (
                  <span className={styles.previewPill}>
                    <Icon name="lock" size={11} /> Preview
                  </span>
                ) : (
                  <div className={styles.certType}>Certificate of Completion</div>
                )}
              </div>

              <div className={styles.certDivider} />

              <div className={styles.certBody}>
                <p className={styles.certPresents}>This certifies that</p>
                <h1 id="cert-modal-title" className={styles.certName}>
                  {data.recipientName}
                </h1>
                <p className={styles.certHas}>
                  {locked
                    ? 'will have successfully completed the course'
                    : 'has successfully completed the course'}
                </p>
                <h2 className={styles.certCourse}>{data.courseTitle}</h2>
                {data.description && (
                  <p className={styles.certDescription}>{data.description}</p>
                )}
              </div>

              <div className={styles.certDivider} />

              <div className={styles.certFooter}>
                <div className={styles.certMeta}>
                  <div className={styles.certMetaItem}>
                    <span className={styles.certMetaLabel}>Date issued</span>
                    <span className={styles.certMetaValue}>
                      {locked ? 'On completion' : data.issuedDate}
                    </span>
                  </div>
                  <div className={styles.certMetaItem}>
                    <span className={styles.certMetaLabel}>Certificate ID</span>
                    <span className={`${styles.certMetaValue} ${styles.certCode}`}>
                      {locked ? 'Pending' : data.verificationCode}
                    </span>
                  </div>
                  {levelLabel(data.difficultyLevel) && (
                    <div className={styles.certMetaItem}>
                      <span className={styles.certMetaLabel}>Level</span>
                      <span className={styles.certMetaValue}>
                        {levelLabel(data.difficultyLevel)}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.certSeal}>
                  <div className={styles.sealOuter}>
                    <div className={styles.sealInner}>
                      <div className={styles.sealNeo}>neo</div>
                      <div className={styles.sealSub}>{locked ? 'sealed' : 'verified'}</div>
                    </div>
                  </div>
                  {locked && (
                    <span className={styles.sealLock}>
                      <Icon name="lock" size={12} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {locked ? (
          <div className={styles.actions}>
            <p className={styles.lockedNote}>
              <Icon name="lock" size={13} />
              Complete the course and pass every quiz to earn this certificate.
            </p>
            <Link href={`/learn/${data.courseId}`} className={styles.btnAccent} onClick={onClose}>
              Go to course
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        ) : (
          <div className={styles.actions}>
            <p className={styles.verifyNote}>
              Verification code <strong>{data.verificationCode}</strong> — anyone can confirm
              this certificate.
            </p>
            <div className={styles.actionBtns}>
              {data.verificationCode && (
                <Link
                  href={`/verify/${data.verificationCode}`}
                  className={styles.btnSecondary}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="eye" size={14} />
                  Public link
                </Link>
              )}
              <Link
                href={`/learn/${data.courseId}/certificate`}
                className={styles.btnAccent}
                onClick={onClose}
              >
                <Icon name="expand" size={14} />
                View full certificate
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
