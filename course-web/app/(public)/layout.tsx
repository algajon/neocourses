import type { ReactNode } from 'react'
import Link from 'next/link'
import styles from './layout.module.css'

interface PublicLayoutProps {
  children: ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.navLeft}>
            <Link href="/" className={styles.wordmarkLink}>
              course<span className={styles.neo}>neo</span>
            </Link>
          </div>
          <div className={styles.navRight}>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
            <Link href="/signup" className="btn-cta">
              Get started free
            </Link>
          </div>
        </div>
      </nav>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerWordmark}>
            course<span className={styles.neo}>neo</span>
          </span>
          <span className={styles.footerCopy}>
            © {new Date().getFullYear()} courseneo. All rights reserved.
          </span>
          <div className={styles.footerLinks}>
            <Link href="/features">Features</Link>
            <Link href="/pricing">Plans</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
