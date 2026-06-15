import { useState, useEffect, useRef } from 'react';
import { SavedCourse, UserSession } from '../../lib/types';
import { useEnrollmentStore } from '../../store/useEnrollmentStore';
import { useQuizStore } from '../../store/useQuizStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { CourseRoadmap, RoadmapModule } from '../../components/CourseRoadmap/CourseRoadmap';
import { LessonView } from '../../components/LessonView/LessonView';
import { generateChapterQuiz, generateLessonContent, cleanForProse, LessonContent, QuizQuestion } from '../../lib/contentGenerator';
import { generateLessonContentAI, generateChapterQuizAI } from '../../lib/modelClient';
import { QuizPresentationMode } from '../../components/QuizPresentationMode/QuizPresentationMode';
import styles from './StudentDashboard.module.css';

type Tab = 'catalog' | 'my-learning';
type Screen = Tab | 'course' | 'lesson' | 'quiz';

type Props = {
  session: UserSession;
  publishedCourses: SavedCourse[];
  initialTab?: Tab;
};

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

const LEVEL_COLORS: Record<string, string> = {
  beginner:     '#16a34a',
  intermediate: '#d97706',
  advanced:     '#dc2626',
};

function parseModules(outline: string): RoadmapModule[] {
  const lines = outline.split('\n');
  const mods: RoadmapModule[] = [];
  let cur: RoadmapModule | null = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      cur = { module: line.replace(/^## /, '').trim(), lessons: [] };
      mods.push(cur);
    } else if (line.startsWith('### ') && cur) {
      cur.lessons.push(line.replace(/^### /, '').trim());
    }
  }
  return mods;
}

function allLessons(outline: string): string[] {
  return outline.split('\n').filter(l => l.startsWith('### ')).map(l => l.replace(/^### /, '').trim());
}

/** Derive a consistent gradient from a course topic string */
function topicGradient(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    'linear-gradient(135deg, #e5ff00 0%, #a3b300 100%)',
    'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
    'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
    'linear-gradient(135deg, #c8df00 0%, #0ea5e9 100%)',
    'linear-gradient(135deg, #e5ff00 0%, #10b981 100%)',
    'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)',
    'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)',
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

export function StudentDashboard({ session, publishedCourses, initialTab = 'catalog' }: Props) {
  const [screen, setScreen] = useState<Screen>(initialTab);
  const [prevScreen, setPrevScreen] = useState<Screen | null>(null);
  const [animDir, setAnimDir] = useState<'right' | 'left'>('right');
  const [activeCourse, setActiveCourse] = useState<SavedCourse | null>(null);
  const [activeLessonTitle, setActiveLessonTitle] = useState<string | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{ moduleIndex: number; moduleName: string; lessons: string[] } | null>(null);
  const [presentationQuiz, setPresentationQuiz] = useState<{ moduleName: string; lessons: string[] } | null>(null);
  const [passedQuizzes, setPassedQuizzes] = useState<Set<string>>(new Set());
  const [lessonContents, setLessonContents] = useState<Map<string, LessonContent>>(new Map());
  const [quizCache, setQuizCache] = useState<Map<string, QuizQuestion[]>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());
  const quizFetchingRef = useRef<Set<string>>(new Set());

  const settings = useSettingsStore(s => s.settings);
  const { saveQuiz, getQuiz, recordAttempt } = useQuizStore();

  // Catalog filters
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');

  function prefetchLesson(title: string, chapterName: string, topic: string) {
    if (!settings.apiKey || lessonContents.has(title) || fetchingRef.current.has(title)) return;
    fetchingRef.current.add(title);
    generateLessonContentAI(title, chapterName, topic, settings)
      .then(result => {
        // Always resolve to content — if the AI call fails (parse error, timeout,
        // unreachable), fall back to the template so the lesson is never left empty.
        const content = result.ok ? result.content : generateLessonContent(title, topic);
        setLessonContents(prev => new Map(prev).set(title, content));
      })
      .catch(() => {
        setLessonContents(prev => new Map(prev).set(title, generateLessonContent(title, topic)));
      })
      .finally(() => fetchingRef.current.delete(title));
  }

  // Build a plain-text digest of a chapter's lesson content for the quiz prompt
  function buildChapterContent(lessons: string[], topic: string): string {
    return lessons
      .map(title => {
        const c = lessonContents.get(title) ?? generateLessonContent(title, topic);
        const concepts = c.concepts.map(x => `- ${x.title}: ${x.body}`).join('\n');
        const keyPoints = (c.keyPoints ?? []).map(k => `- ${k}`).join('\n');
        return [
          `## Lesson: ${title}`,
          c.intro,
          `Concepts:\n${concepts}`,
          keyPoints ? `Key points:\n${keyPoints}` : '',
          c.example ? `Example: ${c.example}` : '',
          `Tip: ${c.tip}`,
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  // Generate the chapter quiz: reuse a previously saved quiz, otherwise prefer
  // AI-formed questions and persist them, falling back to a template.
  function ensureQuiz(courseId: string, chapterName: string, lessons: string[], topic: string) {
    if (lessons.length === 0) return;
    if (quizCache.has(chapterName) || quizFetchingRef.current.has(chapterName)) return;

    // Hydrate from the database so previously generated quizzes load instantly
    // and stay identical across sessions (and match what admins review).
    const saved = getQuiz(courseId, chapterName);
    if (saved) {
      setQuizCache(prev => new Map(prev).set(chapterName, saved.questions));
      return;
    }

    const allModules = parseModules(activeCourse?.outline ?? '');
    const template = generateChapterQuiz(chapterName, lessons, topic, lessonContents, allModules);

    if (!settings.apiKey) {
      setQuizCache(prev => new Map(prev).set(chapterName, template));
      saveQuiz(courseId, chapterName, template);
      return;
    }

    quizFetchingRef.current.add(chapterName);
    const chapterContent = buildChapterContent(lessons, topic);
    generateChapterQuizAI(chapterName, chapterContent, topic, settings)
      .then(result => {
        const questions = result.ok ? result.questions : template;
        setQuizCache(prev => new Map(prev).set(chapterName, questions));
        saveQuiz(courseId, chapterName, questions);
      })
      .catch(() => {
        setQuizCache(prev => new Map(prev).set(chapterName, template));
        saveQuiz(courseId, chapterName, template);
      })
      .finally(() => quizFetchingRef.current.delete(chapterName));
  }

  // Seed the session cache from content pre-generated at publish time so
  // trainees read instantly and no regeneration happens. Keyed on course id so
  // it only runs on course change and never clobbers an in-progress fetch.
  useEffect(() => {
    const generated = activeCourse?.generated?.lessons;
    if (generated) setLessonContents(new Map(Object.entries(generated)));
  }, [activeCourse?.id]);

  // Pre-fetch first chapter's lessons when course screen opens
  useEffect(() => {
    if (screen !== 'course' || !activeCourse || !settings.apiKey) return;
    const mods = parseModules(activeCourse.outline);
    if (!mods.length) return;
    const topic = cleanForProse(activeCourse.topic);
    mods[0].lessons.forEach(l => prefetchLesson(l, mods[0].module, topic));
  }, [screen, activeCourse?.id, settings.apiKey]);

  // Fetch current lesson + pre-fetch next when on lesson screen
  useEffect(() => {
    if (screen !== 'lesson' || !activeLessonTitle || !activeCourse || !settings.apiKey) return;
    const mods = parseModules(activeCourse.outline);
    const topic = cleanForProse(activeCourse.topic);
    let currentChapter = '', nextTitle: string | null = null, nextChapter = '';
    for (let mi = 0; mi < mods.length; mi++) {
      const li = mods[mi].lessons.indexOf(activeLessonTitle);
      if (li === -1) continue;
      currentChapter = mods[mi].module;
      if (li + 1 < mods[mi].lessons.length) {
        nextTitle = mods[mi].lessons[li + 1];
        nextChapter = mods[mi].module;
      } else {
        for (let nmi = mi + 1; nmi < mods.length; nmi++) {
          if (mods[nmi].lessons.length > 0) { nextTitle = mods[nmi].lessons[0]; nextChapter = mods[nmi].module; break; }
        }
      }
      break;
    }
    prefetchLesson(activeLessonTitle, currentChapter, topic);
    if (nextTitle) prefetchLesson(nextTitle, nextChapter, topic);
  }, [screen, activeLessonTitle, activeCourse?.id, settings.apiKey]);

  // Generate the chapter quiz (AI-formed) when a quiz or presentation opens
  useEffect(() => {
    if (!activeCourse) return;
    const topic = cleanForProse(activeCourse.topic);
    if (presentationQuiz) ensureQuiz(activeCourse.id, presentationQuiz.moduleName, presentationQuiz.lessons, topic);
    if (activeQuiz) ensureQuiz(activeCourse.id, activeQuiz.moduleName, activeQuiz.lessons, topic);
  }, [presentationQuiz?.moduleName, activeQuiz?.moduleName, activeCourse?.id, settings.apiKey, lessonContents]);

  const { enroll, toggleLessonComplete, markCourseComplete, getEnrollment, getUserEnrollments } =
    useEnrollmentStore();

  const myEnrollments = getUserEnrollments(session.userId);
  const enrolledCourses = publishedCourses.filter(c => myEnrollments.some(e => e.courseId === c.id));

  const SCREEN_ORDER: Screen[] = ['catalog', 'my-learning', 'course', 'lesson', 'quiz'];

  function navigate(next: Screen, course?: SavedCourse) {
    const ci = SCREEN_ORDER.indexOf(screen);
    const ni = SCREEN_ORDER.indexOf(next);
    setAnimDir(ni >= ci ? 'right' : 'left');
    setPrevScreen(screen);
    if (course) setActiveCourse(course);
    setScreen(next);
  }

  // Filtered catalog
  const filteredCourses = publishedCourses.filter(c => {
    const matchSearch = !search || c.topic.toLowerCase().includes(search.toLowerCase()) || c.audience.toLowerCase().includes(search.toLowerCase());
    const matchLevel = filterLevel === 'all' || c.level === filterLevel;
    return matchSearch && matchLevel;
  });

  // Enrollment helpers
  function getPct(course: SavedCourse): number {
    const enrollment = getEnrollment(session.userId, course.id);
    const lessons = allLessons(course.outline);
    if (!enrollment || lessons.length === 0) return 0;
    return Math.round((enrollment.completedLessons.length / lessons.length) * 100);
  }

  const animClass = animDir === 'right' ? styles.slideInRight : styles.slideInLeft;

  /* ───── Presentation mode overlay (accessible from roadmap) ─ */
  const presentationQuestions = presentationQuiz ? quizCache.get(presentationQuiz.moduleName) : undefined;
  const presentationOverlay = presentationQuiz && activeCourse ? (
    presentationQuestions ? (
      <QuizPresentationMode
        questions={presentationQuestions}
        chapterName={presentationQuiz.moduleName}
        onClose={() => setPresentationQuiz(null)}
      />
    ) : (
      <QuizLoadingOverlay
        chapterName={presentationQuiz.moduleName}
        onClose={() => setPresentationQuiz(null)}
      />
    )
  ) : null;

  /* ───── Chapter quiz ────────────────────────────────── */
  if (screen === 'quiz' && activeCourse && activeQuiz) {
    const questions = quizCache.get(activeQuiz.moduleName);
    const quizModules = parseModules(activeCourse.outline);
    const nextChapterFirst = quizModules[activeQuiz.moduleIndex + 1]?.lessons[0] ?? null;
    return (
      <>
        {presentationOverlay}
        <div key="quiz" className={`${styles.screen} ${animClass}`}>
          {questions ? (
            <ChapterQuizScreen
              chapterName={activeQuiz.moduleName}
              chapterNum={activeQuiz.moduleIndex + 1}
              courseTopic={activeCourse.topic}
              questions={questions}
              alreadyPassed={passedQuizzes.has(activeQuiz.moduleName)}
              onPass={() => setPassedQuizzes(prev => new Set(prev).add(activeQuiz!.moduleName))}
              onAttempt={(result) => recordAttempt({
                userId: session.userId,
                username: session.username,
                courseId: activeCourse!.id,
                courseTopic: activeCourse!.topic,
                chapterName: activeQuiz!.moduleName,
                ...result,
              })}
              onBack={() => navigate('course')}
              onContinue={nextChapterFirst ? () => {
                setActiveLessonTitle(nextChapterFirst);
                navigate('lesson');
              } : undefined}
            />
          ) : (
            <QuizLoadingPanel chapterName={activeQuiz.moduleName} onBack={() => navigate('course')} />
          )}
        </div>
      </>
    );
  }

  /* ───── Lesson view ─────────────────────────────────── */
  if (screen === 'lesson' && activeCourse && activeLessonTitle) {
    const modules = parseModules(activeCourse.outline);
    const enrollment = getEnrollment(session.userId, activeCourse.id);
    const done = enrollment?.completedLessons ?? [];
    const isCompleted = done.includes(activeLessonTitle);

    let chapterNum = 1, lessonNum = 1, totalInChapter = 1, moduleName = '';
    let nextLesson: string | null = null;

    for (let mi = 0; mi < modules.length; mi++) {
      const li = modules[mi].lessons.indexOf(activeLessonTitle);
      if (li !== -1) {
        chapterNum = mi + 1;
        lessonNum = li + 1;
        totalInChapter = modules[mi].lessons.length;
        moduleName = modules[mi].module;
        if (li + 1 < modules[mi].lessons.length) {
          nextLesson = modules[mi].lessons[li + 1];
        } else {
          for (let nmi = mi + 1; nmi < modules.length; nmi++) {
            if (modules[nmi].lessons.length > 0) { nextLesson = modules[nmi].lessons[0]; break; }
          }
        }
        break;
      }
    }

    const lessonContent = lessonContents.get(activeLessonTitle)
      ?? (settings.apiKey ? null : generateLessonContent(activeLessonTitle, moduleName));

    const isLastInChapter = lessonNum === totalInChapter;
    const quizRequired = isLastInChapter && !passedQuizzes.has(moduleName);

    const lessonOnNext = (() => {
      if (!isLastInChapter) {
        return nextLesson ? () => { setActiveLessonTitle(nextLesson!); setScreen('lesson'); } : null;
      }
      if (quizRequired) {
        return () => {
          setActiveQuiz({ moduleIndex: chapterNum - 1, moduleName, lessons: modules[chapterNum - 1].lessons });
          navigate('quiz');
        };
      }
      return nextLesson ? () => { setActiveLessonTitle(nextLesson!); setScreen('lesson'); } : null;
    })();

    const nextLabel = quizRequired ? 'Complete chapter and take quiz' : undefined;

    return (
      <div key={`lesson-${activeLessonTitle}`} className={`${styles.screen} ${animClass}`}>
        <LessonView
          key={activeLessonTitle}
          lesson={activeLessonTitle}
          module={moduleName}
          chapterNum={chapterNum}
          lessonNum={lessonNum}
          totalInChapter={totalInChapter}
          content={lessonContent}
          isCompleted={isCompleted}
          nextLabel={nextLabel}
          onBack={() => navigate('course')}
          onComplete={() => {
            if (!done.includes(activeLessonTitle)) {
              toggleLessonComplete(session.userId, activeCourse.id, activeLessonTitle);
            }
          }}
          onNext={lessonOnNext}
        />
      </div>
    );
  }

  /* ───── Course view ──────────────────────────────────── */
  if (screen === 'course' && activeCourse) {
    const enrollment = getEnrollment(session.userId, activeCourse.id);
    const modules = parseModules(activeCourse.outline);
    const lessons = allLessons(activeCourse.outline);
    const done = enrollment?.completedLessons ?? [];
    const pct = lessons.length > 0 ? Math.round((done.length / lessons.length) * 100) : 0;

    return (
      <>
        {presentationOverlay}
      <div key="course" className={`${styles.screen} ${animClass}`}>
        {/* Course header */}
        <div className={styles.courseHeader}>
          <div className={styles.courseBanner} style={{ background: topicGradient(activeCourse.topic) }}>
            <div className={styles.courseBannerOverlay} />
            <div className={styles.courseBannerContent}>
              <button className={styles.backBtn} onClick={() => navigate('my-learning')}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </button>
              <div className={styles.courseMeta}>
                <span className={styles.courseLevelBadge} style={{ '--lc': LEVEL_COLORS[activeCourse.level] ?? '#d97706' } as React.CSSProperties}>
                  {activeCourse.level}
                </span>
                {enrollment?.completed && (
                  <span className={styles.completedPill}>✓ Completed</span>
                )}
              </div>
              <h1 className={styles.courseTitle}>{activeCourse.topic}</h1>
              <p className={styles.courseAudience}>{activeCourse.audience}</p>
            </div>

            {/* Progress ring */}
            <div className={styles.progressRing}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6"/>
                <circle
                  cx="36" cy="36" r="30" fill="none"
                  stroke="#fff" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - pct / 100)}`}
                  transform="rotate(-90 36 36)"
                  style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
              </svg>
              <span className={styles.progressRingPct}>{pct}%</span>
            </div>
          </div>
        </div>

        {/* Complete button */}
        {pct === 100 && !enrollment?.completed && (
          <div className={styles.completeBar}>
            <span className={styles.completeMsg}>All lessons done. Mark this course as complete.</span>
            <button
              className={styles.completeBtn}
              onClick={() => markCourseComplete(session.userId, activeCourse.id)}
            >
              Mark Complete
            </button>
          </div>
        )}

        {/* Roadmap */}
        <div className={styles.courseBody}>
          {modules.length > 0 ? (
            <CourseRoadmap
              modules={modules}
              completedLessons={done}
              onToggleLesson={lesson => toggleLessonComplete(session.userId, activeCourse.id, lesson)}
              onOpenLesson={lesson => {
                setActiveLessonTitle(lesson);
                navigate('lesson');
              }}
              onOpenQuiz={mi => {
                setActiveQuiz({ moduleIndex: mi, moduleName: modules[mi].module, lessons: modules[mi].lessons });
                navigate('quiz');
              }}
              onOpenPresentation={mi => {
                setPresentationQuiz({ moduleName: modules[mi].module, lessons: modules[mi].lessons });
              }}
              passedQuizModules={passedQuizzes}
            />
          ) : (
            <div className={styles.outlineFallback}>
              <pre className={styles.outlinePre}>{activeCourse.outline}</pre>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  /* ───── Catalog & My Learning ────────────────────────── */
  return (
    <div key={screen} className={`${styles.screen} ${animClass}`}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>
            {screen === 'catalog' ? 'Course Catalog' : 'My Learning'}
          </h1>
          <p className={styles.greetingSubtitle}>
            {screen === 'catalog'
              ? `${publishedCourses.length} course${publishedCourses.length !== 1 ? 's' : ''} available`
              : `${enrolledCourses.length} enrolled · ${enrolledCourses.filter(c => getEnrollment(session.userId, c.id)?.completed).length} completed`}
          </p>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={screen === 'catalog'}
            className={`${styles.tab} ${screen === 'catalog' ? styles.tabActive : ''}`}
            onClick={() => navigate('catalog')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 2v6h10V4H2zm1 1h4v1H3V5zm0 2h6v1H3V7z" fill="currentColor"/>
            </svg>
            Catalog
          </button>
          <button
            role="tab"
            aria-selected={screen === 'my-learning'}
            className={`${styles.tab} ${screen === 'my-learning' ? styles.tabActive : ''}`}
            onClick={() => navigate('my-learning')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 4v3.5l2 1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            My Learning
            {enrolledCourses.length > 0 && (
              <span className={styles.tabCount}>{enrolledCourses.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Catalog filters */}
      {screen === 'catalog' && (
        <div className={styles.filterBar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search courses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filterDropdowns}>
            <select
              className={styles.filterSelect}
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
            >
              <option value="all">All levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      )}

      {/* Course grid */}
      <div className={styles.grid}>
        {screen === 'catalog' && (
          <>
            {filteredCourses.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>{search ? 'No courses match your search' : 'No courses available yet'}</p>
                <p className={styles.emptySub}>{search ? 'Try a different search term or filter.' : 'Check back soon. New courses are being added.'}</p>
              </div>
            )}
            {filteredCourses.map(course => {
              const enrolled = myEnrollments.some(e => e.courseId === course.id);
              const pct = enrolled ? getPct(course) : 0;
              const enrollment = enrolled ? getEnrollment(session.userId, course.id) : null;
              const levelColor = LEVEL_COLORS[course.level] ?? '#d97706';
              const cardModules = parseModules(course.outline);
              const cardLessons = allLessons(course.outline);

              return (
                <div key={course.id} className={styles.card}>
                  <div className={styles.cardBanner} style={{ background: topicGradient(course.topic) }}>
                    <span className={styles.cardLevel} style={{ '--lc': levelColor } as React.CSSProperties}>
                      {course.level}
                    </span>
                    {enrolled && enrollment?.completed && (
                      <span className={styles.cardDone}>✓ Done</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{course.topic}</h3>
                    <p className={styles.cardAudience}>For {course.audience}</p>
                    {course.goal && <p className={styles.cardGoal}>{course.goal}</p>}

                    {cardModules.length > 0 && (
                      <div className={styles.cardSyllabus}>
                        <span className={styles.cardSyllabusLabel}>What you'll cover</span>
                        <ul className={styles.cardSyllabusList}>
                          {cardModules.slice(0, 3).map((m, mi) => (
                            <li key={mi} className={styles.cardSyllabusItem}>{m.module}</li>
                          ))}
                        </ul>
                        {cardModules.length > 3 && (
                          <span className={styles.cardSyllabusMore}>
                            +{cardModules.length - 3} more {cardModules.length - 3 === 1 ? 'chapter' : 'chapters'}
                          </span>
                        )}
                      </div>
                    )}

                    <div className={styles.cardMeta}>
                      <span className={styles.cardMetaItem}>
                        {cardModules.length} {cardModules.length === 1 ? 'chapter' : 'chapters'}
                      </span>
                      <span className={styles.cardMetaDot}>·</span>
                      <span className={styles.cardMetaItem}>
                        {cardLessons.length} {cardLessons.length === 1 ? 'lesson' : 'lessons'}
                      </span>
                      <span className={styles.cardMetaDot}>·</span>
                      <span className={styles.cardMetaItem}>quiz per chapter</span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    {enrolled ? (
                      <div className={styles.enrolledFooter}>
                        <div className={styles.miniProgress}>
                          <div className={styles.miniTrack}>
                            <div className={styles.miniFill} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={styles.miniPct}>{pct}%</span>
                        </div>
                        <button className={styles.openCourseBtn} onClick={() => navigate('course', course)}>
                          {enrollment?.completed ? 'Review course' : pct === 0 ? 'Start course' : 'Continue course'}
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        className={styles.enrollBtn}
                        onClick={() => { enroll(session.userId, course.id); navigate('course', course); }}
                      >
                        Start for free
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {screen === 'my-learning' && (
          <>
            {enrolledCourses.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No courses enrolled yet</p>
                <p className={styles.emptySub}>Browse the catalog and enroll in a course to get started.</p>
                <button className={styles.goToCatalog} onClick={() => navigate('catalog')}>
                  Browse Catalog →
                </button>
              </div>
            )}
            {enrolledCourses.map(course => {
              const enrollment = getEnrollment(session.userId, course.id)!;
              const lessons = allLessons(course.outline);
              const pct = lessons.length > 0
                ? Math.round((enrollment.completedLessons.length / lessons.length) * 100) : 0;
              const modules = parseModules(course.outline);
              const chapDone = modules.filter(m =>
                m.lessons.length > 0 && m.lessons.every(l => enrollment.completedLessons.includes(l))
              ).length;

              return (
                <div
                  key={course.id}
                  className={`${styles.learningCard} ${enrollment.completed ? styles.learningCardDone : ''}`}
                  onClick={() => navigate('course', course)}
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('course', course)}
                  role="button"
                  aria-label={`Open ${course.topic}`}
                >
                  <div className={styles.learningCardBanner} style={{ background: topicGradient(course.topic) }} />
                  <div className={styles.learningCardBody}>
                    <div className={styles.learningCardTop}>
                      <span className={styles.learningLevel} style={{ '--lc': LEVEL_COLORS[course.level] ?? '#d97706' } as React.CSSProperties}>
                        {course.level}
                      </span>
                      {enrollment.completed && <span className={styles.donePill}>Completed</span>}
                    </div>
                    <h3 className={styles.learningTitle}>{course.topic}</h3>
                    <p className={styles.learningAudience}>{course.audience}</p>

                    <div className={styles.learningStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{pct}%</span>
                        <span className={styles.statLabel}>Progress</span>
                      </div>
                      <div className={styles.statDivider} />
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{chapDone}/{modules.length}</span>
                        <span className={styles.statLabel}>Chapters</span>
                      </div>
                      <div className={styles.statDivider} />
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{enrollment.completedLessons.length}/{lessons.length}</span>
                        <span className={styles.statLabel}>Lessons</span>
                      </div>
                    </div>

                    <div className={styles.learningProgress}>
                      <div className={styles.miniTrack}>
                        <div
                          className={styles.miniFill}
                          style={{
                            width: `${pct}%`,
                            background: enrollment.completed
                              ? 'var(--color-success)'
                              : 'linear-gradient(90deg, #e5ff00, #c8df00)',
                          }}
                        />
                      </div>
                    </div>

                    <button
                      className={`${styles.openCourseBtn} ${enrollment.completed ? styles.openCourseBtnDone : ''}`}
                      onClick={e => { e.stopPropagation(); navigate('course', course); }}
                    >
                      {enrollment.completed ? 'Review course' : pct === 0 ? 'Start course' : 'Continue course'}
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.learningCardArrow}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Quiz loading states ──────────────────────────────────────────────────────

function QuizLoadingOverlay({ chapterName, onClose }: { chapterName: string; onClose: () => void }) {
  return (
    <div className={styles.quizLoadingOverlay} data-theme={document.documentElement.dataset.theme ?? 'white'}>
      <button className={styles.quizLoadingClose} onClick={onClose} title="Cancel">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
      <div className={styles.quizLoadingSpinner} />
      <p className={styles.quizLoadingTitle}>Generating quiz questions…</p>
      <p className={styles.quizLoadingSub}>Forming questions from “{chapterName}”</p>
    </div>
  );
}

function QuizLoadingPanel({ chapterName, onBack }: { chapterName: string; onBack: () => void }) {
  return (
    <div className={styles.quizWrapper}>
      <div className={styles.quizHeader}>
        <button className={styles.quizBackBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to course
        </button>
      </div>
      <div className={styles.quizLoadingPanel}>
        <div className={styles.quizLoadingSpinner} />
        <p className={styles.quizLoadingTitle}>Generating quiz questions…</p>
        <p className={styles.quizLoadingSub}>Forming questions from “{chapterName}”</p>
      </div>
    </div>
  );
}

// ─── Chapter quiz screen ──────────────────────────────────────────────────────

type QuizAttemptResult = {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  answers: {
    questionId: string;
    question: string;
    options: string[];
    correctIndex: number;
    selectedIndex: number;
  }[];
};

type ChapterQuizProps = {
  chapterName: string;
  chapterNum: number;
  courseTopic: string;
  questions: QuizQuestion[];
  alreadyPassed: boolean;
  onPass: () => void;
  onAttempt: (result: QuizAttemptResult) => void;
  onBack: () => void;
  onContinue?: () => void;
};

function ChapterQuizScreen({ chapterName, chapterNum, courseTopic, questions, alreadyPassed, onPass, onAttempt, onBack, onContinue }: ChapterQuizProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [justPassed, setJustPassed] = useState(false);
  const [presentMode, setPresentMode] = useState(false);

  const allAnswered = questions.every(q => q.id in answers);
  const score = questions.filter(q => answers[q.id] === q.correctIndex).length;
  const passThreshold = Math.ceil(questions.length * 0.8);
  const passed = score >= passThreshold;
  const nowPassed = alreadyPassed || justPassed;

  function handleSubmit() {
    const sc = questions.filter(q => answers[q.id] === q.correctIndex).length;
    const didPass = sc >= passThreshold;
    setSubmitted(true);
    onAttempt({
      score: sc,
      total: questions.length,
      percentage: questions.length > 0 ? Math.round((sc / questions.length) * 100) : 0,
      passed: didPass,
      answers: questions.map(q => ({
        questionId: q.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        selectedIndex: q.id in answers ? answers[q.id] : -1,
      })),
    });
    if (didPass && !alreadyPassed) {
      setJustPassed(true);
      onPass();
    }
  }

  function handleRetry() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className={styles.quizWrapper}>
      {/* Presentation mode overlay */}
      {presentMode && (
        <QuizPresentationMode
          questions={questions}
          chapterName={chapterName}
          onClose={() => setPresentMode(false)}
        />
      )}

      {/* Header */}
      <div className={styles.quizHeader}>
        <button className={styles.quizBackBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to course
        </button>
        <div className={styles.quizMeta}>
          <div className={styles.quizChapterNum}>{chapterNum}</div>
          <div className={styles.quizMetaText}>
            <span className={styles.quizChapterTag}>Chapter Quiz</span>
            <span className={styles.quizChapterName}>{chapterName}</span>
          </div>
        </div>
        {nowPassed && (
          <span className={styles.quizPassedBadge}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Passed
          </span>
        )}
        <button className={styles.quizPresentBtn} onClick={() => setPresentMode(true)} title="Presentation mode (F11 for fullscreen)">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="1" y="2" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M4 11h5M6.5 9v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Present
        </button>
      </div>

      {/* Body */}
      <div className={styles.quizBody}>
        <div className={styles.quizIntro}>
          <h1 className={styles.quizTitle}>{chapterName}</h1>
          <p className={styles.quizSubtitle}>
            {questions.length} questions drawn from this chapter.
            You need {passThreshold} correct ({Math.round(passThreshold / questions.length * 100)}%) to pass.
          </p>
        </div>

        <div className={styles.quizQuestions}>
          {questions.map((q, qi) => {
            const selected = answers[q.id];
            const isCorrect = submitted && selected === q.correctIndex;
            const isWrong   = submitted && selected !== undefined && selected !== q.correctIndex;

            return (
              <div key={q.id} className={`${styles.quizQ} ${submitted ? (isCorrect ? styles.quizQCorrect : isWrong ? styles.quizQWrong : '') : ''}`}>
                <p className={styles.quizQText}>
                  <span className={styles.quizQNum}>Q{qi + 1}</span>
                  <span className={styles.quizQContent}>{q.question}</span>
                </p>
                <div className={styles.quizOptions}>
                  {q.options.map((opt, oi) => {
                    const sel = selected === oi;
                    const right = submitted && oi === q.correctIndex;
                    const wrong = submitted && sel && oi !== q.correctIndex;
                    return (
                      <label key={oi} className={`${styles.quizOpt} ${sel ? styles.quizOptSel : ''} ${right ? styles.quizOptRight : ''} ${wrong ? styles.quizOptWrong : ''}`}>
                        <input
                          type="radio"
                          name={q.id}
                          value={oi}
                          checked={sel}
                          onChange={() => !submitted && setAnswers(a => ({ ...a, [q.id]: oi }))}
                          disabled={submitted}
                          className={styles.quizRadio}
                        />
                        <span className={styles.quizOptMark} />
                        <span className={styles.quizOptText}>{opt}</span>
                        {right && <svg className={styles.quizOptIcon} width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {wrong && <svg className={styles.quizOptIcon} width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!submitted ? (
          <button className={styles.quizSubmit} onClick={handleSubmit} disabled={!allAnswered}>
            Submit answers
          </button>
        ) : (
          <div className={`${styles.quizResults} ${passed ? styles.quizResultsPass : styles.quizResultsFail}`}>
            <div className={styles.quizScore}>
              <span className={styles.quizScoreNum}>{score}</span>
              <span className={styles.quizScoreDen}>/ {questions.length}</span>
            </div>
            <div className={styles.quizResultsText}>
              {passed ? (
                <>
                  <p className={styles.quizResultsHeading}>{justPassed ? 'Chapter complete!' : 'Already passed'}</p>
                  <p className={styles.quizResultsSub}>{justPassed ? `You scored ${score}/${questions.length} and passed this chapter quiz.` : 'You have already passed this quiz.'}</p>
                </>
              ) : (
                <>
                  <p className={styles.quizResultsHeading}>Not quite — {passThreshold - score} more correct needed</p>
                  <p className={styles.quizResultsSub}>Review the lessons in this chapter and try again.</p>
                </>
              )}
            </div>
            <div className={styles.quizResultsActions}>
              {!passed && <button className={styles.quizRetry} onClick={handleRetry}>Try again</button>}
              <button className={styles.quizDone} onClick={passed && onContinue ? onContinue : onBack}>
                {passed ? (onContinue ? 'Start next chapter' : 'Continue') : 'Back to course'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
