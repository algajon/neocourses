import { Icon } from '@/components/Icon'
import { db } from '@/lib/db'
import { certificates, courses, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import styles from './page.module.css'

interface PageProps {
  params: { code: string }
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

async function getVerification(code: string) {
  const [row] = await db
    .select({
      userName: users.name,
      courseTitle: courses.title,
      issuedAt: certificates.issuedAt,
      verificationCode: certificates.verificationCode,
    })
    .from(certificates)
    .innerJoin(users, eq(certificates.userId, users.id))
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(eq(certificates.verificationCode, code))
    .limit(1)

  return row ?? null
}

export default async function VerifyPage({ params }: PageProps) {
  const data = await getVerification(params.code)

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          course<span className={styles.neo}>neo</span>
          <span className={styles.brandSub}>Certificate verification</span>
        </div>

        {data ? (
          <div className={styles.card}>
            <div className={styles.badge}>
              <Icon name="check" size={32} />
            </div>
            <div className={styles.verified}>Verified</div>
            <p className={styles.statement}>
              <strong>{data.userName}</strong> completed{' '}
              <strong>{data.courseTitle}</strong>
            </p>
            <div className={styles.divider} />
            <div className={styles.meta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Issued</span>
                <span className={styles.metaValue}>
                  {dateFormatter.format(new Date(data.issuedAt))}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Verification code</span>
                <span className={`${styles.metaValue} ${styles.code}`}>
                  {data.verificationCode}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <div className={`${styles.badge} ${styles.badgeEmpty}`}>
              <Icon name="x" size={32} />
            </div>
            <div className={styles.notVerified}>Not verified</div>
            <p className={styles.statement}>No certificate matches this code.</p>
            <div className={styles.divider} />
            <p className={styles.emptyHint}>
              Double-check the code{' '}
              <span className={styles.code}>{params.code}</span> and try again.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
