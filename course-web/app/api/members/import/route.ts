import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'
import { hashPassword } from '@/lib/auth/utils'
import { createNotification } from '@/lib/notify'

const VALID_ROLES = ['owner', 'admin', 'reviewer', 'learner'] as const
type Role = (typeof VALID_ROLES)[number]

interface ImportRow {
  name?: string
  email?: string
  role?: string
}

interface RowError {
  email: string
  reason: string
}

interface ImportSummary {
  created: number
  skipped: number
  errors: RowError[]
}

/**
 * Parses CSV text with a required header row containing at least an `email`
 * column (also recognizes `name` and `role`). Quoted fields and commas inside
 * quotes are handled; rows with the wrong column count fall back to positional.
 */
function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const nameIdx = header.indexOf('name')
  const emailIdx = header.indexOf('email')
  const roleIdx = header.indexOf('role')

  // If there is no recognizable header, assume positional name,email,role and
  // treat every line (including the first) as data.
  const hasHeader = emailIdx !== -1 || nameIdx !== -1 || roleIdx !== -1
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const cells = splitCsvLine(line)
    if (hasHeader) {
      return {
        name: nameIdx !== -1 ? cells[nameIdx]?.trim() : undefined,
        email: emailIdx !== -1 ? cells[emailIdx]?.trim() : undefined,
        role: roleIdx !== -1 ? cells[roleIdx]?.trim() : undefined,
      }
    }
    return {
      name: cells[0]?.trim(),
      email: cells[1]?.trim(),
      role: cells[2]?.trim(),
    }
  })
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerRole = session.user.role
    const organizationId = session.user.organizationId
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization associated with this account' },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    let rows: ImportRow[]
    if (typeof body.csv === 'string') {
      rows = parseCsv(body.csv)
    } else if (Array.isArray(body.rows)) {
      rows = body.rows as ImportRow[]
    } else {
      return NextResponse.json(
        { error: 'Provide either `rows` (array) or `csv` (string)' },
        { status: 400 }
      )
    }

    const summary: ImportSummary = { created: 0, skipped: 0, errors: [] }
    // Track emails seen within this batch so duplicate rows in the same upload
    // don't each attempt a create.
    const seenInBatch = new Set<string>()

    for (const raw of rows) {
      const email = (raw.email ?? '').toLowerCase().trim()
      const name = (raw.name ?? '').trim()

      if (!email) {
        summary.errors.push({ email: raw.email ?? '', reason: 'Missing email' })
        continue
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        summary.errors.push({ email, reason: 'Invalid email' })
        continue
      }
      if (seenInBatch.has(email)) {
        summary.skipped++
        continue
      }
      seenInBatch.add(email)

      // Resolve and validate role.
      let role: Role = 'learner'
      const requested = (raw.role ?? '').toLowerCase().trim()
      if (requested) {
        if (!VALID_ROLES.includes(requested as Role)) {
          summary.errors.push({ email, reason: `Invalid role "${raw.role}"` })
          continue
        }
        if ((requested === 'admin' || requested === 'owner') && callerRole !== 'owner') {
          summary.errors.push({
            email,
            reason: 'Only an owner can create admin or owner accounts',
          })
          continue
        }
        role = requested as Role
      }

      try {
        // Dedupe within the caller's organization.
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email), eq(users.organizationId, organizationId)))
          .limit(1)

        if (existing) {
          summary.skipped++
          continue
        }

        const tempPassword = randomBytes(18).toString('base64url')
        const passwordHash = await hashPassword(tempPassword)
        const now = new Date()
        const id = uuidv4()

        await db.insert(users).values({
          id,
          email,
          name: name || email,
          passwordHash,
          role,
          organizationId,
          createdAt: now,
          updatedAt: now,
        })

        summary.created++

        // Best-effort welcome notification + email (createNotification fires the
        // email side-effect for type 'welcome' and never throws).
        try {
          await createNotification({
            userId: id,
            type: 'welcome',
            title: 'Welcome to courseneo',
            body: 'Your account has been created.',
          })
        } catch (notifyErr) {
          console.error('[POST /api/members/import] notify failed', notifyErr)
        }
      } catch (rowErr) {
        console.error('[POST /api/members/import] row failed', email, rowErr)
        summary.errors.push({ email, reason: 'Failed to create user' })
      }
    }

    return NextResponse.json(summary, { status: 200 })
  } catch (error) {
    console.error('[POST /api/members/import]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
