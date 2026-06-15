import type { LessonContent } from './contentGenerator';

export const SCHEMA_VERSION = 1;

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export type UserRole = 'admin' | 'editor' | 'trainee';

export type User = {
  id: string;
  schemaVersion: number;
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
};

export type UserSession = {
  userId: string;
  username: string;
  role: UserRole;
};

export type CourseEnrollment = {
  userId: string;
  courseId: string;
  enrolledAt: string;
  completedLessons: string[];  // lesson heading titles marked done
  completed: boolean;
};

// Pre-generated lesson content, persisted at publish time so trainees read
// fully finalized content with zero waiting. Keyed by lesson title to match
// the StudentDashboard session cache read.
export type GeneratedContent = {
  lessons: Record<string, LessonContent>;
  generatedAt: string;
};

export type SavedCourse = {
  id: string;
  schemaVersion: number;
  topic: string;
  audience: string;
  level: CourseLevel;
  goal: string;
  outline: string;
  published: boolean;        // true = visible to trainees
  generated?: GeneratedContent;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  tags: string[];
};

// A quiz question persisted to storage. Mirrors QuizQuestion in contentGenerator.
export type StoredQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

// Generated quiz for one chapter of a course, saved so it survives reloads
// and so admins can review exactly what was asked.
export type StoredQuiz = {
  courseId: string;
  chapterName: string;
  questions: StoredQuizQuestion[];
  updatedAt: string;
};

// One answer within a trainee's quiz attempt.
export type QuizAttemptAnswer = {
  questionId: string;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number; // -1 when left unanswered
};

// A single completed quiz attempt by a trainee — the unit of analytics.
export type QuizAttempt = {
  id: string;
  userId: string;
  username: string;
  courseId: string;
  courseTopic: string;
  chapterName: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  answers: QuizAttemptAnswer[];
  takenAt: string;
};

export type ModelTier = 'fast' | 'heavy';

export type ModelSettings = {
  schemaVersion: number;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Compute tier for the on-prem DGX cluster (X-LLM-Tier). Default 'heavy'. */
  tier: ModelTier;
};

export type JobStatus = 'idle' | 'running' | 'complete' | 'failed' | 'cancelled';

export type Job = {
  id: string;
  label: string;
  status: JobStatus;
  progress: number;
  error?: AppError;
};

export type AppError = {
  code: ErrorCode;
  message: string;
  detail?: string;
};

export type ErrorCode =
  | 'OUTLINE_GENERATION_FAILED'
  | 'MODEL_UNREACHABLE'
  | 'MODEL_AUTH_FAILED'
  | 'MODEL_PARSE_FAILED'
  | 'EXPORT_WRITE_FAILED'
  | 'EXPORT_PATH_INVALID'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_SCHEMA_MISMATCH'
  | 'JOB_CANCELLED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_EXISTS'
  | 'AUTH_FORBIDDEN'
  | 'PAIRING_FAILED'
  | 'PAIRING_NOT_ACTIVE'
  | 'UNKNOWN';
