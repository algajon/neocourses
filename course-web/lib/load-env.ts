// Side-effect module: loads .env.local / .env exactly like `next dev` does.
// Must be imported FIRST in standalone tsx entrypoints (migrate, seed, worker)
// so process.env is populated before any module that reads it (e.g. lib/db) evaluates.
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
