import { useEffect, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useCourseStore } from './store/useCourseStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useEnrollmentStore } from './store/useEnrollmentStore';
import { useJobProgress } from './hooks/useJobProgress';
import { AppSidebar, AppView, Theme } from './components/AppSidebar/AppSidebar';
import { LoginScreen } from './views/LoginScreen/LoginScreen';
import { EditorDashboard } from './views/EditorDashboard/EditorDashboard';
import { StudentDashboard } from './views/StudentDashboard/StudentDashboard';
import { AdminDashboard } from './views/AdminDashboard/AdminDashboard';
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

  const [ready, setReady]             = useState(false);
  const [theme, setTheme]             = useState<Theme>(loadTheme);
  const [currentView, setCurrentView] = useState<AppView>('catalog');

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
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (session) setCurrentView(defaultView(session.role));
  }, [session?.userId]);

  if (!ready) return null;
  if (!session) return <LoginScreen />;

  const publishedCourses = courses.filter(c => c.published);

  function handlePublishToggle(courseId: string) {
    const course = courses.find(c => c.id === courseId);
    if (course) updateCourse(courseId, { published: !course.published });
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
          <EditorDashboard session={session} />
        )}

        {currentView === 'admin' && session.role === 'admin' && (
          <AdminDashboard
            courses={courses}
            onPublishToggle={handlePublishToggle}
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
    </div>
  );
}
