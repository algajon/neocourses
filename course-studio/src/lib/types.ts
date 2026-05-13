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

export type SavedCourse = {
  id: string;
  schemaVersion: number;
  topic: string;
  audience: string;
  level: CourseLevel;
  goal: string;
  outline: string;
  published: boolean;        // true = visible to trainees
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  tags: string[];
};

export type ModelSettings = {
  schemaVersion: number;
  baseUrl: string;
  apiKey: string;
  model: string;
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
  | 'UNKNOWN';
