import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { certificates, courses, users, enrollments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { PrintButton } from './PrintButton'
import { CopyVerifyLink } from './CopyVerifyLink'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface PageProps {
  params: { courseId: string }
}

async function getCertificate(courseId: string, userId: string) {
  const [cert] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.courseId, courseId), eq(certificates.userId, userId)))
    .limit(1)

  if (!cert) return null

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!course || !user) return null

  return { cert, course, user }
}

export default async function CertificatePage({ params }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const data = await getCertificate(params.courseId, session.user.id)

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.notEarned}>
            <div className={styles.notEarnedIcon}><Icon name="certificate" size={40} /></div>
            <h1 className={styles.notEarnedTitle}>Certificate Not Yet Earned</h1>
            <p className={styles.notEarnedText}>
              Complete the course and pass all quizzes to earn your certificate.
            </p>
            <Link href={`/learn/${params.courseId}`} className={styles.btnAccent}>
              Back to Course
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { cert, course, user } = data
  const issuedDate = new Date(cert.issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.breadcrumb}>
          <Link href={`/learn/${params.courseId}`} className={styles.breadcrumbLink}>Course</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Certificate</span>
        </div>

        <div className={styles.actions}>
          <PrintButton className={styles.printBtn} />
        </div>

        <div className={styles.certificateCard} id="certificate">
          <div className={styles.certBorder}>
            <div className={styles.certInner}>
              <div className={styles.certHeader}>
                <div className={styles.wordmark}>
                  course<span className={styles.neo}>neo</span>
                </div>
                <div className={styles.certType}>Certificate of Completion</div>
              </div>

              <div className={styles.certDivider} />

              <div className={styles.certBody}>
                <p className={styles.certPresents}>This certifies that</p>
                <h1 className={styles.certName}>{user.name}</h1>
                <p className={styles.certHas}>has successfully completed the course</p>
                <h2 className={styles.certCourse}>{course.title}</h2>
                {course.description && (
                  <p className={styles.certDescription}>{course.description}</p>
                )}
              </div>

              <div className={styles.certDivider} />

              <div className={styles.certFooter}>
                <div className={styles.certMeta}>
                  <div className={styles.certMetaItem}>
                    <span className={styles.certMetaLabel}>Date issued</span>
                    <span className={styles.certMetaValue}>{issuedDate}</span>
                  </div>
                  <div className={styles.certMetaItem}>
                    <span className={styles.certMetaLabel}>Certificate ID</span>
                    <span className={`${styles.certMetaValue} ${styles.certCode}`}>
                      {cert.verificationCode}
                    </span>
                  </div>
                  {course.difficultyLevel && (
                    <div className={styles.certMetaItem}>
                      <span className={styles.certMetaLabel}>Level</span>
                      <span className={styles.certMetaValue}>
                        {course.difficultyLevel.charAt(0).toUpperCase() + course.difficultyLevel.slice(1)}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.certSeal}>
                  <div className={styles.sealOuter}>
                    <div className={styles.sealInner}>
                      <div className={styles.sealNeo}>neo</div>
                      <div className={styles.sealSub}>verified</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.verifyNote}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Verification code <strong>{cert.verificationCode}</strong> — anyone can confirm this at /verify/{cert.verificationCode}
        </div>

        <div className={styles.verifyActions}>
          <CopyVerifyLink code={cert.verificationCode} className={styles.copyBtn} />
        </div>
      </div>
    </div>
  )
}
