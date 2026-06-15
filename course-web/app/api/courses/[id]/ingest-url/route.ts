import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, sourceMaterials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { extractFromUrl, extractFromText } from '@/lib/extract'

const MIN_CHARS = 40

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, id: userId, organizationId } = session.user
    if (role !== 'owner' && role !== 'admin' && role !== 'editor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const courseId = params.id

    const [course] = await db
      .select({ id: courses.id, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as
      | { url?: string; text?: string; title?: string }
      | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    let fileName: string
    let fileType: string
    let extractedText: string
    let extractError: string | null = null

    if (typeof body.url === 'string' && body.url.trim()) {
      const result = await extractFromUrl(body.url.trim())
      extractError = result.error
      extractedText = result.text
      fileType = 'url'
      fileName = body.title?.trim() || result.title || body.url.trim()
    } else if (typeof body.text === 'string' && body.text.trim()) {
      const result = extractFromText(body.text)
      extractError = result.error
      extractedText = result.text
      fileType = 'text'
      fileName = body.title?.trim() || 'Pasted text'
    } else {
      return NextResponse.json({ error: 'Provide a url or text' }, { status: 400 })
    }

    if (extractError) {
      return NextResponse.json({ error: extractError }, { status: 400 })
    }
    if (!extractedText || extractedText.length < MIN_CHARS) {
      return NextResponse.json(
        { error: 'Not enough text could be extracted from this source' },
        { status: 400 }
      )
    }

    const now = new Date()
    const id = uuidv4()

    const [created] = await db
      .insert(sourceMaterials)
      .values({
        id,
        courseId,
        uploadedById: userId,
        fileName,
        fileType,
        filePath: '',
        fileSizeBytes: Buffer.byteLength(extractedText, 'utf-8'),
        status: 'ready',
        extractedText,
        processingError: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return NextResponse.json({ sourceMaterial: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/courses/[id]/ingest-url]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
