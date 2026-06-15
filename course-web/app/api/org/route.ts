import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function currentOrg(orgId: string | null | undefined) {
  if (!orgId) return null
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  return org ?? null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const org = await currentOrg(session.user.organizationId)
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  return NextResponse.json(org)
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const orgId = session.user.organizationId
  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
  }

  const [updated] = await db
    .update(organizations)
    .set({ name, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug })

  return NextResponse.json(updated)
}
