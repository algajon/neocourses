import { useState } from 'react';
import styles from './CourseRoadmap.module.css';

export type RoadmapModule = {
  module: string;
  lessons: string[];
};

type Props = {
  modules: RoadmapModule[];
  completedLessons: string[];
  onToggleLesson: (lesson: string) => void;
  onOpenLesson?: (lesson: string) => void;
  onOpenQuiz?: (moduleIndex: number) => void;
  passedQuizModules?: Set<string>;
};

export function CourseRoadmap({ modules, completedLessons, onToggleLesson, onOpenLesson, onOpenQuiz, passedQuizModules }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allLessons = modules.flatMap(m => m.lessons);
  const totalDone = completedLessons.length;
  const totalLessons = allLessons.length;
  const overallPct = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;

  function toggle(mod: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(mod) ? next.delete(mod) : next.add(mod);
      return next;
    });
  }

  return (
    <div className={styles.roadmap}>
      {/* Overall progress bar */}
      <div className={styles.overallProgress}>
        <div className={styles.overallTop}>
          <span className={styles.overallLabel}>Overall progress</span>
          <span className={styles.overallPct}>{overallPct}%</span>
        </div>
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100}>
          <div className={styles.progressFill} style={{ width: `${overallPct}%` }} />
        </div>
        <span className={styles.progressCount}>{totalDone} of {totalLessons} lessons complete</span>
      </div>

      {/* Chapter list */}
      <div className={styles.chapterList}>
        {modules.map((mod, mi) => {
          const modDone = mod.lessons.filter(l => completedLessons.includes(l)).length;
          const modPct = mod.lessons.length > 0 ? Math.round((modDone / mod.lessons.length) * 100) : 0;
          const isComplete = modDone === mod.lessons.length && mod.lessons.length > 0;
          const isOpen = !collapsed.has(mod.module);

          return (
            <div key={mod.module} className={`${styles.chapter} ${isComplete ? styles.chapterComplete : ''}`}>
              {/* Chapter header */}
              <button
                className={styles.chapterHeader}
                onClick={() => toggle(mod.module)}
                aria-expanded={isOpen}
              >
                <div className={`${styles.chapterNum} ${isComplete ? styles.chapterNumDone : ''}`}>
                  {isComplete ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span>{mi + 1}</span>
                  )}
                </div>

                <div className={styles.chapterInfo}>
                  <span className={styles.chapterTag}>Chapter {mi + 1}</span>
                  <span className={styles.chapterName}>{mod.module}</span>
                </div>

                <div className={styles.chapterRight}>
                  <span className={styles.chapterPct}>{modPct}%</span>
                  {isComplete && onOpenQuiz && (
                    <button
                      className={`${styles.quizBtn} ${passedQuizModules?.has(mod.module) ? styles.quizBtnPassed : ''}`}
                      onClick={e => { e.stopPropagation(); onOpenQuiz(mi); }}
                      title={passedQuizModules?.has(mod.module) ? 'Quiz passed' : 'Take chapter quiz'}
                    >
                      {passedQuizModules?.has(mod.module) ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Quiz passed
                        </>
                      ) : 'Take quiz'}
                    </button>
                  )}
                  <span className={`${styles.chapterArrow} ${isOpen ? styles.chapterArrowOpen : ''}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </div>
              </button>

              {/* Lessons */}
              {isOpen && (
                <div className={styles.lessonList}>
                  {mod.lessons.map((lesson, li) => {
                    const isDone = completedLessons.includes(lesson);
                    const isNext = !isDone && li === mod.lessons.findIndex(l => !completedLessons.includes(l));

                    return (
                      <div key={lesson} className={styles.lessonRow}>
                        {/* Connecting line */}
                        <div className={styles.lessonConnector}>
                          <div className={`${styles.connLine} ${li === 0 ? styles.connLineFirst : ''}`} />
                          <button
                            className={`${styles.lessonNode} ${isDone ? styles.lessonNodeDone : ''} ${isNext ? styles.lessonNodeNext : ''}`}
                            onClick={() => onToggleLesson(lesson)}
                            aria-pressed={isDone}
                            title={isDone ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {isDone && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          {li < mod.lessons.length - 1 && (
                            <div className={`${styles.connLine} ${isDone ? styles.connLineDone : ''}`} />
                          )}
                        </div>

                        <button
                          className={`${styles.lessonContent} ${isDone ? styles.lessonDone : ''} ${isNext ? styles.lessonNext : ''}`}
                          onClick={() => onOpenLesson?.(lesson)}
                          disabled={!onOpenLesson}
                        >
                          <span className={styles.lessonLabel}>
                            {isNext && <span className={styles.nextBadge}>Up next</span>}
                            {lesson}
                          </span>
                          {onOpenLesson && (
                            <svg className={styles.lessonArrow} width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                  {mod.lessons.length === 0 && (
                    <p className={styles.noLessons}>No lessons defined for this chapter.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
