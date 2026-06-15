import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { certificates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { courseId } = params

  const [certificate] = await db
    .select()
    .from(certificates)
    .where(
      and(
        eq(certificates.courseId, courseId),
        eq(certificates.userId, session.user.id),
      ),
    )
    .limit(1)

  if (!certificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }

  return NextResponse.json({ certificate })
}
