import { createHash } from 'crypto'
import { getStorage } from '@/lib/storage'

// ElevenLabs text-to-speech. One POST per chunk → MP3; results are cached in
// storage so identical lesson text is only ever billed once.
const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'
const OUTPUT_FORMAT = 'mp3_44100_128'
const MAX_INPUT_CHARS = 8_000 // hard cap per lesson to keep credit usage tiny
const CHUNK_CHARS = 2_400 // stay well under every ElevenLabs model's per-request cap

// "Alice — Clear, Engaging Educator", part of the current default voice set that
// ships in every new account's library (so it works on the free tier via API).
// Override with ELEVENLABS_VOICE_ID (find ids under Voices in the ElevenLabs app).
const DEFAULT_VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'

export function isTTSEnabled(): boolean {
  return !!process.env.ELEVENLABS_API_KEY?.trim()
}

function model(): string {
  // multilingual_v2 = best quality; eleven_turbo_v2_5 / eleven_flash_v2_5 are
  // cheaper (≈half the credits) if you need to stretch the free tier.
  return process.env.ELEVENLABS_MODEL?.trim() || 'eleven_multilingual_v2'
}

function voiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID
}

function cacheKey(text: string): string {
  const hash = createHash('sha256')
    .update(`${model()}:${voiceId()}:${text}`)
    .digest('hex')
  return `tts/${hash}.mp3`
}

/** Greedily pack sentences into chunks under the per-request char limit. */
function chunk(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > CHUNK_CHARS) {
      if (current) chunks.push(current)
      // A single sentence longer than the limit gets hard-split.
      current = sentence.length > CHUNK_CHARS ? sentence.slice(0, CHUNK_CHARS) : sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) chunks.push(current)
  return chunks
}

async function synthesizeChunk(input: string): Promise<Buffer> {
  const res = await fetch(`${ENDPOINT}/${voiceId()}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!.trim(),
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: input,
      model_id: model(),
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`TTS request failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Returns spoken-audio MP3 for the given text. Synthesizes via ElevenLabs only on
 * a cache miss; identical text is billed at most once, then served from storage.
 */
export async function getSpeech(rawText: string): Promise<Buffer> {
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS)
  if (!text) throw new Error('Empty text')

  const storage = getStorage()
  const key = cacheKey(text)

  try {
    return await storage.get(key)
  } catch {
    // cache miss — synthesize below
  }

  // MP3 frames concatenate cleanly, so multi-chunk audio plays as one track.
  const parts = chunk(text)
  const buffers: Buffer[] = []
  for (const part of parts) {
    buffers.push(await synthesizeChunk(part))
  }
  const audio = Buffer.concat(buffers)

  await storage.put(key, audio, 'audio/mpeg').catch(() => {
    // Caching is best-effort; still return the audio if the write fails.
  })
  return audio
}
