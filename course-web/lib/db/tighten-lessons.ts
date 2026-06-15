/**
 * One-off: shorten over-long stored lesson content so every lesson renders at
 * full size without clipping. Trims at SENTENCE boundaries (never mid-sentence)
 * to a word budget per field, preserving the existing source-grounded wording.
 *
 *   npx tsx lib/db/tighten-lessons.ts          # apply
 *   npx tsx lib/db/tighten-lessons.ts --dry    # report only
 */
import '@/lib/load-env'
import { db } from '@/lib/db'
import { lessons } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const DRY = process.argv.includes('--dry')

const BUDGET = {
  concept: 30, // words per concept body
  intro: 40,
  callout: 34,
  takeaway: 22,
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Keep whole sentences up to `maxWords`; always keep at least the first.
 * Splits only on sentence-ending punctuation that is followed by whitespace +
 * a capital/quote, so a '?' or '.' INSIDE a quote or filename (e.g. ...skill?'
 * or config.js) does not create an orphaned fragment.
 */
function trimToSentences(text: string, maxWords: number): string {
  if (!text || wordCount(text) <= maxWords) return text
  const sentences: string[] = []
  let buf = ''
  const tokens = text.split(/(\s+)/)
  for (let i = 0; i < tokens.length; i++) {
    buf += tokens[i]
    const isWhitespaceNext = /\s/.test(tokens[i + 1] ?? ' ')
    const endsSentence = /[.!?]["')\]]?$/.test(tokens[i].trim())
    const nextStartsUpper = /^["“(]?[A-Z]/.test((tokens[i + 2] ?? '').trim())
    if (endsSentence && isWhitespaceNext && nextStartsUpper) {
      sentences.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) sentences.push(buf.trim())
  if (sentences.length === 0) return text

  let out = ''
  for (const s of sentences) {
    const candidate = out ? `${out} ${s}` : s
    if (out && wordCount(candidate) > maxWords) break
    out = candidate
  }
  return out || sentences[0] || text
}

interface LessonContent {
  intro?: string
  concepts?: { title: string; body: string }[]
  callouts?: { type: string; title: string; text: string }[]
  keyTakeaways?: string[]
  practicalExample?: string
}

function tighten(c: LessonContent): { next: LessonContent; changed: boolean } {
  let changed = false
  const next: LessonContent = { ...c }

  if (c.intro) {
    const t = trimToSentences(c.intro, BUDGET.intro)
    if (t !== c.intro) { next.intro = t; changed = true }
  }
  if (Array.isArray(c.concepts)) {
    next.concepts = c.concepts.map((co) => {
      const t = trimToSentences(co.body ?? '', BUDGET.concept)
      if (t !== co.body) changed = true
      return { ...co, body: t }
    })
  }
  if (Array.isArray(c.callouts)) {
    next.callouts = c.callouts.map((co) => {
      const t = trimToSentences(co.text ?? '', BUDGET.callout)
      if (t !== co.text) changed = true
      return { ...co, text: t }
    })
  }
  if (Array.isArray(c.keyTakeaways)) {
    next.keyTakeaways = c.keyTakeaways.map((k) => {
      const t = trimToSentences(k, BUDGET.takeaway)
      if (t !== k) changed = true
      return t
    })
  }
  return { next, changed }
}

async function main() {
  const rows = await db.select({ id: lessons.id, contentJson: lessons.contentJson }).from(lessons)
  let touched = 0
  let scanned = 0
  for (const row of rows) {
    if (!row.contentJson) continue
    scanned++
    let parsed: LessonContent
    try {
      parsed = JSON.parse(row.contentJson)
    } catch {
      continue
    }
    const { next, changed } = tighten(parsed)
    if (!changed) continue
    touched++
    if (!DRY) {
      await db.update(lessons).set({ contentJson: JSON.stringify(next) }).where(eq(lessons.id, row.id))
    }
  }
  console.log(`${DRY ? '[dry] would tighten' : 'tightened'} ${touched} / ${scanned} lessons with content`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
