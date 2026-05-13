export const ERROR_MESSAGES: Record<string, string> = {
  OUTLINE_GENERATION_FAILED: 'Course outline could not be generated. Try again.',
  MODEL_UNREACHABLE: 'The model endpoint could not be reached. Check your base URL in settings.',
  MODEL_AUTH_FAILED: 'Authentication failed. Check your API key in settings.',
  MODEL_PARSE_FAILED: 'The model returned an unexpected response. Check the model name in settings.',
  EXPORT_WRITE_FAILED: 'The file could not be saved. Check you have write permission for the export folder.',
  EXPORT_PATH_INVALID: 'The export path is invalid.',
  STORAGE_READ_FAILED: 'Saved courses could not be loaded.',
  STORAGE_WRITE_FAILED: 'Course could not be saved.',
  STORAGE_SCHEMA_MISMATCH: 'Saved data format has changed. Some courses may need to be re-saved.',
  JOB_CANCELLED: 'Operation was cancelled.',
  AUTH_INVALID_CREDENTIALS: 'Invalid username or password.',
  AUTH_USER_EXISTS: 'A user with that username already exists.',
  AUTH_FORBIDDEN: 'You do not have permission to do that.',
  UNKNOWN: 'An unexpected error occurred.',
};

export const UI = {
  APP_NAME: 'neoCourses',

  // Login
  LOGIN_TITLE: 'Sign in',
  LOGIN_USERNAME: 'Username',
  LOGIN_PASSWORD: 'Password',
  LOGIN_BUTTON: 'Sign in',
  LOGOUT_BUTTON: 'Sign out',

  // Roles
  ROLE_ADMIN: 'Admin',
  ROLE_EDITOR: 'Editor',
  ROLE_TRAINEE: 'Trainee',

  // Dashboard
  DASHBOARD_WELCOME: 'Welcome back',

  // Editor (course creation)
  FORM_TOPIC_LABEL: 'Course topic',
  FORM_AUDIENCE_LABEL: 'Target audience',
  FORM_LEVEL_LABEL: 'Difficulty level',
  FORM_GOAL_LABEL: 'Learning goal',
  FORM_GENERATE_BUTTON: 'Generate outline',
  FORM_GENERATE_MODEL_BUTTON: 'Generate with model',
  FORM_GENERATE_FAKE_BUTTON: 'Generate sample outline',
  EDITOR_UNSAVED_INDICATOR: 'Unsaved changes',
  EDITOR_COPY_BUTTON: 'Copy outline',
  EDITOR_SAVE_BUTTON: 'Save course',
  EDITOR_EXPORT_BUTTON: 'Export to Markdown',
  EDITOR_PUBLISH_BUTTON: 'Publish',
  EDITOR_UNPUBLISH_BUTTON: 'Unpublish',
  SAVED_COURSES_TITLE: 'My courses',
  SAVED_COURSES_EMPTY: 'No courses yet.',
  CONFIRM_DELETE: 'Delete this course? This cannot be undone.',

  // Settings
  SETTINGS_BASE_URL_LABEL: 'Model base URL',
  SETTINGS_API_KEY_LABEL: 'API key',
  SETTINGS_MODEL_LABEL: 'Model name',
  SETTINGS_TEST_BUTTON: 'Test connection',
  SETTINGS_SAVE_BUTTON: 'Save settings',
  SETTINGS_TITLE: 'Model settings',
  CLOSE: 'Close',
  CANCEL_JOB: 'Cancel',

  // Trainee
  STUDENT_CATALOG_TITLE: 'Course catalog',
  STUDENT_CATALOG_EMPTY: 'No published courses available yet.',
  STUDENT_MY_COURSES_TITLE: 'My learning',
  STUDENT_ENROLL_BUTTON: 'Enroll',
  STUDENT_CONTINUE_BUTTON: 'Continue',
  STUDENT_COMPLETE_BUTTON: 'Mark complete',
  STUDENT_PROGRESS_LABEL: 'Progress',

  // Admin
  ADMIN_USERS_TITLE: 'User management',
  ADMIN_CREATE_USER: 'Create user',
  ADMIN_NO_USERS: 'No users found.',
  ADMIN_COURSES_TITLE: 'All courses',
  ADMIN_STATS_TITLE: 'Overview',
  ADMIN_DELETE_USER_CONFIRM: 'Delete this user? This cannot be undone.',
  ADMIN_CHANGE_ROLE: 'Change role',
};
