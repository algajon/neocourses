# courseneo — AI Course & Onboarding Generator

## Overview
Full-stack web app that converts company knowledge into structured courses and onboarding programs.

## Stack
Next.js 14, TypeScript, PostgreSQL (Drizzle ORM), Redis + BullMQ job queue, S3/R2 object storage, NextAuth v4, Anthropic Claude.

## Quick start (local)

### Prerequisites
- Node.js 18+
- Docker (for local Postgres + Redis)

### Steps
```bash
cd course-web
docker compose up -d        # 1. starts Postgres + Redis
cp .env.example .env.local  # 2. then edit if needed (set NEXTAUTH_SECRET)
npm install                 # 3. install deps
npm run db:generate         # 4. (already committed) regenerates SQL from schema
npm run db:migrate          # 5. apply migrations to Postgres
npm run db:seed             # 6. load demo data
npm run dev                 # 7. app on http://localhost:3000  (terminal 1)
npm run worker              # 8. AI generation worker            (terminal 2)
```

The web app (`npm run dev`) serves pages and the API; the worker (`npm run worker`)
processes background AI course-generation jobs off the Redis/BullMQ queue. Both must
be running for course generation to complete.

### Environment notes
- `NEXTAUTH_SECRET` is required — generate one with `openssl rand -base64 32`.
- `DATABASE_URL` defaults to the docker-compose Postgres (`postgresql://courseneo:courseneo@localhost:5432/courseneo`).
- `REDIS_URL` defaults to `redis://localhost:6379`.
- Without `ANTHROPIC_API_KEY` the **mock AI** is used (realistic, pre-written content).
  Set the key to use Claude (`claude-haiku-4-5`) for real generation.
- `STORAGE_DRIVER=local` keeps uploads on disk for dev. Set `STORAGE_DRIVER=s3`
  (plus the `S3_*` vars) to store uploads in S3/R2 for production.
- `PG_POOL_MAX` (default 10) caps the per-instance Postgres connection pool.
- `WORKER_CONCURRENCY` (default 3) sets jobs processed in parallel per worker.

## Demo Accounts (after seeding)
| Email | Password | Role |
|-------|----------|------|
| admin@acme.com | password123 | Admin |
| reviewer@acme.com | password123 | Reviewer |
| john@acme.com | password123 | Learner |
| jane@acme.com | password123 | Learner |

## Demo Course
The seed script creates a complete "New Employee Onboarding" course with:
- 5 modules, 15 lessons, 5 quizzes
- Onboarding checklist (15 items)
- Demo learner progress for two users

## AI Behavior
- Without `ANTHROPIC_API_KEY`: uses mock AI with realistic, pre-written content
- With `ANTHROPIC_API_KEY`: uses Claude `claude-haiku-4-5` for real generation

## Architecture
```
course-web/
  app/               Next.js App Router pages
    (public)/        Landing, features, pricing
    (admin)/         Admin dashboard, course management
    (learner)/       Learner dashboard, lesson player
    api/             REST API routes
  lib/
    db/              Drizzle schema (pg-core) + Postgres pool + migrate + seed
    auth/            NextAuth config + utilities
    ai/              AI provider interface + mock + Claude
    queue/           BullMQ queue + Redis connection
    storage/         Object storage driver (local / S3-R2)
  worker/            BullMQ worker — runs AI course generation jobs
  drizzle/           Generated SQL migrations
  components/        Shared UI components
  types/             TypeScript type extensions
```

For the production deployment topology (managed Postgres + read replicas,
PgBouncer, worker fleet, S3/R2, CDN), see [docs/SCALING.md](../docs/SCALING.md).

## Running in production

Two long-lived Node processes must run, backed by Postgres and Redis:

| Process | Command | Role |
|---------|---------|------|
| Web app | `npm run build && npm run start` (`next start`) | Serves pages + API routes; enqueues generation jobs |
| Worker  | `npm run worker` | Consumes the BullMQ `course-generation` queue and runs AI generation |

The web app **enqueues** jobs but never generates content itself — without at
least one worker running, courses stay stuck in `processing` forever. Run the
worker as its **own process / dyno / container**, separate from the web dyno, so
a web deploy or restart never interrupts an in-flight generation. Scale
generation throughput horizontally by running more worker processes and/or
raising `WORKER_CONCURRENCY` per worker.

### Backing services
- **PostgreSQL** — primary data store (Drizzle). Run `npm run db:migrate` as a
  release/deploy step before starting the new web + worker processes.
- **Redis** — backs the BullMQ queue. Must be reachable by **both** the web app
  and every worker. Use a persistent (not ephemeral/in-memory) Redis so queued
  jobs survive a Redis restart.

### Required environment variables
Set these on **both** the web and worker processes (they share `lib/`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string |
| `REDIS_URL` | yes | Redis connection for the BullMQ queue (defaults to `redis://localhost:6379`) |
| `NEXTAUTH_URL` | yes (web) | Canonical app URL for NextAuth callbacks |
| `NEXTAUTH_SECRET` | yes (web) | NextAuth session/JWT secret — `openssl rand -base64 32` |
| `MODEL_BASE_URL` | one of these | OpenAI-compatible base URL (OpenAI, vLLM, DeepSeek, Qwen, …). If set, used for course generation. |
| `MODEL_API_KEY` | with `MODEL_BASE_URL` | API key for the OpenAI-compatible endpoint |
| `MODEL_NAME` | optional | Generation model name (default `gpt-4o-mini`) |
| `ANTHROPIC_API_KEY` | one of these | Use Claude for generation when `MODEL_BASE_URL` is unset. With neither, the mock AI is used. |
| `OPENAI_API_KEY` | optional | Enables lesson text-to-speech (`/api/tts`, OpenAI audio/speech). TTS is disabled without it. |
| `TTS_MODEL` / `TTS_VOICE` | optional | TTS model (default `gpt-4o-mini-tts`) and voice (default `nova`) |
| `STORAGE_DRIVER` | recommended | `s3` (plus `S3_*` vars) to store uploads in S3/R2; `local` keeps them on disk |
| `PG_POOL_MAX` | optional | Per-instance Postgres pool cap (default 10) |
| `WORKER_CONCURRENCY` | optional | Jobs processed in parallel **per worker** (default 3) |

### Job resilience & recovery
Course-generation jobs are configured for fault tolerance (see
`lib/queue/index.ts` and `worker/index.ts`):
- **Retries** — 3 attempts with exponential backoff (5s → 10s → 20s) on any
  failure, set as the queue's `defaultJobOptions`.
- **Stalled-job recovery** — a crashed mid-job worker is detected via an expired
  job lock (`lockDuration`, default 5 min) and the job is reclaimed and retried,
  up to `maxStalledCount` (default 2). Tunable via `WORKER_LOCK_DURATION_MS`,
  `WORKER_STALLED_INTERVAL_MS`, `WORKER_MAX_STALLED`.
- **Final failure** — after the last attempt the course is reset to `draft` and
  the `ai_generation_jobs` row is marked `failed` with the error message, so it
  is never left stuck in `processing`.
- **Startup recovery** — on boot the worker reconciles any `ai_generation_jobs`
  rows left in `running`/`processing`/`pending` with no live BullMQ job (e.g.
  after a hard crash): they are marked `failed` and their course reset to
  `draft`, so the course can be regenerated.
- **Health signals** — the worker logs `ready`, a periodic heartbeat
  (`WORKER_HEARTBEAT_MS`, default 60s), Redis connection errors/reconnects, and
  stalled/failed jobs, for log-based liveness monitoring.

## Key Flows
1. **Admin creates course** → uploads materials → enqueues AI generation job →
   worker generates modules/lessons/quizzes → admin reviews + edits → publishes
2. **Learner takes course** → sequential lesson completion → chapter quiz →
   progress tracking → certificate
