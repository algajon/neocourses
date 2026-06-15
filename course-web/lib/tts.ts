import { createHash } from 'crypto'
import { getStorage } from '@/lib/storage'

const ENDPOINT = 'https://api.openai.com/v1/audio/speech'
const MAX_INPUT_CHARS = 8_000 // hard cap per lesson to keep usage tiny
const CHUNK_CHARS = 3_800 // OpenAI TTS input limit is 4096; stay safely under

export function isTTSEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim()
}

function model(): string {
  return process.env.TTS_MODEL?.trim() || 'gpt-4o-mini-tts'
}

function voice(): string {
  return process.env.TTS_VOICE?.trim() || 'nova'
}

function cacheKey(text: string): string {
  const hash = createHash('sha256')
    .update(`${model()}:${voice()}:${text}`)
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
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model(),
      voice: voice(),
      input,
      response_format: 'mp3',
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`TTS request failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Returns spoken-audio MP3 for the given text. Synthesizes via OpenAI only on a
 * cache miss; identical text is billed at most once, then served from storage.
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
