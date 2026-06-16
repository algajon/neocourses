'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { CertificateModal, type CertificateModalData } from '@/components/CertificateModal'
import { CertificatePreview } from '@/components/CertificatePreview'
import styles from './page.module.css'

export interface EarnedCertView {
  courseId: string
  courseTitle: string
  description: string | null
  difficultyLevel: string | null
  issuedDate: string
  verificationCode: string
}

export interface EarnableCertView {
  courseId: string
  courseTitle: string
  thumbnailUrl: string | null
  description: string | null
  difficultyLevel: string | null
}

interface CertificatesViewProps {
  recipientName: string
  earned: EarnedCertView[]
  earnable: EarnableCertView[]
}

export function CertificatesView({ recipientName, earned, earnable }: CertificatesViewProps) {
  const [active, setActive] = useState<CertificateModalData | null>(null)

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Earned</h2>

        {earned.length > 0 ? (
          <div className={styles.grid}>
            {earned.map((cert) => (
              <button
                key={cert.courseId}
                type="button"
                className={styles.card}
                onClick={() =>
                  setActive({
                    courseId: cert.courseId,
                    courseTitle: cert.courseTitle,
                    recipientName,
                    description: cert.description,
                    difficultyLevel: cert.difficultyLevel,
                    issuedDate: cert.issuedDate,
                    verificationCode: cert.verificationCode,
                  })
                }
                aria-label={`Preview certificate for ${cert.courseTitle}`}
              >
                <div className={styles.cardTop}>
                  <span className={styles.badge}>
                    <Icon name="certificate" size={20} />
                  </span>
                  <span className={styles.issued}>{cert.issuedDate}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{cert.courseTitle}</h3>
                  <div className={styles.codeRow}>
                    <span className={styles.codeLabel}>Verification</span>
                    <span className={styles.code}>{cert.verificationCode}</span>
                  </div>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.previewCue}>
                    <Icon name="eye" size={14} />
                    Preview certificate
                  </span>
                  <Icon name="arrowRight" size={14} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Icon name="certificate" size={32} />
            </div>
            <p className={styles.emptyText}>No certificates yet.</p>
            <p className={styles.emptySubtext}>Complete a course to earn one.</p>
            <Link href="/learn/catalog" className={styles.btnAccent}>
              Browse catalog
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Certificates you can earn</h2>

        {earnable.length > 0 ? (
          <div className={styles.grid}>
            {earnable.map((course) => (
              <CertificatePreview
                key={course.courseId}
                courseId={course.courseId}
                title={course.courseTitle}
                thumbnailUrl={course.thumbnailUrl}
                onSelect={() =>
                  setActive({
                    courseId: course.courseId,
                    courseTitle: course.courseTitle,
                    recipientName,
                    description: course.description,
                    difficultyLevel: course.difficultyLevel,
                    issuedDate: null,
                    verificationCode: null,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyInline}>
            <div className={styles.emptyIconSmall}>
              <Icon name="lock" size={24} />
            </div>
            <p className={styles.emptyInlineText}>No certificates available to earn right now.</p>
            <p className={styles.emptyInlineSubtext}>
              Certificate-eligible courses you haven&apos;t completed will show up here.
            </p>
          </div>
        )}
      </section>

      {active && <CertificateModal data={active} onClose={() => setActive(null)} />}
    </>
  )
}
