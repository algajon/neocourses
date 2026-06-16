import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  settings: text('settings'),
  // Billing: plan is one of 'free' | 'team' | 'business'. planStatus mirrors the
  // Stripe subscription status ('active' | 'trialing' | 'past_due' | 'canceled'),
  // defaulting to 'active' so orgs work out of the box / in billing-disabled mode.
  plan: text('plan').default('free').notNull(),
  planStatus: text('plan_status').default('active').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

// One row per org per billing period; tracks AI course generations consumed so a
// plan's monthly limit can be enforced. periodStart is the first day of the
// current calendar month (UTC); a new period implicitly resets the count.
export const usageCounters = pgTable(
  'usage_counters',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id).notNull(),
    periodStart: text('period_start').notNull(),
    generationsUsed: integer('generations_used').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    orgPeriodIdx: uniqueIndex('uc_org_period_idx').on(t.organizationId, t.periodStart),
  })
)

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').default('learner').notNull(),
    avatarUrl: text('avatar_url'),
    jobTitle: text('job_title'),
    department: text('department'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    orgIdx: index('users_org_idx').on(t.organizationId),
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
  })
)

export const courses = pgTable(
  'courses',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organizations.id),
    createdById: text('created_by_id').references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('draft').notNull(),
    courseType: text('course_type').default('custom').notNull(),
    difficultyLevel: text('difficulty_level').default('beginner').notNull(),
    estimatedMinutes: integer('estimated_minutes'),
    thumbnailUrl: text('thumbnail_url'),
    // Sales: 'free' (fully free), 'paid' (purchase to enroll), 'first_chapter_free'
    // (enroll free, chapters 2+ locked until purchased). priceCents applies to
    // paid + first_chapter_free.
    pricingModel: text('pricing_model').default('free').notNull(),
    priceCents: integer('price_cents').default(0).notNull(),
    tags: text('tags'),
    certificateEnabled: boolean('certificate_enabled').default(false),
    passingScore: real('passing_score').default(0.7),
    reviewStatus: text('review_status').default('none').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index('courses_org_idx').on(t.organizationId),
    orgStatusIdx: index('courses_org_status_idx').on(t.organizationId, t.status),
  })
)

export const sourceMaterials = pgTable(
  'source_materials',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    uploadedById: text('uploaded_by_id').references(() => users.id),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    filePath: text('file_path').notNull(),
    fileSizeBytes: integer('file_size_bytes'),
    status: text('status').default('pending').notNull(),
    extractedText: text('extracted_text'),
    processingError: text('processing_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    courseIdx: index('sm_course_idx').on(t.courseId),
  })
)

export const modules = pgTable(
  'modules',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    courseIdx: index('modules_course_idx').on(t.courseId),
  })
)

export const lessons = pgTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    moduleId: text('module_id').references(() => modules.id).notNull(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    contentJson: text('content_json'),
    learningObjectives: text('learning_objectives'),
    keyPoints: text('key_points'),
    lessonSummary: text('lesson_summary'),
    estimatedMinutes: integer('estimated_minutes').default(10),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    moduleIdx: index('lessons_module_idx').on(t.moduleId),
    courseIdx: index('lessons_course_idx').on(t.courseId),
  })
)

export const quizzes = pgTable(
  'quizzes',
  {
    id: text('id').primaryKey(),
    moduleId: text('module_id').references(() => modules.id).notNull(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    title: text('title').notNull(),
    passingScore: real('passing_score').default(0.7),
    maxAttempts: integer('max_attempts'),
    timeLimitMinutes: integer('time_limit_minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    courseIdx: index('quizzes_course_idx').on(t.courseId),
    moduleIdx: index('quizzes_module_idx').on(t.moduleId),
  })
)

export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id').references(() => quizzes.id).notNull(),
    questionText: text('question_text').notNull(),
    questionType: text('question_type').default('multiple_choice').notNull(),
    options: text('options'),
    correctAnswer: text('correct_answer').notNull(),
    explanation: text('explanation'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    quizIdx: index('qq_quiz_idx').on(t.quizId),
  })
)

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id').references(() => quizzes.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    enrollmentId: text('enrollment_id'),
    answers: text('answers').notNull(),
    score: real('score'),
    passed: boolean('passed').default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    userQuizIdx: index('qa_user_quiz_idx').on(t.userId, t.quizId),
  })
)

export const enrollments = pgTable(
  'enrollments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id).notNull(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    progressPercent: real('progress_percent').default(0),
    currentLessonId: text('current_lesson_id'),
    status: text('status').default('active').notNull(),
    assignedById: text('assigned_by_id'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    required: boolean('required').default(false),
    // Full-access flag: true for free courses + completed (placeholder) purchases;
    // false for first_chapter_free until the learner unlocks the rest.
    paid: boolean('paid').default(false).notNull(),
  },
  (t) => ({
    courseIdx: index('enroll_course_idx').on(t.courseId),
    userIdx: index('enroll_user_idx').on(t.userId),
    courseUserIdx: uniqueIndex('enroll_course_user_idx').on(t.courseId, t.userId),
  })
)

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: text('id').primaryKey(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    lessonId: text('lesson_id').references(() => lessons.id).notNull(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    timeSpentSeconds: integer('time_spent_seconds').default(0),
  },
  (t) => ({
    userIdx: index('lp_user_idx').on(t.userId),
    lessonUserIdx: uniqueIndex('lp_lesson_user_idx').on(t.lessonId, t.userId),
  })
)

export const onboardingChecklists = pgTable('onboarding_checklists', {
  id: text('id').primaryKey(),
  courseId: text('course_id').references(() => courses.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: text('id').primaryKey(),
    checklistId: text('checklist_id').references(() => onboardingChecklists.id).notNull(),
    text: text('text').notNull(),
    description: text('description'),
    isRequired: boolean('is_required').default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    checklistIdx: index('ci_checklist_idx').on(t.checklistId),
  })
)

export const checklistProgress = pgTable(
  'checklist_progress',
  {
    id: text('id').primaryKey(),
    checklistItemId: text('checklist_item_id').references(() => checklistItems.id).notNull(),
    userId: text('user_id').references(() => users.id).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => ({
    userIdx: index('cp_user_idx').on(t.userId),
  })
)

export const aiGenerationJobs = pgTable(
  'ai_generation_jobs',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    jobType: text('job_type').notNull(),
    status: text('status').default('pending').notNull(),
    inputData: text('input_data'),
    outputData: text('output_data'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    courseIdx: index('agj_course_idx').on(t.courseId),
  })
)

export const aiTutorMessages = pgTable(
  'ai_tutor_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id).notNull(),
    courseId: text('course_id').references(() => courses.id),
    lessonId: text('lesson_id').references(() => lessons.id),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    courseUserIdx: index('atm_course_user_idx').on(t.courseId, t.userId),
  })
)

export const certificates = pgTable(
  'certificates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id).notNull(),
    courseId: text('course_id').references(() => courses.id).notNull(),
    enrollmentId: text('enrollment_id').references(() => enrollments.id),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    certificateUrl: text('certificate_url'),
    verificationCode: text('verification_code').notNull().unique(),
  },
  (t) => ({
    courseUserIdx: index('cert_course_user_idx').on(t.courseId, t.userId),
  })
)

export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id'),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => ({
    teamUserIdx: uniqueIndex('tm_team_user_idx').on(t.teamId, t.userId),
  })
)

export const lessonComments = pgTable(
  'lesson_comments',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').notNull(),
    lessonId: text('lesson_id'),
    authorId: text('author_id').notNull(),
    body: text('body').notNull(),
    resolved: boolean('resolved').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    courseIdx: index('lc_course_idx').on(t.courseId),
  })
)

export const flashcards = pgTable('flashcards', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  lessonId: text('lesson_id').notNull(),
  front: text('front').notNull(),
  back: text('back').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
})

export const flashcardReviews = pgTable(
  'flashcard_reviews',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    flashcardId: text('flashcard_id').notNull(),
    ease: real('ease').default(2.5),
    intervalDays: integer('interval_days').default(0),
    dueAt: timestamp('due_at', { withTimezone: true }),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  },
  (t) => ({
    userDueIdx: index('fr_user_due_idx').on(t.userId, t.dueAt),
  })
)

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: index('notif_user_idx').on(t.userId),
  })
)

// One row per learner: accumulated points and the running daily streak.
// lastActivityDate is a YYYY-MM-DD string (UTC day) so streak math is calendar-day
// based and timezone-stable regardless of the exact timestamp of the activity.
export const learnerStats = pgTable(
  'learner_stats',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id).notNull().unique(),
    points: integer('points').notNull().default(0),
    currentStreakDays: integer('current_streak_days').notNull().default(0),
    longestStreakDays: integer('longest_streak_days').notNull().default(0),
    lastActivityDate: text('last_activity_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: uniqueIndex('ls_user_idx').on(t.userId),
  })
)

// One row per learner per earned badge. The unique (userId, badgeKey) index makes
// awarding idempotent — a second insert for an already-earned badge is a no-op.
export const learnerBadges = pgTable(
  'learner_badges',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id).notNull(),
    badgeKey: text('badge_key').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userBadgeIdx: uniqueIndex('lb_user_badge_idx').on(t.userId, t.badgeKey),
    userIdx: index('lb_user_idx').on(t.userId),
  })
)

// One free-text note per learner per lesson (upserted on save).
export const lessonNotes = pgTable(
  'lesson_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    courseId: text('course_id').notNull(),
    lessonId: text('lesson_id').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userLessonIdx: uniqueIndex('ln_user_lesson_idx').on(t.userId, t.lessonId),
  })
)
