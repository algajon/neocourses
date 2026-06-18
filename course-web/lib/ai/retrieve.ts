// Lexical retrieval (no external embedding service — the DGX is text-gen only).
// Splits source material into passage-sized chunks and ranks them against a query
// (the lesson + chapter title) with BM25, returning the most relevant passages in
// original order within a character budget. Used to GROUND per-lesson generation
// in the actual uploaded source rather than the model's general knowledge.

type Chunk = { index: number; text: string }

const TARGET_WORDS = 140
const MAX_WORDS = 220

const STOP = new Set(
  ('a an the and or but of to in on for with at by from as is are was were be been being this that these those ' +
    'it its their your our his her they we you i he she them us into over under about above below it’s')
    .split(/\s+/),
)

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w))
}

/** Split source text into passage-sized chunks, respecting paragraph breaks. */
function chunkText(text: string, targetWords = TARGET_WORDS): Chunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buf: string[] = []
  let count = 0
  const flush = () => {
    if (buf.length) {
      chunks.push(buf.join(' '))
      buf = []
      count = 0
    }
  }

  for (const para of paragraphs) {
    const words = para.split(' ')
    if (words.length > MAX_WORDS) {
      flush()
      for (let i = 0; i < words.length; i += targetWords) {
        chunks.push(words.slice(i, i + targetWords).join(' '))
      }
      continue
    }
    if (count + words.length > targetWords && count > 0) flush()
    buf.push(para)
    count += words.length
  }
  flush()

  return chunks.map((text, index) => ({ index, text }))
}

const K1 = 1.5
const B = 0.75

/** Rank chunks by BM25 relevance to the query; return the top-k (score > 0). */
function rankBm25(query: string, chunks: Chunk[], k: number): Chunk[] {
  if (chunks.length === 0) return []
  const queryTerms = [...new Set(tokenize(query))]
  if (queryTerms.length === 0) return chunks.slice(0, k)

  const docTokens = chunks.map((c) => tokenize(c.text))
  const docLen = docTokens.map((t) => t.length)
  const avgdl = docLen.reduce((a, b) => a + b, 0) / docLen.length || 1
  const N = chunks.length

  const df = new Map<string, number>()
  for (const term of queryTerms) {
    let n = 0
    for (const toks of docTokens) if (toks.includes(term)) n++
    df.set(term, n)
  }

  const scored = chunks.map((chunk, i) => {
    const toks = docTokens[i]
    const tf = new Map<string, number>()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    for (const term of queryTerms) {
      const f = tf.get(term) ?? 0
      if (f === 0) continue
      const n = df.get(term) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      const denom = f + K1 * (1 - B + (B * docLen[i]) / avgdl)
      score += idf * ((f * (K1 + 1)) / denom)
    }
    return { chunk, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk)
}

/**
 * Returns the passages of `source` most relevant to `query`, concatenated in
 * original order, up to `maxChars`. Returns '' when there is no usable source.
 * (Signature preserved: callers pass the raw source string and a char budget.)
 */
export function selectRelevantChunks(source: string, query: string, maxChars = 3500): string {
  const text = (source || '').trim()
  if (!text) return ''

  const chunks = chunkText(text)
  if (chunks.length === 0) return text.slice(0, maxChars)

  // Pull a generous top-k by relevance, then fill the char budget in original order.
  const ranked = rankBm25(query, chunks, Math.max(8, Math.ceil(maxChars / 400)))
  const pool = ranked.length > 0 ? ranked : chunks.slice(0, 3)

  const picked = [...pool].sort((a, b) => a.index - b.index)
  const out: string[] = []
  let len = 0
  for (const c of picked) {
    if (len + c.text.length > maxChars && out.length > 0) continue
    out.push(c.text)
    len += c.text.length + 2
    if (len >= maxChars) break
  }
  return out.join('\n\n').slice(0, maxChars)
}
