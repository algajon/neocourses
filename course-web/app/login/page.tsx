import { Suspense } from 'react'
import LoginForm from './LoginForm'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.page}><div className={styles.card}>Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  )
}
