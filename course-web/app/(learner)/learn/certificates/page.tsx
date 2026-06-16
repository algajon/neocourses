import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { certificates, courses } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { CertificatesView } from './CertificatesView'
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

async function getEarnableCourses(organizationId: string) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      thumbnailUrl: courses.thumbnailUrl,
      description: courses.description,
      difficultyLevel: courses.difficultyLevel,
    })
    .from(courses)
    .where(
      and(
        eq(courses.organizationId, organizationId),
        eq(courses.status, 'published'),
        eq(courses.certificateEnabled, true)
      )
    )
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

  const earnedIds = new Set(rows.map(({ course }) => course.id))
  const earnable = session.user.organizationId
    ? (await getEarnableCourses(session.user.organizationId)).filter(
        (c) => !earnedIds.has(c.id)
      )
    : []

  const earned = rows.map(({ certificate, course }) => ({
    courseId: course.id,
    courseTitle: course.title,
    description: course.description,
    difficultyLevel: course.difficultyLevel,
    issuedDate: dateFormatter.format(certificate.issuedAt),
    verificationCode: certificate.verificationCode,
  }))

  const earnableView = earnable.map((course) => ({
    courseId: course.id,
    courseTitle: course.title,
    thumbnailUrl: course.thumbnailUrl,
    description: course.description,
    difficultyLevel: course.difficultyLevel,
  }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Your Achievements</span>
        <h1 className={styles.heading}>Certifications</h1>
        <p className={styles.subheading}>
          {rows.length} certificate{rows.length !== 1 ? 's' : ''} earned
        </p>
      </div>

      <CertificatesView
        recipientName={session.user.name ?? 'Learner'}
        earned={earned}
        earnable={earnableView}
      />
    </div>
  )
}
