'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { LessonContent } from '@/lib/ai/types'
import { Icon } from '@/components/Icon'
import { PresentationMode } from '@/components/PresentationMode'
import { QuizPresentationMode } from '@/components/QuizPresentationMode'
import { LessonSlide } from '@/components/LessonSlide'
import styles from './page.module.css'

interface ChecklistItem {
  id: string
  text: string
  description: string | null
  isRequired: boolean
  position: number
}

interface QuizOption {
  id: string
  text: string
}

interface QuizQuestion {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  options: QuizOption[] | null
  correctAnswer: string
  explanation: string | null
}

interface PreviewLesson {
  id: string
  title: string
  position: number
  content: LessonContent | null
}

interface PreviewModule {
  id: string
  title: string
  description: string | null
  position: number
  lessons: PreviewLesson[]
  quiz: {
    id: string
    title: string
    questions: QuizQuestion[]
  } | null
}

interface PreviewCourse {
  id: string
  title: string
  description: string | null
  status: string
  modules: PreviewModule[]
  checklist: {
    id: string
    title: string
    items: ChecklistItem[]
  } | null
}

export default function PreviewPage() {
  const params = useParams()
  const courseId = params.id as string

  const [course, setCourse] = useState<PreviewCourse | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeModuleIdx, setActiveModuleIdx] = useState(0)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [view, setView] = useState<'lesson' | 'quiz' | 'checklist'>('lesson')
  const [presenting, setPresenting] = useState(false)
  const [presentingQuizModuleIdx, setPresentingQuizModuleIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/courses/${courseId}/preview`)
      .then(r => r.json())
      .then((data: PreviewCourse) => {
        setCourse(data)
        const firstLesson = data.modules[0]?.lessons[0]
        if (firstLesson) setActiveLessonId(firstLesson.id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [courseId])

  const activeModule = course?.modules[activeModuleIdx] ?? null
  const activeLesson = activeModule?.lessons.find(l => l.id === activeLessonId) ?? null

  const goNext = useCallback(() => {
    if (!course || !activeModule) return
    const lessons = activeModule.lessons
    const lessonIdx = lessons.findIndex(l => l.id === activeLessonId)

    if (view === 'lesson') {
      if (lessonIdx < lessons.length - 1) {
        setActiveLessonId(lessons[lessonIdx + 1].id)
      } else if (activeModule.quiz) {
        setView('quiz')
      } else if (activeModuleIdx < course.modules.length - 1) {
        const nextMod = course.modules[activeModuleIdx + 1]
        setActiveModuleIdx(activeModuleIdx + 1)
        setActiveLessonId(nextMod.lessons[0]?.id ?? null)
        setView('lesson')
      }
    } else if (view === 'quiz') {
      if (activeModuleIdx < course.modules.length - 1) {
        const nextMod = course.modules[activeModuleIdx + 1]
        setActiveModuleIdx(activeModuleIdx + 1)
        setActiveLessonId(nextMod.lessons[0]?.id ?? null)
        setView('lesson')
      }
    }
  }, [course, activeModule, activeModuleIdx, activeLessonId, view])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading preview...</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          Course not found.{' '}
          <Link href={`/admin/courses/${courseId}/outline`} className={styles.backLink}>Back to outline</Link>
        </div>
      </div>
    )
  }

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0)
  const content = activeLesson?.content

  return (
    <div className={styles.shell}>
      {/* ── Sidebar: course navigation ── */}
      <nav className={styles.navSidebar}>
        <div className={styles.navHeader}>
          <Link href={`/admin/courses/${courseId}/outline`} className={styles.navBackBtn}>
            <Icon name="arrowLeft" size={13} /> Back to outline
          </Link>
          <div className={styles.navHeaderRow}>
            <div className={styles.navPreviewBadge}>Preview Mode</div>
            <button
              className={styles.presentBtn}
              onClick={() => setPresenting(true)}
              title="Present fullscreen"
            >
              <Icon name="expand" size={14} />
              Present
            </button>
          </div>
        </div>

        <div className={styles.navCourseTitle}>{course.title}</div>

        <div className={styles.navModules}>
          {course.modules.map((mod, mIdx) => (
            <div key={mod.id} className={styles.navModule}>
              <button
                className={`${styles.navModuleTitle} ${mIdx === activeModuleIdx ? styles.navModuleActive : ''}`}
                onClick={() => {
                  setActiveModuleIdx(mIdx)
                  if (mod.lessons[0]) setActiveLessonId(mod.lessons[0].id)
                  setView('lesson')
                }}
              >
                <span className={styles.navModuleNum}>{mIdx + 1}</span>
                {mod.title}
              </button>

              {mIdx === activeModuleIdx && (
                <div className={styles.navLessons}>
                  {mod.lessons.map((lesson, lIdx) => (
                    <button
                      key={lesson.id}
                      className={`${styles.navLessonBtn} ${activeLessonId === lesson.id && view === 'lesson' ? styles.navLessonActive : ''}`}
                      onClick={() => {
                        setActiveLessonId(lesson.id)
                        setView('lesson')
                      }}
                    >
                      <span className={styles.navLessonNum}>{lIdx + 1}</span>
                      {lesson.title}
                    </button>
                  ))}
                  {mod.quiz && (
                    <button
                      className={`${styles.navLessonBtn} ${styles.navQuizBtn} ${view === 'quiz' && mIdx === activeModuleIdx ? styles.navLessonActive : ''}`}
                      onClick={() => {
                        setActiveModuleIdx(mIdx)
                        setView('quiz')
                      }}
                    >
                      <span className={styles.navLessonNum}>Q</span>
                      Chapter Quiz
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {course.checklist && (
            <button
              className={`${styles.navModuleTitle} ${view === 'checklist' ? styles.navModuleActive : ''}`}
              onClick={() => setView('checklist')}
            >
              <span className={styles.navModuleNum}><Icon name="check" size={11} /></span>
              Onboarding Checklist
            </button>
          )}
        </div>
      </nav>

      {/* ── Main content area ── */}
      <main className={styles.main}>
        {view === 'lesson' && activeLesson && (
          <div className={styles.slide}>
            <header className={styles.slideHeader}>
              <div className={styles.slideHeaderLeft}>
                <span className={styles.moduleTag}>{activeModule?.title}</span>
              </div>
              <div className={styles.lessonCounter}>
                {(activeModule?.lessons.findIndex(l => l.id === activeLessonId) ?? 0) + 1} / {activeModule?.lessons.length}
              </div>
            </header>

            <div className={styles.slideBody}>
              {content ? (
                <LessonSlide
                  content={content}
                  lessonTitle={activeLesson.title}
                  moduleTitle={activeModule?.title ?? ''}
                  chapterNum={activeModuleIdx + 1}
                />
              ) : (
                <div className={styles.noContent}>
                  <h1 className={styles.lessonTitle}>{activeLesson.title}</h1>
                  <p>No content generated yet for this lesson.</p>
                  <Link href={`/admin/courses/${courseId}/lessons/${activeLesson.id}`} className="btn-secondary">
                    Edit lesson content <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              )}
            </div>

            <footer className={styles.slideFooter}>
              <div />
              <button className={styles.nextBtn} onClick={goNext}>
                Next <Icon name="arrowRight" size={14} />
              </button>
            </footer>
          </div>
        )}

        {view === 'quiz' && activeModule?.quiz && (
          <div className={styles.slide}>
            <header className={styles.slideHeader}>
              <div className={styles.slideHeaderLeft}>
                <span className={styles.moduleTag}>{activeModule.title}</span>
              </div>
              <div className={styles.slideHeaderRight}>
                <button
                  className={styles.presentBtn}
                  onClick={() => setPresentingQuizModuleIdx(activeModuleIdx)}
                  title="Present quiz fullscreen"
                >
                  <Icon name="expand" size={14} />
                  Present quiz
                </button>
                <span className={styles.quizBadge}>Quiz Preview</span>
              </div>
            </header>

            <div className={styles.slideBody}>
              <h1 className={styles.lessonTitle}>{activeModule.quiz.title}</h1>
              <p className={styles.intro}>
                {activeModule.quiz.questions.length} question{activeModule.quiz.questions.length !== 1 ? 's' : ''}.
                This quiz will test knowledge from this module.
              </p>

              <div className={styles.quizQuestions}>
                {activeModule.quiz.questions.map((q, i) => (
                  <div key={q.id} className={styles.quizQuestion}>
                    <div className={styles.quizQNum}>Q{i + 1}</div>
                    <div className={styles.quizQContent}>
                      <p className={styles.quizQText}>{q.questionText}</p>
                      {q.questionType === 'multiple_choice' && q.options && (
                        <div className={styles.quizOptions}>
                          {q.options.map(opt => (
                            <div
                              key={opt.id}
                              className={`${styles.quizOption} ${opt.id === q.correctAnswer ? styles.quizOptionCorrect : ''}`}
                            >
                              <span className={styles.quizOptionId}>{opt.id.toUpperCase()}</span>
                              <span className={styles.quizOptionText}>{opt.text}</span>
                              {opt.id === q.correctAnswer && (
                                <span className={styles.quizCorrectMark}><Icon name="check" size={14} /></span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.questionType === 'true_false' && (
                        <div className={styles.quizOptions}>
                          {['true', 'false'].map(val => (
                            <div
                              key={val}
                              className={`${styles.quizOption} ${val === q.correctAnswer ? styles.quizOptionCorrect : ''}`}
                            >
                              <span className={styles.quizOptionText}>{val === 'true' ? 'True' : 'False'}</span>
                              {val === q.correctAnswer && <span className={styles.quizCorrectMark}><Icon name="check" size={14} /></span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.explanation && (
                        <p className={styles.quizExplanation}>{q.explanation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <footer className={styles.slideFooter}>
              <div />
              <button className={styles.nextBtn} onClick={goNext}>
                Next module <Icon name="arrowRight" size={14} />
              </button>
            </footer>
          </div>
        )}

        {view === 'checklist' && course.checklist && (
          <div className={styles.slide}>
            <header className={styles.slideHeader}>
              <span className={styles.moduleTag}>Onboarding</span>
            </header>

            <div className={styles.slideBody}>
              <h1 className={styles.lessonTitle}>{course.checklist.title}</h1>
              <p className={styles.intro}>
                Complete the following items as part of your onboarding.
              </p>

              <div className={styles.checklistItems}>
                {course.checklist.items.map(item => (
                  <div key={item.id} className={styles.checklistItem}>
                    <div className={`${styles.checklistCheck} ${item.isRequired ? styles.checklistCheckRequired : ''}`}>
                      {item.isRequired && <span className={styles.checklistRequired} title="Required">!</span>}
                    </div>
                    <div className={styles.checklistItemContent}>
                      <div className={styles.checklistItemText}>
                        {item.text}
                        {item.isRequired && (
                          <span className={styles.checklistRequiredPill}>Required</span>
                        )}
                      </div>
                      {item.description && (
                        <p className={styles.checklistItemDesc}>{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {presenting && (
        <PresentationMode
          courseTitle={course.title}
          modules={course.modules.map(m => ({
            title: m.title,
            position: m.position,
            lessons: m.lessons.map(l => ({ title: l.title, content: l.content })),
          }))}
          onClose={() => setPresenting(false)}
        />
      )}

      {presentingQuizModuleIdx !== null && course.modules[presentingQuizModuleIdx]?.quiz && (
        <QuizPresentationMode
          title={course.modules[presentingQuizModuleIdx].quiz!.title}
          questions={course.modules[presentingQuizModuleIdx].quiz!.questions}
          onClose={() => setPresentingQuizModuleIdx(null)}
        />
      )}
    </div>
  )
}
