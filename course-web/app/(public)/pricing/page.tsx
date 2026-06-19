import Link from 'next/link'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

const plans = [
  {
    name: 'Starter',
    badge: null,
    desc: 'Perfect for individuals and small teams experimenting with AI course creation.',
    features: [
      '5 AI course generations / month',
      'Up to 10 learner accounts',
      'AI outline generation',
      'PDF & document import',
      'Chapter quizzes',
      'Progress tracking',
    ],
    cta: 'Get started free',
    ctaHref: '/signup',
    ctaClass: 'btn-secondary',
    highlighted: false,
  },
  {
    name: 'Team',
    badge: 'Most popular',
    desc: 'For teams that need more generations, seats, advanced import formats, and admin controls.',
    features: [
      '100 AI course generations / month',
      'Up to 50 learner accounts',
      'All import formats (video, audio)',
      'Custom AI model endpoint',
      'Mobile content push (QR)',
      'Admin dashboard & reports',
      'Role-based access control',
      'Priority support',
    ],
    cta: 'Upgrade to Team',
    ctaHref: '/admin/billing',
    ctaClass: 'btn-cta',
    highlighted: true,
  },
  {
    name: 'Business',
    badge: null,
    desc: 'For organisations that need unlimited generation, unlimited seats, and dedicated onboarding.',
    features: [
      'Unlimited AI course generations',
      'Unlimited learner accounts',
      'Multi-organisation support',
      'Custom data retention policy',
      'SSO / SAML (on request)',
      'Dedicated onboarding',
      'Custom integrations',
      'Security review',
    ],
    cta: 'Upgrade to Business',
    ctaHref: '/admin/billing',
    ctaClass: 'btn-secondary',
    highlighted: false,
  },
]

const faqs = [
  {
    q: 'Do I need to provide my own AI API key?',
    a: 'On the Free plan you can bring your own OpenAI (or compatible) API key. Team and Business plans can use our hosted model or your own endpoint.',
  },
  {
    q: 'Is my data stored on your servers?',
    a: 'courseneo is designed to be local-first. The desktop app stores everything on your machine. The web app keeps data in your own database — we never have access to your course content.',
  },
  {
    q: 'Can I use a different AI model?',
    a: 'Yes. courseneo supports any OpenAI-compatible API endpoint. Point it at GPT-4o, a local Ollama instance, or your own fine-tuned model.',
  },
  {
    q: 'What file formats are supported?',
    a: 'PDF, Word (.docx), PowerPoint (.pptx), plain text, MP3, and MP4. More formats are on the roadmap.',
  },
]

export default function PricingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <div className={styles.label}>Plans</div>
          <h1 className={styles.title}>Plans for every team</h1>
          <p className={styles.sub}>
            Start free and scale when you need to. Pick the plan that fits your team.
          </p>
        </div>
      </section>

      <section className={styles.plansSection}>
        <div className={styles.inner}>
          <div className={styles.plansGrid}>
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`${styles.planCard} ${plan.highlighted ? styles.planCardHighlighted : ''}`}
              >
                {plan.badge && (
                  <div className={styles.planBadge}>{plan.badge}</div>
                )}
                <div className={styles.planName}>{plan.name}</div>
                <p className={styles.planDesc}>{plan.desc}</p>
                <Link href={plan.ctaHref} className={plan.ctaClass}>
                  {plan.cta}
                </Link>
                <div className={styles.planDivider} />
                <ul className={styles.featureList}>
                  {plan.features.map((f) => (
                    <li key={f} className={styles.featureItem}>
                      <span className={styles.check}><Icon name="check" size={15} /></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.inner}>
          <h2 className={styles.faqTitle}>Frequently asked questions</h2>
          <div className={styles.faqGrid}>
            {faqs.map((faq) => (
              <div key={faq.q} className={styles.faqItem}>
                <h3 className={styles.faqQ}>{faq.q}</h3>
                <p className={styles.faqA}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.inner}>
          <h2 className={styles.ctaTitle}>Not sure which plan is right for you?</h2>
          <p className={styles.ctaSub}>
            Start with the free Starter plan — no commitment. Upgrade when you are ready.
          </p>
          <div className={styles.ctaButtons}>
            <Link href="/signup" className="btn-cta">
              Get started free
            </Link>
            <Link href="/admin/billing" className="btn-secondary">
              Compare plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
