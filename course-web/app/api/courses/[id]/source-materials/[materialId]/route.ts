import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { sourceMaterials, courses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getStorage } from '@/lib/storage'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; materialId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = session.user.role === 'admin' || session.user.role === 'owner'
  const isEditor = session.user.role === 'reviewer'

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: courseId, materialId } = params

  const [course] = await db
    .select({ id: courses.id, createdById: courses.createdById, organizationId: courses.organizationId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)

  if (!course || course.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const [material] = await db
    .select()
    .from(sourceMaterials)
    .where(and(eq(sourceMaterials.id, materialId), eq(sourceMaterials.courseId, courseId)))
    .limit(1)

  if (!material) {
    return NextResponse.json({ error: 'Source material not found' }, { status: 404 })
  }

  if (material.filePath) {
    try {
      await getStorage().delete(material.filePath)
    } catch (err) {
      console.error('[DELETE source-material] storage delete failed', err)
    }
  }

  await db
    .delete(sourceMaterials)
    .where(and(eq(sourceMaterials.id, materialId), eq(sourceMaterials.courseId, courseId)))

  return NextResponse.json({ deleted: true })
}
