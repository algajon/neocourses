/**
 * One-off repair: the first tighten pass had a sentence-splitter bug that left a
 * few callout/concept fields starting mid-sentence (orphaned quote fragments).
 * This regenerates ONLY those affected lessons via the AI (now with the tightened
 * prompt, so the output is already short and needs no trimming).
 *
 *   npx tsx lib/db/regen-mangled.ts
 */
import '@/lib/load-env'
import { db } from '@/lib/db'
import { lessons, modules, courses } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAIProvider } from '@/lib/ai'

// Truly mangled = begins with an orphan quote or a lowercase letter.
// ($1,500 / @here style starts are legitimate and excluded.)
function mangled(s?: string): boolean {
  if (!s) return false
  return /^['"]/.test(s.trim()) || /^[a-z]/.test(s.trim())
}

function lessonIsMangled(contentJson: string | null): boolean {
  if (!contentJson) return false
  let p: { intro?: string; concepts?: { body: string }[]; callouts?: { text: string }[]; keyTakeaways?: string[] }
  try {
    p = JSON.parse(contentJson)
  } catch {
    return false
  }
  if (mangled(p.intro)) return true
  if ((p.concepts ?? []).some((c) => mangled(c.body))) return true
  if ((p.callouts ?? []).some((c) => mangled(c.text))) return true
  if ((p.keyTakeaways ?? []).some((k) => mangled(k))) return true
  return false
}

async function main() {
  const ai = getAIProvider()
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      contentJson: lessons.contentJson,
      moduleTitle: modules.title,
      courseTitle: courses.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))

  const targets = rows.filter((r) => lessonIsMangled(r.contentJson))
  console.log(`found ${targets.length} mangled lessons to regenerate`)

  for (const t of targets) {
    try {
      const [full] = await ai.generateLessons(t.moduleTitle, [t.title], t.courseTitle)
      if (!full?.content?.concepts?.length) {
        console.log(`  SKIP "${t.title}" — generation returned no concepts`)
        continue
      }
      await db.update(lessons).set({ contentJson: JSON.stringify(full.content) }).where(eq(lessons.id, t.id))
      console.log(`  ok  "${t.title}"`)
    } catch (e) {
      console.log(`  ERR "${t.title}":`, e instanceof Error ? e.message : e)
    }
  }
  console.log('done')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
