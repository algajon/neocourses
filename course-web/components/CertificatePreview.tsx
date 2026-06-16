import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { courseGradient } from '@/lib/gradient'
import styles from './CertificatePreview.module.css'

interface CertificatePreviewProps {
  courseId: string
  title: string
  thumbnailUrl?: string | null
}

export function CertificatePreview({ courseId, title, thumbnailUrl }: CertificatePreviewProps) {
  const accent = thumbnailUrl
    ? `center / cover no-repeat url(${JSON.stringify(thumbnailUrl)})`
    : courseGradient(courseId)

  return (
    <Link href={`/learn/${courseId}`} className={styles.card}>
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
          Go to course
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </Link>
  )
}
