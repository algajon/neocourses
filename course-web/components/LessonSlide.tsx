'use client'

import type { CSSProperties } from 'react'
import type { LessonContent } from '@/lib/ai/types'
import { Icon, type IconName } from '@/components/Icon'
import styles from './LessonSlide.module.css'

const ACCENT_COLORS = ['#e5ff00', '#0ea5e9', '#10b981'] as const

type CalloutType = LessonContent['callouts'][number]['type']

const CALLOUT_LABEL: Record<CalloutType, string> = {
  practice: 'In practice',
  trivia: 'Did you know?',
  tip: 'Tip',
}

const CALLOUT_ICON: Record<CalloutType, IconName> = {
  practice: 'check',
  trivia: 'info',
  tip: 'star',
}

const CALLOUT_CLASS: Record<CalloutType, string> = {
  practice: '',
  trivia: styles.calloutTrivia,
  tip: styles.calloutTip,
}

// Stable per-title hash → one of 4 distinct slide layouts (ported from the
// desktop LessonView so the same lesson always renders the same way).
function layoutVariant(lessonTitle: string): 0 | 1 | 2 | 3 {
  let h = 0
  for (let i = 0; i < lessonTitle.length; i++) {
    h = lessonTitle.charCodeAt(i) + ((h << 5) - h)
  }
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3
}

interface Props {
  content: LessonContent
  lessonTitle: string
  moduleTitle: string
  chapterNum: number
}

function accentStyle(i: number): CSSProperties {
  return { '--accent': ACCENT_COLORS[i % ACCENT_COLORS.length] } as CSSProperties
}

function ConceptCard({
  title,
  body,
  index,
  variant = 'default',
}: {
  title: string
  body: string
  index: number
  variant?: 'default' | 'sm' | 'full'
}) {
  const cls = [
    styles.conceptCard,
    variant === 'sm' ? styles.conceptCardSm : '',
    variant === 'full' ? styles.conceptCardFull : '',
  ].join(' ')
  return (
    <div className={cls} style={accentStyle(index)}>
      <h3 className={styles.conceptTitle}>{title}</h3>
      <p className={`${styles.conceptBody} ${variant === 'full' ? styles.conceptBodyFull : ''}`}>{body}</p>
    </div>
  )
}

function Callouts({ content }: { content: LessonContent }) {
  const callouts = content.callouts ?? []
  if (callouts.length === 0) return null
  return (
    <div className={styles.calloutRow}>
      {callouts.slice(0, 3).map((co, i) => (
        <div key={i} className={`${styles.callout} ${CALLOUT_CLASS[co.type]}`}>
          <span className={styles.calloutLabel}>
            <span className={styles.calloutBadge}>
              <Icon name={CALLOUT_ICON[co.type]} size={13} />
            </span>
            {co.title || CALLOUT_LABEL[co.type]}
          </span>
          <p className={styles.calloutText}>{co.text}</p>
        </div>
      ))}
    </div>
  )
}

export function LessonSlide({ content, lessonTitle, moduleTitle, chapterNum }: Props) {
  const variant = layoutVariant(lessonTitle)
  const concepts = content.concepts ?? []
  const takeaways = content.keyTakeaways ?? []

  const breadcrumb = (
    <span className={styles.breadcrumb}>
      Chapter {chapterNum} — {moduleTitle}
    </span>
  )

  if (variant === 1) {
    return (
      <div className={styles.slide}>
        <div className={styles.slideTop}>
          {breadcrumb}
          <h1 className={styles.title}>{lessonTitle}</h1>
          {content.intro && <p className={styles.intro}>{content.intro}</p>}
        </div>
        <div className={styles.v2Grid}>
          {concepts.slice(0, 3).map((c, i) => (
            <ConceptCard key={i} title={c.title} body={c.body} index={i} variant="sm" />
          ))}
        </div>
        {takeaways.length > 0 && (
          <div className={styles.v1Takeaways}>
            <p className={styles.v1TakeawaysLabel}>Key Takeaways</p>
            <div className={styles.takeawayChipRow}>
              {takeaways.slice(0, 3).map((kp, i) => (
                <span key={i} className={styles.takeawayChip}>{kp}</span>
              ))}
            </div>
          </div>
        )}
        <Callouts content={content} />
      </div>
    )
  }

  if (variant === 2) {
    return (
      <div className={styles.slide}>
        <div className={styles.slideTop}>
          {breadcrumb}
          <h1 className={`${styles.title} ${styles.titleMd}`}>{lessonTitle}</h1>
          {content.intro && <p className={styles.intro}>{content.intro}</p>}
        </div>
        <div className={styles.v2Grid}>
          {concepts.slice(0, 3).map((c, i) => (
            <ConceptCard key={i} title={c.title} body={c.body} index={i} variant="sm" />
          ))}
        </div>
        {takeaways.length > 0 && (
          <div className={styles.v2Takeaways}>
            <span className={styles.takeawaysLabel}>Key takeaways</span>
            <ol className={styles.numberedList}>
              {takeaways.slice(0, 3).map((kp, i) => (
                <li key={i} className={styles.numberedItem}>
                  <span className={styles.numberedBadge}>{i + 1}</span>
                  <span className={styles.numberedText}>{kp}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <Callouts content={content} />
      </div>
    )
  }

  if (variant === 3) {
    return (
      <div className={styles.slide}>
        <div className={styles.v3Top}>
          <div className={styles.v3TopText}>
            {breadcrumb}
            <h1 className={`${styles.title} ${styles.titleMd}`}>{lessonTitle}</h1>
            {content.intro && <p className={styles.intro}>{content.intro}</p>}
          </div>
          {takeaways.length > 0 && (
            <div className={styles.v3Chips}>
              {takeaways.slice(0, 3).map((kp, i) => (
                <span key={i} className={styles.chip}>{kp}</span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.v3Grid}>
          {concepts.slice(0, 2).map((c, i) => (
            <ConceptCard key={i} title={c.title} body={c.body} index={i} variant="sm" />
          ))}
          {concepts[2] && (
            <ConceptCard title={concepts[2].title} body={concepts[2].body} index={2} variant="full" />
          )}
        </div>
        <Callouts content={content} />
      </div>
    )
  }

  // Variant 0 (default): 2×2 grid — concepts + key-takeaways card
  return (
    <div className={styles.slide}>
      <div className={styles.slideTop}>
        {breadcrumb}
        <h1 className={styles.title}>{lessonTitle}</h1>
        {content.intro && <p className={styles.intro}>{content.intro}</p>}
      </div>
      <div className={styles.grid}>
        {concepts.slice(0, 3).map((c, i) => (
          <ConceptCard key={i} title={c.title} body={c.body} index={i} />
        ))}
        {takeaways.length > 0 && (
          <div className={`${styles.conceptCard} ${styles.takeawayCard}`} style={accentStyle(2)}>
            <h3 className={styles.conceptTitle}>Key Takeaways</h3>
            <ul className={styles.takeawayList}>
              {takeaways.slice(0, 3).map((kp, i) => (
                <li key={i} className={styles.takeawayItem}>{kp}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Callouts content={content} />
    </div>
  )
}
