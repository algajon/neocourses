import Link from 'next/link'
import { Icon, type IconName } from '@/components/Icon'
import styles from './page.module.css'

const features: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'sparkles',
    title: 'AI Course Generation',
    desc: 'Drop in a PDF, video, or audio file and get a fully structured course outline with lessons and quizzes in seconds.',
  },
  {
    icon: 'target',
    title: 'Onboarding Automation',
    desc: 'Turn any document into an interactive onboarding flow. New hires complete structured modules, not walls of text.',
  },
  {
    icon: 'trendingUp',
    title: 'Progress Tracking',
    desc: 'Visual chapter roadmaps, mandatory chapter quizzes, and completion reports so managers see who knows what.',
  },
]

const steps = [
  {
    num: '01',
    title: 'Import your content',
    desc: 'Upload a PDF, Word doc, MP3, MP4, or paste text. Any knowledge source works.',
  },
  {
    num: '02',
    title: 'AI builds the outline',
    desc: 'The AI structures your content into modules and lessons with a clear learning path.',
  },
  {
    num: '03',
    title: 'Review and publish',
    desc: 'Edit the outline, adjust lessons, then publish so your team can enroll immediately.',
  },
  {
    num: '04',
    title: 'Track completion',
    desc: 'Learners progress through chapters, pass quizzes, and you see real-time results.',
  },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.pill}>
            <span className={styles.pillDot} />
            AI-powered learning platform
          </div>
          <h1 className={styles.heroHeadline}>
            Transform Your Knowledge<br />
            Into Courses —{' '}
            <span className={styles.gradientText}>Automatically</span>
          </h1>
          <p className={styles.heroSub}>
            courseneo turns your PDFs, videos, and documents into structured, interactive courses
            in minutes — not months. Built for teams that need to move fast.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/signup" className="btn-cta">
              Get started free
            </Link>
            <Link href="/features" className={styles.seeFeatures}>
              See features <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>10×</span>
              <span className={styles.statLabel}>Faster course creation</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>100%</span>
              <span className={styles.statLabel}>Local — your data stays yours</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>Any</span>
              <span className={styles.statLabel}>File format supported</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Why courseneo</div>
          <h2 className={styles.sectionTitle}>
            Everything you need to build great courses
          </h2>
          <p className={styles.sectionSub}>
            From raw content to polished learning experiences — without the friction.
          </p>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}><Icon name={f.icon} size={28} /></div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>How it works</div>
          <h2 className={styles.sectionTitle}>From file to course in four steps</h2>
          <p className={styles.sectionSub}>
            No complicated setup. No professional instructional designers required.
          </p>
          <div className={styles.stepsGrid}>
            {steps.map((s, i) => (
              <div key={s.num} className={styles.stepCard}>
                <div className={styles.stepNum}>{s.num}</div>
                {i < steps.length - 1 && <div className={styles.stepConnector} />}
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            Ready to build your first course?
          </h2>
          <p className={styles.ctaSub}>
            Get started in minutes.
          </p>
          <div className={styles.ctaButtons}>
            <Link href="/signup" className="btn-cta">
              Get started free
            </Link>
            <Link href="/pricing" className={styles.ctaSecondary}>
              View plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
