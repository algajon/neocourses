import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { courses, sourceMaterials } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getStorage } from '@/lib/storage'
import { extractText } from '@/lib/extract'

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, id: userId } = session.user
    if (role === 'learner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const courseId = params.id

    const [course] = await db
      .select({ id: courses.id, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1)

    if (!course || course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const storage = getStorage()
    const now = new Date()
    const id = uuidv4()
    const contentType = request.headers.get('content-type') ?? ''

    let fileName: string
    let fileType: string
    let key: string
    let fileSize: number
    let extractedText: string | null = null
    let processingError: string | null = null

    if (contentType.includes('application/json')) {
      // Pasted raw text path — no file upload.
      const body = (await request.json()) as { text?: string; fileName?: string }
      const text = body.text ?? ''
      if (!text) {
        return NextResponse.json({ error: 'No text provided' }, { status: 400 })
      }
      fileName = body.fileName?.trim() || 'pasted-text.txt'
      fileType = 'txt'
      const buf = Buffer.from(text, 'utf-8')
      key = `${courseId}/${uuidv4()}-${fileName}`
      const stored = await storage.put(key, buf, 'text/plain')
      fileSize = stored.size
      extractedText = text
    } else {
      const form = await request.formData()
      const file = form.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }

      fileName = file.name
      fileType = extOf(fileName)
      const buf = Buffer.from(await file.arrayBuffer())
      key = `${courseId}/${uuidv4()}-${fileName}`
      const stored = await storage.put(key, buf, file.type || 'application/octet-stream')
      fileSize = stored.size

      const result = await extractText(buf, fileType, fileName)
      extractedText = result.text || null
      processingError = result.error
    }

    const [created] = await db
      .insert(sourceMaterials)
      .values({
        id,
        courseId,
        uploadedById: userId,
        fileName,
        fileType,
        filePath: key,
        fileSizeBytes: fileSize,
        status: extractedText ? 'ready' : 'failed',
        extractedText,
        processingError,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return NextResponse.json({ sourceMaterial: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/courses/[id]/upload]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [course] = await db
      .select({ id: courses.id, organizationId: courses.organizationId })
      .from(courses)
      .where(eq(courses.id, params.id))
      .limit(1)

    if (!course || course.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const materials = await db
      .select()
      .from(sourceMaterials)
      .where(eq(sourceMaterials.courseId, params.id))

    return NextResponse.json({ sourceMaterials: materials })
  } catch (error) {
    console.error('[GET /api/courses/[id]/upload]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
