import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { certificates, courses } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import styles from './page.module.css'

async function getCertificates(userId: string) {
  return db
    .select({
      certificate: certificates,
      course: courses,
    })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt))
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const rows = await getCertificates(session.user.id)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Your Achievements</span>
        <h1 className={styles.heading}>Certifications</h1>
        <p className={styles.subheading}>
          {rows.length} certificate{rows.length !== 1 ? 's' : ''} earned
        </p>
      </div>

      {rows.length > 0 ? (
        <div className={styles.grid}>
          {rows.map(({ certificate, course }) => (
            <div key={certificate.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.badge}>
                  <Icon name="certificate" size={20} />
                </span>
                <span className={styles.issued}>
                  {dateFormatter.format(certificate.issuedAt)}
                </span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{course.title}</h3>
                <div className={styles.codeRow}>
                  <span className={styles.codeLabel}>Verification</span>
                  <span className={styles.code}>{certificate.verificationCode}</span>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <Link href={`/learn/${course.id}/certificate`} className={styles.btnPrimary}>
                  View certificate
                  <Icon name="arrowRight" size={14} />
                </Link>
                <Link
                  href={`/verify/${certificate.verificationCode}`}
                  className={styles.verifyLink}
                >
                  <Icon name="eye" size={14} />
                  Public link
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="certificate" size={32} />
          </div>
          <p className={styles.emptyText}>No certificates yet.</p>
          <p className={styles.emptySubtext}>
            Complete a course to earn one.
          </p>
          <Link href="/learn/catalog" className={styles.btnAccent}>
            Browse catalog
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
