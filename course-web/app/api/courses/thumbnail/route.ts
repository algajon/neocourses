import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { getStorage } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

const MAX_BYTES = 4 * 1024 * 1024 // ~4MB
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Course thumbnails are uploaded before the course exists (during the create
// flow), so there is no course id to scope to — we only gate on role here.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role } = session.user
    if (role === 'learner' || role === 'reviewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPG, PNG, or WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Maximum size is 4MB.' },
        { status: 400 }
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const key = `thumbnails/${uuidv4()}.${ext}`
    const stored = await getStorage().put(key, buf, file.type)

    return NextResponse.json({ url: stored.url }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/courses/thumbnail]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
