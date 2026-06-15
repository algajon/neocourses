export interface LessonContent {
  intro: string
  concepts: Array<{
    title: string
    body: string
  }>
  callouts: Array<{
    type: 'practice' | 'trivia' | 'tip'
    title: string
    text: string
  }>
  keyTakeaways: string[]
  practicalExample?: string
}

export interface CourseOutline {
  /** Subject inferred SOLELY from the source material (drives lesson/quiz topics). */
  subject?: string
  modules: Array<{
    title: string
    description: string
    lessons: Array<{
      title: string
      summary: string
    }>
  }>
}

export interface FullLessonContent {
  title: string
  content: LessonContent
  learningObjectives: string[]
  keyPoints: string[]
  summary: string
}

export interface QuizQuestion {
  questionText: string
  questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  options?: Array<{
    id: string
    text: string
  }>
  correctAnswer: string
  explanation: string
}

export interface ChecklistItem {
  text: string
  description: string
  isRequired: boolean
}

export interface AIProvider {
  generateCourseOutline(
    title: string,
    description: string,
    materials: string
  ): Promise<CourseOutline>

  generateLessons(
    moduleTitle: string,
    lessonTitles: string[],
    courseTitle: string
  ): Promise<FullLessonContent[]>

  generateQuizQuestions(
    moduleTitle: string,
    chapterContent: string,
    courseTitle: string
  ): Promise<QuizQuestion[]>

  generateChecklist(
    courseTitle: string,
    materials: string
  ): Promise<ChecklistItem[]>

  answerTutorQuestion(
    courseContext: string,
    lessonContent: string,
    question: string
  ): Promise<string>
}
