// Lightweight lexical retrieval (no external embedding service). Splits the
// source material into passages and ranks them by term overlap with a query
// (the lesson + chapter title), returning the most relevant passages within a
// character budget. Used to GROUND per-lesson generation in the actual uploaded
// source rather than the model's general knowledge.

const STOP = new Set(
  ('a an the and or but of to in on for with at by from as is are was were be been being this that these those ' +
    'it its their your our his her they we you i he she them us into over under about above below it’s')
    .split(/\s+/),
)

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w))
}

/**
 * Returns the passages of `source` most relevant to `query`, concatenated in
 * original order, up to `maxChars`. Returns '' when there is no usable source.
 */
export function selectRelevantChunks(source: string, query: string, maxChars = 3500): string {
  const text = (source || '').trim()
  if (!text) return ''

  const passages = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40)

  if (passages.length === 0) return text.slice(0, maxChars)

  const qTokens = new Set(tokenize(query))
  const scored = passages.map((p, i) => {
    const toks = tokenize(p)
    let hits = 0
    for (const t of toks) if (qTokens.has(t)) hits++
    // Normalize a little by passage length so one long paragraph doesn't dominate.
    const score = hits === 0 ? 0 : hits / Math.sqrt(toks.length || 1)
    return { p, i, score }
  })

  const ranked = [...scored].sort((a, b) => b.score - a.score || a.i - b.i)

  const picked: { p: string; i: number }[] = []
  let len = 0
  for (const s of ranked) {
    if (s.score === 0 && picked.length > 0) break
    if (len + s.p.length > maxChars && picked.length > 0) continue
    picked.push(s)
    len += s.p.length
    if (len >= maxChars) break
  }
  // No lexical overlap at all (e.g. very short titles) → fall back to the opening passages.
  if (picked.length === 0) picked.push(...ranked.slice(0, 3).map((s) => ({ p: s.p, i: s.i })))

  picked.sort((a, b) => a.i - b.i)
  return picked.map((s) => s.p).join('\n\n').slice(0, maxChars)
}
