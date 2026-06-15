import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { aiTutorMessages, courses, lessons, modules, sourceMaterials } from '@/lib/db/schema'
import { eq, and, desc, asc } from 'drizzle-orm'
import { getAIProvider } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'

const SOURCE_CHAR_BUDGET = 6000
const LESSON_BODY_BUDGET = 800

interface SourceRef {
  label: string
  module?: string
}

function lessonText(row: { summary: string | null; lessonSummary: string | null; keyPoints: string | null; contentJson: string | null }): string {
  const parts: string[] = []
  if (row.summary) parts.push(row.summary)
  if (row.lessonSummary && row.lessonSummary !== row.summary) parts.push(row.lessonSummary)
  if (row.keyPoints) parts.push(row.keyPoints)
  if (parts.length === 0 && row.contentJson) {
    try {
      const parsed = JSON.parse(row.contentJson)
      if (typeof parsed.intro === 'string') parts.push(parsed.intro)
      if (Array.isArray(parsed.keyTakeaways)) parts.push(parsed.keyTakeaways.join('. '))
    } catch {}
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, LESSON_BODY_BUDGET)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { courseId, message, lessonId } = body as {
    courseId: string
    message: string
    lessonId?: string
  }

  if (!courseId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.organizationId, session.user.organizationId ?? '')))
    .limit(1)

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // ── Build grounding material from source uploads (RAG-lite) ──
  const sources = await db
    .select({ fileName: sourceMaterials.fileName, extractedText: sourceMaterials.extractedText })
    .from(sourceMaterials)
    .where(eq(sourceMaterials.courseId, courseId))

  let sourceBlock = ''
  let remaining = SOURCE_CHAR_BUDGET
  const sourceRefs: SourceRef[] = []
  for (const s of sources) {
    if (remaining <= 0) break
    const text = (s.extractedText ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const slice = text.slice(0, remaining)
    sourceBlock += `\n[Source file: ${s.fileName}]\n${slice}\n`
    remaining -= slice.length
    sourceRefs.push({ label: s.fileName })
  }

  // ── Build relevant lesson context (whole course, module-scoped) ──
  const lessonRows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      summary: lessons.summary,
      lessonSummary: lessons.lessonSummary,
      keyPoints: lessons.keyPoints,
      contentJson: lessons.contentJson,
      moduleTitle: modules.title,
    })
    .from(lessons)
    .leftJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(modules.position), asc(lessons.position))

  const lessonBlocks: string[] = []
  for (const l of lessonRows) {
    const text = lessonText(l)
    const moduleLabel = l.moduleTitle ?? 'Course'
    lessonBlocks.push(`[Lesson: "${l.title}" — Module: "${moduleLabel}"]\n${text || '(no content yet)'}`)
  }

  // ── Focused lesson, if the learner is reading one ──
  let focusedNote = ''
  if (lessonId) {
    const focused = lessonRows.find(l => l.id === lessonId)
    if (focused) {
      focusedNote = `\nThe learner is currently viewing the lesson "${focused.title}".`
    }
  }

  const hasMaterial = sourceBlock.trim().length > 0 || lessonBlocks.length > 0

  // The provider prompt is generic, so we encode the grounding contract and the
  // labelled material directly into the context string it receives.
  const courseContext = `Course title: "${course.title}". ${course.description ?? ''}${focusedNote}

GROUNDING RULES — follow these strictly:
- Answer ONLY using the COURSE MATERIAL below. Do not use outside knowledge.
- If the material does not cover the question, say so plainly (e.g. "This course doesn't cover that") instead of guessing.
- After your answer, on a new final line, add source references in exactly this format:
  Sources: <lesson or file title> (<module name>); <another>
  Only cite material you actually used. If nothing applied, write "Sources: none".

=== COURSE MATERIAL ===
${sourceBlock ? `--- Source documents ---${sourceBlock}\n` : ''}--- Lessons ---
${lessonBlocks.join('\n\n')}
=== END COURSE MATERIAL ===`

  const recentHistory = await db
    .select()
    .from(aiTutorMessages)
    .where(and(eq(aiTutorMessages.courseId, courseId), eq(aiTutorMessages.userId, session.user.id)))
    .orderBy(desc(aiTutorMessages.createdAt))
    .limit(10)

  recentHistory.reverse()

  const userMsgId = uuidv4()
  await db.insert(aiTutorMessages).values({
    id: userMsgId,
    userId: session.user.id,
    courseId,
    lessonId: lessonId ?? null,
    role: 'user',
    content: message.trim(),
    createdAt: new Date(),
  })

  const ai = getAIProvider()
  const raw = await ai.answerTutorQuestion(courseContext, focusedNote, message.trim())

  // ── Split the model's "Sources:" trailer into reference chips ──
  const { answer, references } = extractReferences(raw)

  const aiMsgId = uuidv4()
  await db.insert(aiTutorMessages).values({
    id: aiMsgId,
    userId: session.user.id,
    courseId,
    lessonId: lessonId ?? null,
    role: 'assistant',
    content: answer,
    createdAt: new Date(),
  })

  return NextResponse.json({
    id: aiMsgId,
    userMessageId: userMsgId,
    content: answer,
    references,
    grounded: hasMaterial,
  })
}

function extractReferences(raw: string): { answer: string; references: string[] } {
  const text = (raw ?? '').trim()
  const match = text.match(/\n\s*Sources:\s*(.+)\s*$/i)
  if (!match) {
    return { answer: text, references: [] }
  }
  const answer = text.slice(0, match.index).trim()
  const tail = match[1].trim()
  if (/^none\.?$/i.test(tail)) {
    return { answer, references: [] }
  }
  const references = tail
    .split(/;|•/)
    .map(r => r.trim().replace(/\.$/, ''))
    .filter(Boolean)
  return { answer, references }
}
