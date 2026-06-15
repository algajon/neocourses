export interface QuizOption {
  id: string
  text: string
}

/**
 * Quiz option storage is mixed across the app: seeded questions store options as
 * plain strings (e.g. "a) 1995"), while AI-generated questions store {id,text}
 * objects. Admin-facing surfaces (editor, preview) need a consistent {id,text}
 * shape, so normalize here regardless of how the option was stored.
 */
export function normalizeQuizOptions(raw: string | null): QuizOption[] | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  return parsed.map((opt, i) => {
    const fallbackId = String.fromCharCode(97 + i) // a, b, c, …
    if (typeof opt === 'string') {
      const m = opt.match(/^\s*([A-Za-z])[).]\s*(.*)$/)
      if (m) return { id: m[1].toLowerCase(), text: m[2] }
      return { id: fallbackId, text: opt }
    }
    if (opt && typeof opt === 'object') {
      const o = opt as { id?: unknown; text?: unknown }
      return {
        id: typeof o.id === 'string' && o.id ? o.id : fallbackId,
        text: typeof o.text === 'string' ? o.text : String(o.text ?? ''),
      }
    }
    return { id: fallbackId, text: String(opt) }
  })
}
