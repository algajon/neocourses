import { LessonContent } from '../../lib/contentGenerator';
import styles from './LessonView.module.css';

const ACCENT_COLORS = ['#e5ff00', '#0ea5e9', '#10b981'] as const;
const TAKEAWAY_ACCENT = '#10b981';

function layoutVariant(lessonTitle: string): 0 | 1 | 2 | 3 {
  let h = 0;
  for (let i = 0; i < lessonTitle.length; i++) h = lessonTitle.charCodeAt(i) + ((h << 5) - h);
  return (Math.abs(h) % 4) as 0 | 1 | 2 | 3;
}

type Props = {
  lesson: string;
  module: string;
  chapterNum: number;
  lessonNum: number;
  totalInChapter: number;
  content: LessonContent | null;
  isCompleted: boolean;
  nextLabel?: string;
  onBack: () => void;
  onComplete: () => void;
  onNext: (() => void) | null;
};

export function LessonView({
  lesson, module, chapterNum, lessonNum, totalInChapter,
  content, isCompleted, nextLabel, onBack, onComplete, onNext,
}: Props) {
  function handleComplete() {
    if (!isCompleted) onComplete();
    if (onNext) onNext();
    else onBack();
  }

  const variant = content ? layoutVariant(lesson) : 0;

  const tipBar = content && (
    <div className={styles.tipBar}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.tipIcon}>
        <path d="M7 1.5l1.6 3.2 3.5.5-2.55 2.5.6 3.5L7 9.6l-3.15 1.6.6-3.5L2 5.2l3.5-.5L7 1.5z" fill="currentColor"/>
      </svg>
      <span className={styles.tipText}>{content.tip}</span>
    </div>
  );

  return (
    <div className={styles.wrapper}>

      {/* ── Header bar ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Course
        </button>

        <div className={styles.dots} aria-label={`Lesson ${lessonNum} of ${totalInChapter}`}>
          {Array.from({ length: totalInChapter }).map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i < lessonNum - 1 ? styles.dotDone : ''} ${i === lessonNum - 1 ? styles.dotActive : ''}`}
            />
          ))}
        </div>

        <div className={styles.headerEnd}>
          <span className={styles.headerPos}>{lessonNum} / {totalInChapter}</span>
          {isCompleted && (
            <span className={styles.doneBadge}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Done
            </span>
          )}
        </div>
      </div>

      {/* ── Slide ── */}
      <div className={styles.slide}>

        {content === null ? (
          /* Loading skeleton */
          <>
            <div className={styles.slideTop}>
              <div className={`${styles.skeletonLine} ${styles.skeletonBreadcrumb}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonIntro}`} />
            </div>
            <div className={styles.slideGrid}>
              {[0, 1, 2, 3].map(i => <div key={i} className={styles.skeletonCard} />)}
            </div>
            <div className={styles.skeletonTip} />
          </>

        ) : variant === 1 ? (
          /* ── Variant 1: two-column split — text left, cards right ── */
          <>
            <div className={styles.v1Layout}>
              <div className={styles.v1Left}>
                <span className={styles.slideBreadcrumb}>Chapter {chapterNum} — {module}</span>
                <h1 className={styles.slideTitle}>{lesson}</h1>
                <p className={`${styles.slideIntro} ${styles.slideIntroExpanded}`}>{content.intro}</p>
                <div className={styles.v1Takeaways}>
                  <p className={styles.v1TakeawaysLabel}>Key Takeaways</p>
                  <ul className={styles.takeawayList}>
                    {(content.keyPoints ?? []).slice(0, 4).map((kp, i) => (
                      <li key={i} className={styles.takeawayItem}>{kp}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.v1Right}>
                {content.concepts.map((c, i) => (
                  <div key={i} className={`${styles.slideCard} ${styles.slideCardSm}`}
                    style={{ '--accent': ACCENT_COLORS[i] } as React.CSSProperties}>
                    <div className={styles.slideCardAccent} />
                    <div className={styles.slideCardBody}>
                      <h3 className={styles.slideCardTitle}>{c.title}</h3>
                      <p className={styles.slideCardText}>{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {tipBar}
          </>

        ) : variant === 2 ? (
          /* ── Variant 2: compact header + 3-column concept row + chip takeaways ── */
          <>
            <div className={styles.v2Top}>
              <span className={styles.slideBreadcrumb}>Chapter {chapterNum} — {module}</span>
              <h1 className={`${styles.slideTitle} ${styles.slideTitleMd}`}>{lesson}</h1>
              <p className={`${styles.slideIntro} ${styles.slideIntroOne}`}>{content.intro}</p>
            </div>
            <div className={styles.v2Grid}>
              {content.concepts.map((c, i) => (
                <div key={i} className={`${styles.slideCard} ${styles.slideCardSm}`}
                  style={{ '--accent': ACCENT_COLORS[i] } as React.CSSProperties}>
                  <div className={styles.slideCardAccent} />
                  <div className={styles.slideCardBody}>
                    <h3 className={styles.slideCardTitle}>{c.title}</h3>
                    <p className={styles.slideCardText}>{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.v2Chips}>
              <span className={styles.v2ChipsLabel}>Key takeaways</span>
              {(content.keyPoints ?? []).slice(0, 4).map((kp, i) => (
                <span key={i} className={styles.v2Chip}>{kp}</span>
              ))}
            </div>
            {tipBar}
          </>

        ) : variant === 3 ? (
          /* ── Variant 3: header + chips, 2-col concepts, full-width feature card ── */
          <>
            <div className={styles.v3Top}>
              <div className={styles.v3TopText}>
                <span className={styles.slideBreadcrumb}>Chapter {chapterNum} — {module}</span>
                <h1 className={`${styles.slideTitle} ${styles.slideTitleMd}`}>{lesson}</h1>
                <p className={`${styles.slideIntro} ${styles.slideIntroOne}`}>{content.intro}</p>
              </div>
              <div className={styles.v3Chips}>
                {(content.keyPoints ?? []).slice(0, 3).map((kp, i) => (
                  <span key={i} className={styles.v2Chip}>{kp}</span>
                ))}
              </div>
            </div>
            <div className={styles.v3Grid}>
              {content.concepts.slice(0, 2).map((c, i) => (
                <div key={i} className={`${styles.slideCard} ${styles.slideCardSm}`}
                  style={{ '--accent': ACCENT_COLORS[i] } as React.CSSProperties}>
                  <div className={styles.slideCardAccent} />
                  <div className={styles.slideCardBody}>
                    <h3 className={styles.slideCardTitle}>{c.title}</h3>
                    <p className={styles.slideCardText}>{c.body}</p>
                  </div>
                </div>
              ))}
              {content.concepts[2] && (
                <div className={`${styles.slideCard} ${styles.slideCardFull}`}
                  style={{ '--accent': ACCENT_COLORS[2] } as React.CSSProperties}>
                  <div className={styles.slideCardAccentTop} />
                  <div className={styles.slideCardBody}>
                    <h3 className={styles.slideCardTitle}>{content.concepts[2].title}</h3>
                    <p className={`${styles.slideCardText} ${styles.slideCardTextFull}`}>{content.concepts[2].body}</p>
                  </div>
                </div>
              )}
            </div>
            {tipBar}
          </>

        ) : (
          /* ── Variant 0 (default): 2×2 grid ── */
          <>
            <div className={styles.slideTop}>
              <span className={styles.slideBreadcrumb}>Chapter {chapterNum} — {module}</span>
              <h1 className={styles.slideTitle}>{lesson}</h1>
              <p className={styles.slideIntro}>{content.intro}</p>
            </div>
            <div className={styles.slideGrid}>
              {content.concepts.map((c, i) => (
                <div key={i} className={styles.slideCard}
                  style={{ '--accent': ACCENT_COLORS[i] } as React.CSSProperties}>
                  <div className={styles.slideCardAccent} />
                  <div className={styles.slideCardBody}>
                    <h3 className={styles.slideCardTitle}>{c.title}</h3>
                    <p className={styles.slideCardText}>{c.body}</p>
                  </div>
                </div>
              ))}
              <div className={`${styles.slideCard} ${styles.slideCardTakeaways}`}
                style={{ '--accent': TAKEAWAY_ACCENT } as React.CSSProperties}>
                <div className={styles.slideCardAccent} />
                <div className={styles.slideCardBody}>
                  <h3 className={styles.slideCardTitle}>Key Takeaways</h3>
                  <ul className={styles.takeawayList}>
                    {(content.keyPoints ?? []).slice(0, 4).map((kp, i) => (
                      <li key={i} className={styles.takeawayItem}>{kp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {tipBar}
          </>
        )}
      </div>

      {/* ── Footer nav ── */}
      <div className={styles.footerNav}>
        <button className={styles.footerBack} onClick={onBack}>
          Back to course
        </button>
        {!isCompleted ? (
          <button className={styles.completeBtn} onClick={handleComplete}>
            {nextLabel ?? (onNext ? 'Complete and continue' : 'Complete lesson')}
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : onNext ? (
          <button className={styles.nextBtn} onClick={onNext}>
            Next lesson
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : null}
      </div>

    </div>
  );
}
