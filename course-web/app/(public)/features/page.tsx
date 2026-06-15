import Link from 'next/link'
import { Icon, type IconName } from '@/components/Icon'
import styles from './page.module.css'

const featureSections: { category: string; items: { icon: IconName; title: string; desc: string }[] }[] = [
  {
    category: 'Content Creation',
    items: [
      {
        icon: 'file',
        title: 'Multi-format import',
        desc: 'Import PDFs, Word documents, and text files. Any knowledge source becomes a course.',
      },
      {
        icon: 'sparkles',
        title: 'AI outline generation',
        desc: 'Drop in a file and the AI structures it into a logical module and lesson hierarchy — with a coherent narrative flow.',
      },
      {
        icon: 'book',
        title: 'Source-grounded content',
        desc: 'Lessons and quizzes are generated from the actual text of your uploaded materials — not just the title — so every course reflects your real source documents.',
      },
      {
        icon: 'edit',
        title: 'Inline outline editor',
        desc: 'Review and edit the generated outline before publishing. Add, remove, or reorder modules and lessons freely.',
      },
    ],
  },
  {
    category: 'Learning Experience',
    items: [
      {
        icon: 'map',
        title: 'Visual course roadmap',
        desc: 'Learners see their full chapter-by-chapter progress in a visual tree — not a flat list. They always know where they stand.',
      },
      {
        icon: 'image',
        title: 'PowerPoint-style lessons',
        desc: 'Lessons render as full-page slides with concept cards, callouts, and key takeaways — optimised for quick reading.',
      },
      {
        icon: 'certificate',
        title: 'Mandatory chapter quizzes',
        desc: 'Learners must pass a quiz before moving to the next chapter. Questions are generated from the actual lesson content.',
      },
      {
        icon: 'lock',
        title: 'Gated progression',
        desc: 'Chapters unlock sequentially. Admins can verify that every learner has genuinely completed each stage.',
      },
    ],
  },
  {
    category: 'Administration',
    items: [
      {
        icon: 'users',
        title: 'Role-based access',
        desc: 'Three roles out of the box: Admin, Editor, and Trainee. Admins manage everything; Editors create courses; Trainees learn.',
      },
      {
        icon: 'barChart',
        title: 'Completion reports',
        desc: 'See which learners have completed which courses, passed which quizzes, and where they are stuck.',
      },
      {
        icon: 'building',
        title: 'Organisation management',
        desc: 'Manage multiple teams or departments from a single admin panel. Each org keeps its own user and course catalogue.',
      },
      {
        icon: 'key',
        title: 'Configurable AI model',
        desc: 'Point courseneo at any OpenAI-compatible API endpoint. Use GPT-4o, a local model, or your own hosted inference server.',
      },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.label}>Features</div>
          <h1 className={styles.title}>
            Built for teams that take<br />
            learning seriously
          </h1>
          <p className={styles.sub}>
            courseneo covers the full lifecycle — from raw file to certified completion — with no third-party
            content tools, no cloud lock-in, and no manual instructional design work.
          </p>
          <div className={styles.ctas}>
            <Link href="/signup" className="btn-cta">
              Get started free
            </Link>
            <Link href="/pricing" className={styles.secondaryLink}>
              View pricing <Icon name="arrowRight" size={15} style={{ verticalAlign: 'middle' }} />
            </Link>
          </div>
        </div>
      </section>

      {featureSections.map((section) => (
        <section key={section.category} className={styles.section}>
          <div className={styles.inner}>
            <h2 className={styles.categoryTitle}>{section.category}</h2>
            <div className={styles.grid}>
              {section.items.map((item) => (
                <div key={item.title} className={styles.card}>
                  <div className={styles.icon}><Icon name={item.icon} size={26} /></div>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  <p className={styles.cardDesc}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className={styles.cta}>
        <div className={styles.inner}>
          <h2 className={styles.ctaTitle}>Ready to see it in action?</h2>
          <p className={styles.ctaSub}>
            Create your account in 30 seconds — no credit card required.
          </p>
          <Link href="/signup" className="btn-cta">
            Get started free
          </Link>
        </div>
      </section>
    </div>
  )
}
