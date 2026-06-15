import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { getSpeech, isTTSEnabled } from '@/lib/tts'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isTTSEnabled()) {
    // No OpenAI key configured — the client falls back to the browser voice.
    return NextResponse.json({ error: 'TTS not configured' }, { status: 501 })
  }

  const body = await req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text : ''
  if (!text.trim()) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  try {
    const audio = await getSpeech(text)
    // Buffer isn't a valid BodyInit type; a Uint8Array view is.
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
