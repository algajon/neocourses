// Server-only text extraction for uploaded source materials. Runs in the Next.js
// route handler and the BullMQ worker (both Node). PDF text is what feeds the AI
// generation prompts — without it, generation falls back to the course title.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

const MAX_CHARS = 45_000 // cap per file (~11k tokens) so generation prompts stay within model context and fast

export async function extractText(
  buf: Buffer,
  fileType: string,
  fileName: string
): Promise<{ text: string; error: string | null }> {
  const ext = (fileType || fileName.split('.').pop() || '').toLowerCase()
  try {
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
