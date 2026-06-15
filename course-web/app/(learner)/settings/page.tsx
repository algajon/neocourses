import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { AccountSettingsForm } from './AccountSettingsForm'
import styles from './page.module.css'

export default async function SettingsPage() {
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
