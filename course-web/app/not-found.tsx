import Link from 'next/link'
import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark} aria-label="courseneo home">
          course<span className={styles.neo}>neo</span>
        </Link>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>This page could not be found</h1>
        <p className={styles.text}>
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
        <div className={styles.actions}>
          <Link href="/learn" className={styles.primary}>
            Go to My Learning
          </Link>
          <Link href="/" className={styles.secondary}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
