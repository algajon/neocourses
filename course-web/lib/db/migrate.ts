import '@/lib/load-env'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Add it to your environment (see .env.example), e.g. ' +
        'postgresql://courseneo:courseneo@localhost:5432/courseneo'
    )
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)

  console.log('Running migrations…')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations complete.')

  await pool.end()
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
