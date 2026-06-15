import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { PAIRING_EVENTS, parseOutlineModules, type PresentCourseEvent } from '@courseneo/shared';
import { useAuthStore } from './store/useAuthStore';
import { useCourseStore } from './store/useCourseStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useEnrollmentStore } from './store/useEnrollmentStore';
import { useQuizStore } from './store/useQuizStore';
import { useJobProgress } from './hooks/useJobProgress';
import { generateChapterQuiz, LessonContent, QuizQuestion } from './lib/contentGenerator';
import { generateLessonContentAI } from './lib/modelClient';
import { AppSidebar, AppView, Theme } from './components/AppSidebar/AppSidebar';
import { LoginScreen } from './views/LoginScreen/LoginScreen';
import { EditorDashboard } from './views/EditorDashboard/EditorDashboard';
import { StudentDashboard } from './views/StudentDashboard/StudentDashboard';
import { AdminDashboard } from './views/AdminDashboard/AdminDashboard';
import { QuizPresentationMode } from './components/QuizPresentationMode/QuizPresentationMode';
import { CourseFinalizeModal } from './components/CourseFinalizeModal/CourseFinalizeModal';
import { SavedCourse } from './lib/types';
import styles from './App.module.css';

const THEME_KEY = 'nc_theme';

function loadTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || 'white';
}

function defaultView(role: string): AppView {
  if (role === 'admin')  return 'admin';
  if (role === 'editor') return 'import';
  return 'catalog';
}

export default function App() {
  useJobProgress();

  const { session, logout, init: initAuth } = useAuthStore();
  const { courses, loadFromStorage, updateCourse, deleteCourse } = useCourseStore();
  const { loadFromStorage: loadSettings } = useSettingsStore();
  const { loadFromStorage: loadEnrollments } = useEnrollmentStore();
  const { loadFromStorage: loadQuizData } = useQuizStore();

  const [ready, setReady]             = useState(false);
  const [theme, setTheme]             = useState<Theme>(loadTheme);
  const [currentView, setCurrentView] = useState<AppView>('catalog');
  const [presentation, setPresentation] = useState<{ questions: QuizQuestion[]; chapterName: string } | null>(null);
  const [finalizingCourse, setFinalizingCourse] = useState<SavedCourse | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      await initAuth();
      loadFromStorage();
      loadSettings();
      loadEnrollments();
      loadQuizData();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (session) setCurrentView(defaultView(session.role));
  }, [session?.userId]);

  // A paired phone can trigger a course presentation on this desktop.
  useEffect(() => {
    const unlisten = listen<PresentCourseEvent>(PAIRING_EVENTS.presentCourse, async e => {
      try {
        const course = useCourseStore.getState().courses.find(c => c.id === e.payload.courseId);
        if (!course) return;
        const mods = parseOutlineModules(course.outline);
        if (mods.length === 0) return;
        const first = mods[0];

        let aiContents: Map<string, LessonContent> | undefined;
        const settings = useSettingsStore.getState().settings;
        if (settings.apiKey) {
          try {
            const results = await Promise.all(
              first.lessons.map(l => generateLessonContentAI(l, first.module, course.topic, settings))
            );
            const map = new Map<string, LessonContent>();
            results.forEach((r, i) => { if (r.ok) map.set(first.lessons[i], r.content); });
            if (first.lessons.every(l => map.has(l))) aiContents = map;
          } catch {
            aiContents = undefined;
          }
        }

        const questions = generateChapterQuiz(first.module, first.lessons, course.topic, aiContents, mods);
        if (questions.length === 0) return;
        setPresentation({ questions, chapterName: first.module });
      } catch {
        // never throw out of the event handler
      }
    });
    return () => { void unlisten.then(fn => fn()); };
  }, []);

  if (!ready) return null;
  if (!session) return <LoginScreen />;

  const publishedCourses = courses.filter(c => c.published);

  // Publishing pre-generates and persists all content behind the finalize
  // modal; unpublishing is immediate.
  function requestPublish(courseId: string) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    if (course.published) updateCourse(courseId, { published: false });
    else setFinalizingCourse(course);
  }

  function handleViewChange(next: AppView) {
    setCurrentView(next);
  }

  const isEditorOrAdmin = session.role === 'editor' || session.role === 'admin';
  const isTrainee = session.role === 'trainee';

  return (
    <div className={styles.app}>
      <div className={styles.texture} aria-hidden="true" />

      <AppSidebar
        session={session}
        currentView={currentView}
        onViewChange={handleViewChange}
        theme={theme}
        onThemeChange={setTheme}
        onLogout={logout}
      />

      <div className={styles.content}>
        {currentView === 'import' && isEditorOrAdmin && (
          <EditorDashboard session={session} onRequestPublish={requestPublish} />
        )}

        {currentView === 'admin' && session.role === 'admin' && (
          <AdminDashboard
            courses={courses}
            onPublishToggle={requestPublish}
            onDeleteCourse={deleteCourse}
          />
        )}

        {currentView === 'catalog' && isTrainee && (
          <StudentDashboard
            session={session}
            publishedCourses={publishedCourses}
            initialTab="catalog"
          />
        )}

        {currentView === 'my-learning' && isTrainee && (
          <StudentDashboard
            session={session}
            publishedCourses={publishedCourses}
            initialTab="my-learning"
          />
        )}
      </div>

      {presentation && (
        <QuizPresentationMode
          questions={presentation.questions}
          chapterName={presentation.chapterName}
          onClose={() => setPresentation(null)}
        />
      )}

      {finalizingCourse && (
        <CourseFinalizeModal
          course={finalizingCourse}
          onPublished={() => setFinalizingCourse(null)}
          onCancel={() => setFinalizingCourse(null)}
        />
      )}
    </div>
  );
}
