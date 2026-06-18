// Audio/video transcription via a SELF-HOSTED Whisper server.
//
// Internal, self-hosted only: audio is sent to our own on-prem Whisper service
// (e.g. faster-whisper-server / Speaches, or whisper.cpp's server) — never to a
// third-party API. The server must expose an OpenAI-compatible endpoint:
//   POST {WHISPER_BASE_URL}/v1/audio/transcriptions   (multipart: file, model)
//
// Configure via env (see .env.example):
//   WHISPER_BASE_URL   host of the local Whisper server (enables the feature)
//   WHISPER_MODEL      model id the server expects (default 'whisper-1')
//   WHISPER_API_KEY    optional bearer token, if the server requires one
//   WHISPER_MAX_MB     reject files larger than this (default 200)
//
// When WHISPER_BASE_URL is unset, transcription is disabled and callers degrade
// gracefully (ask for a PDF/doc/text source) — no network calls are made.

function baseUrl(): string {
  return process.env.WHISPER_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
}

function model(): string {
  return process.env.WHISPER_MODEL?.trim() || 'whisper-1'
}

function maxBytes(): number {
  const mb = Number(process.env.WHISPER_MAX_MB?.trim())
  return (Number.isFinite(mb) && mb > 0 ? mb : 200) * 1024 * 1024
}

export function isTranscriptionEnabled(): boolean {
  return !!baseUrl()
}

/**
 * Transcribes an audio/video buffer to text using the self-hosted Whisper server.
 * Gracefully returns an error string (never throws) so callers can mark the upload
 * as failed instead of crashing. Makes no network call when transcription is
 * disabled (no WHISPER_BASE_URL).
 */
export async function transcribeAudio(
  buf: Buffer,
  filename: string
): Promise<{ text: string; error: string | null }> {
  if (!isTranscriptionEnabled()) {
    return {
      text: '',
      error:
        'Audio and video transcription isn’t enabled in this deployment. Please upload a PDF, document, or text file — or set WHISPER_BASE_URL to a self-hosted Whisper server.',
    }
  }

  if (buf.byteLength === 0) {
    return { text: '', error: 'Media file is empty — nothing to transcribe.' }
  }

  const limit = maxBytes()
  if (buf.byteLength > limit) {
    const mb = (buf.byteLength / (1024 * 1024)).toFixed(1)
    const capMb = Math.round(limit / (1024 * 1024))
    return {
      text: '',
      error: `File is too large to transcribe (${mb} MB). The limit is ${capMb} MB — trim/compress the media (or raise WHISPER_MAX_MB) and try again.`,
    }
  }

  try {
    const form = new FormData()
    // Blob avoids touching the filesystem; the server infers format from the name.
    const blob = new Blob([new Uint8Array(buf)])
    form.append('file', blob, filename || 'audio')
    form.append('model', model())
    form.append('response_format', 'json')

    const headers: Record<string, string> = {}
    const key = process.env.WHISPER_API_KEY?.trim()
    if (key) headers.Authorization = `Bearer ${key}`

    const res = await fetch(`${baseUrl()}/v1/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: form,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        text: '',
        error: `Transcription request failed (${res.status}): ${detail.slice(0, 200)}`,
      }
    }

    // OpenAI-compatible servers return { text }; some return plain text.
    const ct = res.headers.get('content-type') ?? ''
    const text = ct.includes('application/json')
      ? ((await res.json()) as { text?: string }).text?.trim() ?? ''
      : (await res.text()).trim()

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
