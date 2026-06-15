import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { organizations, users } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/utils'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, orgName } = body

    if (!name || !email || !password || !orgName) {
      return NextResponse.json(
        { error: 'name, email, password, and orgName are required' },
        { status: 400 }
      )
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    const now = new Date()

    const orgId = uuidv4()
    const slug = orgName.toLowerCase().replace(/\s+/g, '-')

    await db.insert(organizations).values({
      id: orgId,
      name: orgName,
      slug,
      createdAt: now,
      updatedAt: now,
    })

    const userId = uuidv4()
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      role: 'owner',
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json(
      {
        user: {
          id: userId,
          email: email.toLowerCase().trim(),
          name,
          role: 'owner',
          organizationId: orgId,
          createdAt: now,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/auth/register]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
