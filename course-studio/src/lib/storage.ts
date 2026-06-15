import { SCHEMA_VERSION, SavedCourse, ModelSettings, User, CourseEnrollment, StoredQuiz, QuizAttempt } from './types';
import { migrate } from './migrations';

const COURSES_KEY = 'cs_courses_v' + SCHEMA_VERSION;
const SETTINGS_KEY = 'cs_settings_v' + SCHEMA_VERSION;
const USERS_KEY = 'cs_users_v' + SCHEMA_VERSION;
const ENROLLMENTS_KEY = 'cs_enrollments_v' + SCHEMA_VERSION;
const QUIZZES_KEY = 'cs_quizzes_v' + SCHEMA_VERSION;
const ATTEMPTS_KEY = 'cs_quiz_attempts_v' + SCHEMA_VERSION;

export function loadCourses(): SavedCourse[] {
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((c: any) => migrate<SavedCourse>(c, 'course'));
  } catch {
    return [];
  }
}

export function saveCourses(courses: SavedCourse[]): void {
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  } catch (e) {
    console.error('Storage write failed', e);
  }
}

export function loadSettings(): ModelSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrate<ModelSettings>(parsed, 'settings');
  } catch {
    return null;
  }
}

export function saveSettings(settings: ModelSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Settings write failed', e);
  }
}

export function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Users write failed', e);
  }
}

export function loadEnrollments(): CourseEnrollment[] {
  try {
    const raw = localStorage.getItem(ENROLLMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveEnrollments(enrollments: CourseEnrollment[]): void {
  try {
    localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments));
  } catch (e) {
    console.error('Enrollments write failed', e);
  }
}

export function loadQuizzes(): StoredQuiz[] {
  try {
    const raw = localStorage.getItem(QUIZZES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveQuizzes(quizzes: StoredQuiz[]): void {
  try {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
  } catch (e) {
    console.error('Quizzes write failed', e);
  }
}

export function loadQuizAttempts(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveQuizAttempts(attempts: QuizAttempt[]): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch (e) {
    console.error('Quiz attempts write failed', e);
  }
}
