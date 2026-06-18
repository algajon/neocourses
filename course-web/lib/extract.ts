// Server-only text extraction for uploaded source materials. Runs in the Next.js
// route handler and the BullMQ worker (both Node). The extracted text feeds the
// AI generation prompts, so robust extraction across formats directly drives
// course quality. Everything runs on-prem — nothing is sent to a third party.
//
//   PDF (unpdf) · DOCX (mammoth) · PPTX (jszip) · HTML · CSV/MD/TXT
//   Audio/Video → self-hosted Whisper (see transcribe.ts)
//
// Heavy parsers are dynamically imported so they only load when actually needed.
import { transcribeAudio } from './transcribe'

const MAX_CHARS = 45_000 // cap per file (~11k tokens) so generation prompts stay within model context and fast

// Audio/video formats, matched by extension or MIME prefix so they route to the
// self-hosted Whisper transcription path (enabled via WHISPER_BASE_URL — see transcribe.ts).
const MEDIA_EXTS = new Set(['mp3', 'm4a', 'wav', 'mp4', 'mov', 'webm', 'mpeg', 'mpga', 'ogg', 'oga', 'flac', 'aac', 'mkv', 'm4v'])
const MEDIA_MIME_PREFIXES = ['audio/', 'video/']

/** Collapse excess whitespace while keeping paragraph breaks (helps chunking). */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n\n') : text
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer: buf })
  return value
}

async function extractPptx(buf: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNum(a) - slideNum(b))
  const slides: string[] = []
  for (const p of slidePaths) {
    const xml = await zip.files[p].async('string')
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeEntities(m[1]))
    if (texts.length) slides.push(texts.join(' '))
  }
  return slides.join('\n\n')
}
function slideNum(p: string): number {
  return Number(p.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
}

function extractHtmlBuffer(buf: Buffer): string {
  let s = buf.toString('utf8')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer)>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<[^>]+>/g, ' ')
  return decodeEntities(s).replace(/[ \t]{2,}/g, ' ')
}

export async function extractText(
  buf: Buffer,
  fileType: string,
  fileName: string
): Promise<{ text: string; error: string | null }> {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  const typeExt = (fileType || '').toLowerCase()
  const ft = (fileType || '').toLowerCase()
  const isMedia =
    MEDIA_EXTS.has(ext) ||
    MEDIA_EXTS.has(typeExt) ||
    MEDIA_MIME_PREFIXES.some((p) => ft.startsWith(p))
  const isZip = buf.subarray(0, 2).toString('latin1') === 'PK'
  try {
    if (isMedia) {
      // Route audio/video to transcription; the transcript becomes the source text.
      const { text, error } = await transcribeAudio(buf, fileName)
      return { text: clamp(text), error }
    }
    if (ext === 'pdf' || buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      return { text: clamp(await extractPdf(buf)), error: null }
    }
    if (ext === 'docx' || (isZip && ft.includes('wordprocessingml'))) {
      return { text: clamp(await extractDocx(buf)), error: null }
    }
    if (ext === 'pptx' || (isZip && ft.includes('presentationml'))) {
      return { text: clamp(await extractPptx(buf)), error: null }
    }
    if (ext === 'html' || ext === 'htm' || ft === 'text/html') {
      return { text: clamp(extractHtmlBuffer(buf)), error: null }
    }
    if (ext === 'txt' || ext === 'text' || ext === 'md' || ext === 'markdown' || ext === 'mdx' || ext === 'csv' || ext === 'tsv' || ext === 'log') {
      return { text: clamp(buf.toString('utf-8')), error: null }
    }
    // Unknown text-ish formats: best-effort strip of readable runs.
    const ascii = buf.toString('utf-8').replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, ' ').trim()
    if (ascii.length > 40) return { text: clamp(ascii), error: null }
    return { text: '', error: `Unsupported file type for text extraction: ${ext || fileType || 'unknown'}` }
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Text extraction failed' }
  }
}

function clamp(s: string): string {
  const trimmed = normalize(s)
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
