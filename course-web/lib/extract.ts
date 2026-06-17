// Server-only text extraction for uploaded source materials. Runs in the Next.js
// route handler and the BullMQ worker (both Node). PDF text is what feeds the AI
// generation prompts — without it, generation falls back to the course title.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { transcribeAudio } from './transcribe'

const MAX_CHARS = 45_000 // cap per file (~11k tokens) so generation prompts stay within model context and fast

// Audio/video formats, matched by extension or MIME prefix so they route to the
// transcription path (currently unavailable in this deployment — see transcribe.ts).
const MEDIA_EXTS = new Set(['mp3', 'm4a', 'wav', 'mp4', 'mov', 'webm', 'mpeg', 'mpga', 'ogg', 'oga', 'flac'])
const MEDIA_MIME_PREFIXES = ['audio/', 'video/']

export async function extractText(
  buf: Buffer,
  fileType: string,
  fileName: string
): Promise<{ text: string; error: string | null }> {
  const ext = (fileType || fileName.split('.').pop() || '').toLowerCase()
  const nameExt = (fileName.split('.').pop() || '').toLowerCase()
  const ft = (fileType || '').toLowerCase()
  const isMedia =
    MEDIA_EXTS.has(ext) ||
    MEDIA_EXTS.has(nameExt) ||
    MEDIA_MIME_PREFIXES.some(p => ft.startsWith(p))
  try {
    if (isMedia) {
      // Route audio/video to transcription; the transcript becomes the source text.
      const { text, error } = await transcribeAudio(buf, fileName)
      return { text: clamp(text), error }
    }
    if (ext === 'pdf' || buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      const parsed = await pdfParse(buf)
      return { text: clamp(parsed.text ?? ''), error: null }
    }
    if (ext === 'txt' || ext === 'md' || ext === 'markdown' || ext === 'csv') {
      return { text: clamp(buf.toString('utf-8')), error: null }
    }
    // DOCX and other binary formats: best-effort strip of readable runs.
    const ascii = buf.toString('utf-8').replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, ' ').trim()
    if (ascii.length > 40) return { text: clamp(ascii), error: null }
    return { text: '', error: `Unsupported file type for text extraction: ${ext || 'unknown'}` }
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Text extraction failed' }
  }
}

function clamp(s: string): string {
  const trimmed = s.replace(/\s+\n/g, '\n').trim()
  return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

export async function extractFromUrl(
  url: string
): Promise<{ text: string; error: string | null; title: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { text: '', error: 'Invalid URL', title: '' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { text: '', error: 'Only http(s) URLs are supported', title: '' }
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      return { text: '', error: `Failed to fetch URL (HTTP ${res.status})`, title: parsed.host }
    }

    const html = await res.text()

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch
      ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim()).slice(0, 200)
      : parsed.host

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')

    const text = clamp(decodeEntities(stripped).replace(/\s+/g, ' '))

    return { text, error: null, title: title || parsed.host }
  } catch (e) {
    return {
      text: '',
      error: e instanceof Error ? e.message : 'Failed to fetch URL',
      title: parsed.host,
    }
  }
}

export function extractFromText(raw: string): { text: string; error: string | null } {
  return { text: clamp(raw ?? ''), error: null }
}
