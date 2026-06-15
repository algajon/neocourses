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

## Key Flows
1. **Admin creates course** → uploads materials → enqueues AI generation job →
   worker generates modules/lessons/quizzes → admin reviews + edits → publishes
2. **Learner takes course** → sequential lesson completion → chapter quiz →
   progress tracking → certificate
