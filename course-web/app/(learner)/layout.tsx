import { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { LearnerNav } from '@/components/LearnerNav'
import { OnboardingTour } from '@/components/OnboardingTour'
import styles from './layout.module.css'

interface LearnerLayoutProps {
  children: ReactNode
}

export default async function LearnerLayout({ children }: LearnerLayoutProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">Skip to main content</a>
      <LearnerNav
        user={{
          name: session.user.name ?? 'Learner',
          email: session.user.email ?? '',
          role: session.user.role,
        }}
      />
      <main id="main" role="main" className={styles.main}>{children}</main>
      <OnboardingTour role={session.user.role} />
    </div>
  )
}
