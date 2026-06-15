import { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { AdminSidebar } from '@/components/AdminSidebar'
import { OnboardingTour } from '@/components/OnboardingTour'
import styles from './layout.module.css'

interface AdminLayoutProps {
  children: ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'admin' && session.user.role !== 'owner') {
    redirect('/learn')
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <AdminSidebar user={session.user} />
      </aside>
      <main className={styles.main}>{children}</main>
      <OnboardingTour role={session.user.role} />
    </div>
  )
}
