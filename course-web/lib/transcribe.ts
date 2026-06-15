// Server-only audio/video transcription via OpenAI Whisper. Runs in the Next.js
// route handler and the BullMQ worker (both Node). The returned transcript feeds
// the same AI generation prompts that PDF/text extraction does — so generation
// can ground in spoken content from media uploads.
const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'
const MAX_BYTES = 25 * 1024 * 1024 // Whisper hard limit is 25MB per request

export function isTranscriptionEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim()
}

/**
 * Transcribes an audio or video buffer to text using OpenAI Whisper.
 * Gracefully returns an error string (never throws) so callers can mark the
 * source material as failed instead of crashing the upload.
 */
export async function transcribeAudio(
  buf: Buffer,
  filename: string
): Promise<{ text: string; error: string | null }> {
  if (!isTranscriptionEnabled()) {
    return {
      text: '',
      error:
        'Audio/video transcription is not configured. Set OPENAI_API_KEY to transcribe media files.',
    }
  }

  if (buf.byteLength > MAX_BYTES) {
    const mb = (buf.byteLength / (1024 * 1024)).toFixed(1)
    return {
      text: '',
      error: `File is too large to transcribe (${mb} MB). The maximum is 25 MB — please trim or compress the media and try again.`,
    }
  }

  if (buf.byteLength === 0) {
    return { text: '', error: 'Media file is empty — nothing to transcribe.' }
  }

  try {
    const form = new FormData()
    // Blob avoids loading filesystem; Whisper infers format from the filename.
    const blob = new Blob([new Uint8Array(buf)])
    form.append('file', blob, filename || 'audio')
    form.append('model', 'whisper-1')
    form.append('response_format', 'json')

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
      },
      body: form,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        text: '',
        error: `Transcription request failed (${res.status}): ${detail.slice(0, 200)}`,
      }
    }

    const data = (await res.json()) as { text?: string }
    const text = (data.text ?? '').trim()
    if (!text) {
      return { text: '', error: 'Transcription returned no speech content.' }
    }
    return { text, error: null }
  } catch (e) {
    return {
      text: '',
      error: e instanceof Error ? e.message : 'Transcription failed',
    }
  }
}
