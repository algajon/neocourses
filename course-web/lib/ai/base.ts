import type { AIProvider, CourseOutline, FullLessonContent, QuizQuestion, ChecklistItem } from './types'
import { MockAIProvider } from './mock'
import { selectRelevantChunks } from './retrieve'

export const SYSTEM_PROMPT =
  'You are a professional course content creator. Return valid JSON only, no markdown.'

/**
 * Escapes raw control characters (U+0000–U+001F) that appear *inside* JSON string
 * literals — a common LLM mistake (an unescaped newline/tab in a value) that makes
 * JSON.parse throw "Bad control character in string literal". Structural whitespace
 * between tokens is left untouched, so valid JSON is unaffected.
 */
function escapeControlCharsInStrings(s: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const code = s.charCodeAt(i)
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
      } else if (ch === '\\') {
        out += ch
        escaped = true
      } else if (ch === '"') {
        out += ch
        inString = false
      } else if (code < 0x20) {
        out +=
          ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : `\\u${code.toString(16).padStart(4, '0')}`
      } else {
        out += ch
      }
    } else {
      if (ch === '"') inString = true
      out += ch
    }
  }
  return out
}

/** Isolate the outermost JSON value: strip ```fences``` and any prose before the
 * first bracket / after its matching last bracket. */
function extractJson(text: string): string {
  let s = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s)
  if (fence) s = fence[1].trim()
  const firstObj = s.indexOf('{')
  const firstArr = s.indexOf('[')
  let start = -1
  let close = '}'
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr
    close = ']'
  } else if (firstObj !== -1) {
    start = firstObj
  }
  if (start === -1) return s
  const end = s.lastIndexOf(close)
  return end > start ? s.slice(start, end + 1) : s.slice(start)
}

export function parseJSON<T>(text: string): T {
  const cleaned = extractJson(text)
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Most common cause: the model left a raw newline/tab inside a string value.
    // Repair just that and retry before giving up (caller repairs/falls back).
    return JSON.parse(escapeControlCharsInStrings(cleaned)) as T
  }
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
  async generateLessons(
    moduleTitle: string,
    lessonTitles: string[],
    courseTitle: string,
    sourceText?: string,
    courseLessonTitles?: string[],
  ): Promise<FullLessonContent[]> {
    // The whole-course lesson list (for anti-repetition); fall back to this
    // module's lessons when the caller doesn't supply it.
    const allTitles = courseLessonTitles?.length ? courseLessonTitles : lessonTitles
    // The very first lesson of the course establishes fundamentals; the rest
    // build on it and must not re-introduce the subject.
    const introTitle = allTitles[0]

    const out: FullLessonContent[] = []
    for (const t of lessonTitles) {
      // Retrieve the source passages most relevant to THIS lesson so its content
      // is grounded in the uploaded material, not the model's general knowledge.
      const excerpt = sourceText ? selectRelevantChunks(sourceText, `${moduleTitle} ${t}`, 3500) : ''
      out.push(
        await this.generateOneLesson(t, moduleTitle, courseTitle, excerpt, {
          allTitles,
          isIntroduction: t === introTitle,
        }),
      )
    }
    return out
  }

  /**
   * Anti-repetition context: tell the lesson what the rest of the course covers so
   * it doesn't re-explain foundations or duplicate sibling lessons. The opening
   * lesson establishes fundamentals; every other lesson builds on the earlier ones.
   */
  private courseContextBlock(
    lessonTitle: string,
    courseTopic: string,
    allTitles: string[],
    isIntroduction: boolean,
  ): string {
    const others = allTitles.filter((t) => t !== lessonTitle)
    if (others.length === 0) return ''
    const lines = ['COURSE CONTEXT — the other lessons in this course are:', ...others.map((t) => `- ${t}`)]
    if (isIntroduction) {
      lines.push(
        `This is the opening lesson — clearly establish the fundamentals a newcomer needs` +
          ` (what ${courseTopic} is, why it matters, key terms). The lessons above go deeper later,` +
          ` so introduce those topics but leave their detail to them. Don't assume prior knowledge.`,
      )
    } else {
      lines.push(
        `Write ONLY what is specific to "${lessonTitle}". Assume the learner has already read the` +
          ` earlier lessons. Do NOT re-introduce or re-define ${courseTopic}, and do not repeat` +
          ` background or definitions owned by another lesson above — build on them instead.` +
          ` No generic recaps.`,
      )
    }
    return lines.join('\n')
  }

  private async generateOneLesson(
    lessonTitle: string,
    chapterName: string,
    courseTopic: string,
    sourceExcerpt = '',
    ctx: { allTitles: string[]; isIntroduction: boolean } = { allTitles: [], isIntroduction: false },
  ): Promise<FullLessonContent> {
    const system = sourceExcerpt
      ? 'You are an educational content writer who writes STRICTLY from provided source material. You never add facts, names, dates, numbers, or claims that are not present in the source. Return only valid JSON with no markdown fences or extra text.'
      : 'You are an educational content writer. Return only valid JSON with no markdown fences or extra text.'
    const grounding = sourceExcerpt
      ? `\n\nSOURCE MATERIAL — base every concept, example, and takeaway STRICTLY on this. Do NOT introduce facts, names, numbers, tools, history, or claims that are not present below. If the source lacks detail for a point, keep it general rather than inventing specifics. Paraphrase; do not copy verbatim.\n"""\n${sourceExcerpt}\n"""\n`
      : ''
    const courseContext = this.courseContextBlock(lessonTitle, courseTopic, ctx.allTitles, ctx.isIntroduction)
    const user = `Write lesson content for a lesson titled "${lessonTitle}" in chapter "${chapterName}" of a course about "${courseTopic}".${grounding}${courseContext ? `\n\n${courseContext}\n` : ''}

Return this exact JSON with no other text:
{
  "intro": "An engaging 2-sentence hook (max 38 words total) that draws the reader in — open with a vivid question, a surprising fact, a concrete real-world scenario, or a striking stake. Make it specific to ${lessonTitle}. Do NOT begin with 'This lesson', 'In this lesson', 'Welcome', or 'Understanding'",
  "concepts": [
    {"title": "Short concept title (2-4 words)", "body": "Exactly 2 short sentences (max 30 words TOTAL) of specific, concrete content about ${lessonTitle} — no filler, no hedging, no 'in general' phrasing. Keep it tight; brevity is mandatory"},
    {"title": "Short concept title (2-4 words)", "body": "Exactly 2 short sentences (max 30 words TOTAL) of specific, concrete content about ${lessonTitle} — no filler, no hedging, no 'in general' phrasing. Keep it tight; brevity is mandatory"},
    {"title": "Short concept title (2-4 words)", "body": "Exactly 2 short sentences (max 30 words TOTAL) of specific, concrete content about ${lessonTitle} — no filler, no hedging, no 'in general' phrasing. Keep it tight; brevity is mandatory"}
  ],
  "keyPoints": [
    "Short factual bullet point about ${lessonTitle}",
    "Short factual bullet point about ${lessonTitle}",
    "Short factual bullet point about ${lessonTitle}"
  ],
  "example": "One concrete real-world example demonstrating ${lessonTitle} in practice (1-2 sentences, max 34 words)",
  "trivia": "One surprising fact or bit of context about ${lessonTitle} that makes it memorable (1 sentence, max 28 words)",
  "tip": "One specific, actionable tip about ${lessonTitle} (1 sentence, max 26 words)"
}`
    // Parse + validate + map the model output into the web LessonContent shape.
    // Throws on missing/invalid content so the caller can repair-retry.
    const attempt = async (prompt: string): Promise<FullLessonContent> => {
      const raw = parseJSON<{
        intro?: string
        concepts?: { title: string; body: string }[]
        keyPoints?: string[]
        example?: string
        trivia?: string
        tip?: string
      }>(await this.complete(prompt, system))
      if (!raw || !Array.isArray(raw.concepts) || raw.concepts.length === 0) {
        throw new Error('Lesson response missing concepts')
      }
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
    }

    try {
      return await attempt(user)
    } catch (firstErr) {
      // One repair retry — feed the failure back before degrading. This keeps
      // genuine AI content far more often than falling straight to the template.
      try {
        const repair = `${user}\n\nYour previous response was invalid (${firstErr instanceof Error ? firstErr.message : 'bad output'}). Return ONLY the corrected JSON matching the shape above — no markdown, no prose.`
        return await attempt(repair)
      } catch (e) {
        console.warn(`[ai] lesson "${lessonTitle}" fell back to template content after repair:`, e instanceof Error ? e.message : e)
        const [fallbackLesson] = await this.fallback.generateLessons(chapterName, [lessonTitle], courseTopic)
        return fallbackLesson
      }
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
- Add a one-sentence explanation of why the correct option is right.

Return this exact JSON structure with no other text:
{
  "questions": [
    {
      "question": "Full question text ending with a question mark?",
      "options": ["First option", "Second option", "Third option", "Fourth option"],
      "correctIndex": 0,
      "explanation": "One sentence on why the correct option is right."
    }
  ]
}

The "questions" array must contain exactly 5 questions. "correctIndex" is the 0-based index of the correct option.`
    try {
      const parsed = parseJSON<unknown>(await this.complete(user, system))
      const questions = coerceArray<{ question?: string; options?: string[]; correctIndex?: number; explanation?: string }>(parsed)
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
            explanation: typeof q.explanation === 'string' ? q.explanation : '',
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
