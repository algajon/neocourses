# courseneo — Production Scaling Topology

Target: **500+ organizations, 100,000+ users**. This document describes the
production deployment for the `course-web` Next.js application and explains the
re-architecture away from the original SQLite prototype.

---

## 1. Capacity reasoning

- **~100,000 users across ~500 organizations** → ~200 users/org on average, with a
  long tail (a few orgs with thousands of seats, many with tens).
- **Workload shape:** mostly read-heavy learner traffic (catalog browsing, lesson
  playback, progress reads) with write bursts at quiz submission, lesson-completion,
  and enrollment. Course *generation* is heavy but asynchronous (offloaded to the
  worker fleet, see §5).
- **Peak concurrency assumption:** corporate L&D traffic is bursty and timezone-clustered.
  Assume ~10% of users active during a regional peak hour and ~1–2% concurrent at any
  instant → on the order of **1,000–2,000 concurrent sessions**, with request rates in
  the low thousands of req/s at peak (most requests are cheap cached reads).
- **Why SQLite was replaced:** `better-sqlite3` is a single-writer, single-process,
  file-backed engine. It cannot be shared across multiple stateless app replicas, has
  no native replication or connection pooling, serializes all writes behind one lock,
  and ties durability to one host's disk. None of that survives horizontal scaling or a
  multi-tenant SLA. We moved to **managed PostgreSQL** for concurrent multi-writer
  access, replication, pooling, and operational tooling (backups, PITR, slow-query logs).

---

## 2. Topology

```
                              ┌─────────────┐
            Internet ───────► │   CDN       │  static assets, _next/static, images
                              │ (edge cache)│
                              └──────┬──────┘
                                     │ dynamic
                              ┌──────▼──────┐
                              │ Load Balancer│  TLS termination, health checks
                              └──────┬──────┘
                  ┌──────────────────┼──────────────────┐
            ┌─────▼─────┐      ┌─────▼─────┐       ┌─────▼─────┐
            │ Next.js    │      │ Next.js   │  ...  │ Next.js   │   N stateless replicas
            │ replica 1  │      │ replica 2 │       │ replica N │   (JWT, no sticky sessions)
            └──┬──────┬──┘      └──┬─────┬──┘       └──┬─────┬──┘
               │      │            │     │             │     │
        enqueue│      │ pg         │     │ pg          │     │
               │      └────────────┼─────┴─────────────┼─────┘
               │                   │                    │
               │            ┌──────▼──────┐      ┌──────▼──────┐
               │            │  PgBouncer  │      │   Redis      │◄── BullMQ queue
               │            │ (txn pool)  │      │ (managed/    │     + hot-read cache
               │            └──────┬──────┘      │  cluster)    │
               │                   │             └──────┬───────┘
               │          ┌────────┴────────┐          │ pull jobs
               │   ┌──────▼──────┐   ┌───────▼──────┐   │
               │   │  Postgres   │   │  Postgres    │   │
               │   │  PRIMARY    │──►│ READ REPLICAS│   │
               │   │ (writes)    │   │ (reads)      │   │
               │   └─────────────┘   └──────────────┘   │
               │                                ┌────────▼────────┐
               └───────────────────────────────►│  Worker fleet   │  M workers,
                                                 │  (BullMQ)       │  scaled independently
                                                 └────────┬────────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │  S3 / R2    │  uploads, certificates
                                                   │ object store│  (presigned URLs)
                                                   └─────────────┘
```

---

## 3. App tier

- **Stateless Next.js** behind a load balancer, **N replicas**, horizontally autoscaled
  on CPU / request latency / concurrency.
- **Auth via JWT** (NextAuth JWT session strategy) — sessions live in the signed token,
  so **no sticky sessions** and no shared session store are required. Any replica can
  serve any request.
- No local writable state on app instances (uploads go to object storage, jobs to Redis),
  so instances are fully disposable — rolling deploys and scale-to-zero of idle capacity
  are safe.
- **Rough sizing:** a single Next.js instance comfortably serves a few hundred req/s of
  mostly cached/read traffic. Start at 3 replicas (HA across AZs), autoscale up. At the
  modeled low-thousands req/s peak, expect roughly **6–12 web replicas**.

---

## 4. Database tier

- **Managed PostgreSQL**: a **primary for writes** plus **read replicas** for read-heavy
  endpoints (course catalog, lesson reads, progress dashboards, analytics). Route reads
  to replicas and accept the small replication lag for non-critical reads; keep
  read-after-write paths (e.g. just-submitted quiz score) on the primary.
- **PgBouncer in transaction pooling mode** sits in front of Postgres. The app's
  node-postgres `Pool` max is kept **small per instance** (`PG_POOL_MAX`, default **10**)
  because *many app instances × pool size* must stay safely under Postgres
  `max_connections`. PgBouncer **multiplexes** thousands of short-lived client
  connections onto a small set of real backend connections, which is what lets the web
  tier scale out without exhausting the database.
  - Example: 12 web replicas × 10 = 120 client conns, plus the worker fleet — PgBouncer
    funnels these onto e.g. 50–100 real Postgres backends.
- **Tenant-scoped indexes already in the schema:** composite **`(organizationId, …)`**
  indexes (e.g. `courses_org_status_idx` on `(organization_id, status)`,
  `courses_org_idx`, `users_org_idx`) keep per-tenant queries fast as row counts grow.
  Other hot paths are covered too: `enroll_course_user_idx`, `lp_lesson_user_idx`,
  `qa_user_quiz_idx`.
- **When to add read replicas:** add the first replica once read load on the primary
  sustains ~50–60% CPU or replica-eligible reads exceed ~70% of query volume; add
  further replicas per ~1–2k additional read req/s. Move analytics/reporting queries to
  a dedicated replica so they never contend with interactive traffic.
- **Later levers:** **partition** large tables (e.g. `lesson_progress`, `quiz_attempts`,
  `ai_tutor_messages`) by `organizationId` or by time, and ultimately **shard by org**
  across multiple Postgres clusters once a single primary's write capacity is the bottleneck.

---

## 5. Tenant isolation

- **Every query is organization-scoped.** Application code filters by `organizationId`
  on all multi-tenant tables; the composite org indexes back these filters.
- **Hardening step: Postgres Row-Level Security (RLS).** Define per-tenant RLS policies
  and set the current org id as a session variable per request so the database enforces
  isolation even if an application query forgets a `WHERE organizationId = …` clause.
  This is defense-in-depth against cross-tenant data leaks.
- Object-storage keys are namespaced per org (`{orgId}/…`) and only ever exposed through
  short-lived presigned URLs, so one tenant cannot enumerate or reach another's files.

---

## 6. Queue tier (background AI generation)

- **Redis (managed / clustered) + BullMQ.** Course-generation jobs are enqueued by the
  web tier (`enqueueCourseGeneration`) and processed by a separate **worker fleet**.
- **Independent scaling:** the worker fleet scales separately from the web tier — AI
  generation is CPU/latency-bound on the model call, so workers scale on **queue depth**
  rather than HTTP traffic. A spike of uploads grows the queue, autoscaling adds workers,
  and the web tier is unaffected.
- **Concurrency per worker:** `WORKER_CONCURRENCY` (default **3**) jobs in parallel per
  worker process. Tune against Anthropic rate limits and per-job DB write volume; total
  in-flight generation = workers × concurrency.
- **Retries / backoff already configured:** jobs run with `attempts: 3` and
  `exponential` backoff (5s base), so transient model/DB failures are retried automatically.
- **Dead-letter retention:** `removeOnFail: 500` keeps the last 500 failed jobs in Redis
  for inspection/replay (a lightweight dead-letter buffer); `removeOnComplete: 100` caps
  completed-job retention so Redis memory stays bounded.

---

## 7. Object storage

- **S3 / R2 for all uploads** (source materials, generated certificates) — **no local
  disk in production**. The storage layer is driver-based (`STORAGE_DRIVER`): `local`
  for dev, `s3` for prod (S3, Cloudflare R2, or any S3-compatible endpoint via `S3_ENDPOINT`).
- **Presigned URLs** for both upload and download: clients PUT/GET directly against the
  bucket, so large files never stream through the Next.js app tier, and access is
  time-boxed and per-object.
- Buckets are versioned with lifecycle rules; serve learner-facing assets via the CDN.

---

## 8. Caching / CDN

- **CDN** fronts all static assets (`_next/static`, images, public files) and absorbs the
  bulk of request volume at the edge.
- **Redis caching for hot read paths:** cache the **course catalog**, published-course
  metadata, and **analytics/dashboard aggregates** in Redis with short TTLs and explicit
  invalidation on publish/edit. These are the highest-fanout reads (every learner hits
  the catalog) and are the first thing to offload from Postgres replicas.

---

## 9. Observability

- **Structured logs** (JSON) from web and worker, shipped to a central log store with
  per-request and per-job correlation ids.
- **Queue dashboard:** **Bull Board** for live queue depth, active/failed/completed jobs,
  and manual retry of dead-lettered jobs.
- **DB slow-query logs** + `pg_stat_statements` to catch missing indexes and N+1s;
  alert on replication lag and connection saturation (at PgBouncer and Postgres).
- **Metrics:** request rate/latency/error rate per route, worker throughput and job
  duration, Redis memory and queue backlog, autoscaler signals. Dashboards + alerting.

---

## 10. Rough numbers (operational rules of thumb)

| Signal | Action |
|--------|--------|
| Web instance sustains > ~300 req/s or > ~70% CPU | add a web replica (autoscale) |
| Primary read CPU > ~50–60%, or reads > ~70% of queries | add the first read replica |
| Each additional ~1–2k read req/s | add another read replica |
| `many instances × PG_POOL_MAX` approaching `max_connections` | front with / scale PgBouncer; keep per-instance pool small |
| Queue backlog grows faster than it drains | add workers (scale on queue depth) |
| Single primary write throughput saturated | partition hot tables, then shard by org |
| Catalog/analytics reads dominate replica load | add Redis cache for those paths |

**Starting point** for the 100k-user / 500-org target: ~6–12 web replicas, 1 primary +
2 read replicas behind PgBouncer, a Redis cluster, and a worker fleet autoscaled on
queue depth (start at 3–5 workers × concurrency 3). Scale each tier independently using
the signals above.
