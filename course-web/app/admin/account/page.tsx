import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { AccountSettingsForm } from '@/app/(learner)/settings/AccountSettingsForm'
import styles from '@/app/(learner)/settings/page.module.css'

// Account settings rendered inside the ADMIN route group so admins/owners keep
// their sidebar chrome (the shared /settings page lives under (learner) and uses
// the learner top-nav). Same form + styles, correct shell per role.
export default async function AdminAccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Your Account</span>
        <h1 className={styles.heading}>Settings</h1>
        <p className={styles.subheading}>Manage your display name and password.</p>
      </div>

      <AccountSettingsForm
        initialName={session.user.name ?? ''}
        email={session.user.email ?? ''}
      />
    </div>
  )
}
