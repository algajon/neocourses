import type { AIProvider, CourseOutline, FullLessonContent, QuizQuestion, ChecklistItem } from './types'
import { MockAIProvider } from './mock'

export const SYSTEM_PROMPT =
  'You are a professional course content creator. Return valid JSON only, no markdown.'

export function parseJSON<T>(text: string): T {
  // Strip optional ```json fences and any leading prose before the first JSON token.
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const firstBrace = cleaned.search(/[[{]/)
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace)
  return JSON.parse(cleaned) as T
}

/**
 * Models often wrap a requested JSON array inside an object (e.g. {"lessons":[...]},
 * {"questions":[...]}). Accept either a bare array or the first array-valued property.
 * Throws if no array is found so the caller can fall back to the mock provider.
 */
export function coerceArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as T[]
    }
  }
  throw new Error('Expected a JSON array in model response')
}

/**
 * Shared course-content prompts + JSON parsing. Concrete providers only implement
 * `complete()` (how a single prompt is sent to a model) and may set their own model
 * name. On any error a method falls back to the deterministic MockAIProvider so a
 * generation job degrades gracefully instead of failing outright.
 */
export abstract class JsonChatProvider implements AIProvider {
  protected fallback = new MockAIProvider()

  protected abstract complete(prompt: string, system?: string): Promise<string>

  async generateCourseOutline(title: string, description: string, materials: string): Promise<CourseOutline> {
    // Content is derived SOLELY from the uploaded reference. The admin's title and
    // description are intentionally NOT sent to the model — they do not influence
    // the modules, lessons, or quizzes in any way.
    if (materials.trim().length === 0) {
      // No reference to learn from — degrade to the deterministic template rather
      // than fabricating a course from a title.
      return this.fallback.generateCourseOutline(title, description, materials)
    }
    try {
      const prompt = `You are designing a complete course built STRICTLY and SOLELY from the SOURCE MATERIAL below.
Do NOT use any external course title or description — derive the subject, every module, and every
lesson entirely from what this material actually contains.

=== SOURCE MATERIAL ===
${materials}
=== END SOURCE MATERIAL ===

Return a JSON object with this exact shape (no markdown):
{
  "subject": "A short phrase naming the real subject of the material (e.g. 'Relational databases and SQL')",
  "modules": [
    {
      "title": "Module title drawn from the material",
      "description": "What this module covers, grounded in the material",
      "lessons": [
        { "title": "Lesson title", "summary": "One sentence summary grounded in the material" }
      ]
    }
  ]
}

Produce 4–6 modules with 3–5 lessons each, sequenced to teach the material well. Use the material's
real concepts, terminology, and structure. Do not invent topics that are not present in the material.`
      const parsed = parseJSON<{ subject?: unknown; modules?: unknown }>(await this.complete(prompt))
      const modules = Array.isArray(parsed)
        ? parsed
        : (parsed as { modules?: unknown }).modules
      if (!Array.isArray(modules) || modules.length === 0) {
        throw new Error('Outline response had no modules')
      }
      const subject = typeof parsed.subject === 'string' && parsed.subject.trim() ? parsed.subject.trim() : undefined
      return { subject, modules } as CourseOutline
    } catch {
      return this.fallback.generateCourseOutline(title, description, materials)
    }
  }

  // ── VERBATIM desktop lesson-writing logic (course-studio generate_lesson_content) ──
  // Lessons generate ONE AT A TIME, sequentially within a module (the worker runs
  // modules in parallel). The desktop prompt keys off lesson title + chapter + course
  // topic only — that is what produces specific, factual content reliably.
  async generateLessons(moduleTitle: string, lessonTitles: string[], courseTitle: string): Promise<FullLessonContent[]> {
    const out: FullLessonContent[] = []
    for (const t of lessonTitles) {
      out.push(await this.generateOneLesson(t, moduleTitle, courseTitle))
    }
    return out
  }

  private async generateOneLesson(lessonTitle: string, chapterName: string, courseTopic: string): Promise<FullLessonContent> {
    const system = 'You are an educational content writer. Return only valid JSON with no markdown fences or extra text.'
    const user = `Write lesson content for a lesson titled "${lessonTitle}" in chapter "${chapterName}" of a course about "${courseTopic}".

Return this exact JSON with no other text:
{
  "intro": "An engaging 2-3 sentence hook that draws the reader in — open with a vivid question, a surprising fact, a concrete real-world scenario, or a striking stake. Make it specific to ${lessonTitle}. Do NOT begin with 'This lesson', 'In this lesson', 'Welcome', or 'Understanding'",
  "concepts": [
    {"title": "Concept title", "body": "2-3 sentences of factual, specific educational content about ${lessonTitle}"},
    {"title": "Concept title", "body": "2-3 sentences of factual, specific educational content about ${lessonTitle}"},
    {"title": "Concept title", "body": "2-3 sentences of factual, specific educational content about ${lessonTitle}"}
  ],
  "keyPoints": [
    "Short factual bullet point about ${lessonTitle}",
    "Short factual bullet point about ${lessonTitle}",
    "Short factual bullet point about ${lessonTitle}"
  ],
  "example": "One concrete real-world example or scenario demonstrating ${lessonTitle} in practice (2-3 sentences)",
  "trivia": "One surprising fact, piece of history, or interesting bit of context about ${lessonTitle} that makes it more memorable (1-2 sentences)",
  "tip": "One specific, actionable insight or practical tip about ${lessonTitle}"
}`
    try {
      const raw = parseJSON<{
        intro?: string
        concepts?: { title: string; body: string }[]
        keyPoints?: string[]
        example?: string
        trivia?: string
        tip?: string
      }>(await this.complete(user, system))
      if (!raw || !Array.isArray(raw.concepts) || raw.concepts.length === 0) {
        throw new Error('Lesson response missing concepts')
      }
      // Map the desktop lesson shape (intro/concepts/keyPoints/example/trivia/tip)
      // onto the web LessonContent shape used by the views.
      const callouts: { type: 'practice' | 'trivia' | 'tip'; title: string; text: string }[] = []
      if (raw.example) callouts.push({ type: 'practice', title: 'In practice', text: raw.example })
      if (raw.trivia) callouts.push({ type: 'trivia', title: 'Did you know?', text: raw.trivia })
      if (raw.tip) callouts.push({ type: 'tip', title: 'Tip', text: raw.tip })
      return {
        title: lessonTitle,
        content: {
          intro: raw.intro ?? '',
          concepts: raw.concepts,
          callouts,
          keyTakeaways: raw.keyPoints ?? [],
          practicalExample: raw.example ?? '',
        },
        learningObjectives: [],
        keyPoints: raw.keyPoints ?? [],
        summary: raw.intro ?? '',
      }
    } catch (e) {
      console.warn(`[ai] lesson "${lessonTitle}" fell back to template content:`, e instanceof Error ? e.message : e)
      const [fallbackLesson] = await this.fallback.generateLessons(chapterName, [lessonTitle], courseTopic)
      return fallbackLesson
    }
  }

  // ── VERBATIM desktop quiz logic (course-studio generate_quiz) ──
  // Grounded strictly in the chapter's generated content; exactly 5 multiple-choice
  // questions, 4 options each, one correct. Desktop returns {question, options[4],
  // correctIndex}; we map that to the web storage shape ({id,text} options + letter).
  async generateQuizQuestions(moduleTitle: string, chapterContent: string, courseTitle: string): Promise<QuizQuestion[]> {
    const system =
      'You are an expert assessment designer. You write clear, unambiguous multiple-choice ' +
      'quiz questions that test genuine understanding of the material. Each question has exactly four answer ' +
      'options with one unambiguously correct answer and three plausible but incorrect distractors. ' +
      'Return only valid JSON with no markdown fences or extra text.'
    const user = `Based on the following content from the chapter "${moduleTitle}" of a course about "${courseTitle}", write 5 multiple-choice quiz questions that test understanding of the key concepts taught.

CHAPTER CONTENT:
${chapterContent}

Requirements:
- Write complete, self-contained questions that make sense on their own.
- Each question must have exactly 4 answer options.
- Exactly one option is correct; the other three are plausible distractors.
- Do not truncate or abbreviate any question or answer text — write full, natural sentences.
- Vary the question style (definitions, application, comparison, best-practice).
- Base every question strictly on the chapter content above.

Return this exact JSON structure with no other text:
{
  "questions": [
    {
      "question": "Full question text ending with a question mark?",
      "options": ["First option", "Second option", "Third option", "Fourth option"],
      "correctIndex": 0
    }
  ]
}

The "questions" array must contain exactly 5 questions. "correctIndex" is the 0-based index of the correct option.`
    try {
      const parsed = parseJSON<unknown>(await this.complete(user, system))
      const questions = coerceArray<{ question?: string; options?: string[]; correctIndex?: number }>(parsed)
      const letters = ['a', 'b', 'c', 'd', 'e', 'f']
      const mapped = questions
        .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => {
          const opts = q.options as string[]
          const ci = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length ? q.correctIndex : 0
          return {
            questionText: q.question as string,
            questionType: 'multiple_choice' as const,
            options: opts.map((text, i) => ({ id: letters[i], text })),
            correctAnswer: letters[ci],
            explanation: '',
          }
        })
      if (mapped.length === 0) throw new Error('No valid quiz questions parsed')
      return mapped
    } catch {
      return this.fallback.generateQuizQuestions(moduleTitle, chapterContent, courseTitle)
    }
  }

  async generateChecklist(courseTitle: string, materials: string): Promise<ChecklistItem[]> {
    try {
      const prompt = `Generate an onboarding checklist for a course titled "${courseTitle}".
Materials: ${materials || 'Not provided'}

Return a JSON array of 10–14 checklist items with this shape:
{
  "text": "Short action item",
  "description": "1–2 sentence detail about how to complete this step",
  "isRequired": true | false
}

Mark at least 6 items as required. Make items specific and actionable.`
      return coerceArray<ChecklistItem>(parseJSON(await this.complete(prompt)))
    } catch {
      return this.fallback.generateChecklist(courseTitle, materials)
    }
  }

  async answerTutorQuestion(courseContext: string, lessonContent: string, question: string): Promise<string> {
    try {
      const prompt = `You are an AI tutor for a course. Answer the learner's question based on the course context and lesson content.

Course context: ${courseContext}
Current lesson content: ${lessonContent}
Learner question: ${question}

Return a JSON object:
{ "answer": "Your helpful, detailed answer in plain text (2–3 paragraphs)" }

Be specific, reference the lesson content where relevant, and keep the tone supportive and clear.`
      const parsed = parseJSON<{ answer: string }>(await this.complete(prompt))
      return parsed.answer
    } catch {
      return this.fallback.answerTutorQuestion(courseContext, lessonContent, question)
    }
  }
}
