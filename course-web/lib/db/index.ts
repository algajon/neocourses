import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your environment (see .env.example), e.g. ' +
      'postgresql://courseneo:courseneo@localhost:5432/courseneo'
  )
}

// Reuse a single Pool across hot-reloads in dev so we don't exhaust Postgres
// connections every time a module is re-evaluated.
const globalForPg = globalThis as unknown as { __pgPool?: Pool }

export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__pgPool = pool
}

export const db = drizzle(pool, { schema })

// Migrations are now run via `npm run db:migrate` (drizzle-kit + lib/db/migrate.ts).
// This no-op export remains so existing imports of runMigrations keep compiling.
export async function runMigrations(): Promise<void> {}
