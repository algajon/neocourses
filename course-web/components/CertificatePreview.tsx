'use client'

import { Icon } from '@/components/Icon'
import { courseGradient } from '@/lib/gradient'
import styles from './CertificatePreview.module.css'

interface CertificatePreviewProps {
  courseId: string
  title: string
  thumbnailUrl?: string | null
  onSelect: () => void
}

export function CertificatePreview({ courseId, title, thumbnailUrl, onSelect }: CertificatePreviewProps) {
  const accent = thumbnailUrl
    ? `center / cover no-repeat url(${JSON.stringify(thumbnailUrl)})`
    : courseGradient(courseId)

  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      <div className={styles.accent} style={{ background: accent }}>
        <span className={styles.lock}>
          <Icon name="lock" size={16} />
        </span>
        <div className={styles.seal}>
          <span className={styles.sealNeo}>neo</span>
        </div>
      </div>
      <div className={styles.body}>
        <span className={styles.type}>Certificate of Completion</span>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.earnBy}>
          <Icon name="lock" size={12} />
          Earn by completing {title}
        </span>
      </div>
      <div className={styles.footer}>
        <span className={styles.cta}>
          Preview certificate
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </button>
  )
}
