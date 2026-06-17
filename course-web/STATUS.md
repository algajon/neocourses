# courseneo (web) — Project Status

_Living document for the **web** rebuild (`course-web/`). Update it when a milestone lands, a feature changes state, or a known issue opens/closes._

> The root `../STATUS.md` covers the **desktop** app (`course-studio/`, Tauri). This file is the source of truth for the Next.js SaaS rebuild that ships to the `neocourses` repo.

**Last updated:** 2026-06-17 · **Version:** 0.1.0 · **Last commit:** `bf7de705` (in-app award toasts)

---

## TL;DR

The MVP loop is **complete and wired end-to-end**: create → generate → publish → enroll → learn → assess → certify, plus the org/admin and engagement layers around it. The app builds clean (0 TS errors) and runs locally. The remaining work to a **production launch** is hardening, not features: thin automated test coverage, and live third-party credentials (Stripe, email, SSO) that are currently stubbed with graceful no-key fallbacks.

---

## Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5
- **Data:** PostgreSQL via Drizzle ORM (`pg`), 6 migrations in `drizzle/`
- **Jobs:** Redis + BullMQ (`worker/index.ts`) for background AI generation
- **Storage:** S3/R2 (`@aws-sdk/client-s3`) with a local-disk driver fallback
- **Auth:** NextAuth v4 (credentials + bcrypt), org-scoped sessions
- **AI:** provider abstraction (`lib/ai/`) — OpenAI-compatible (`MODEL_BASE_URL`/`MODEL_API_KEY`, e.g. on-prem DGX/vLLM) **or** Anthropic Claude (`ANTHROPIC_API_KEY`); per-lesson RAG grounding (`lib/ai/retrieve.ts`)
- **Speech:** OpenAI Whisper (transcription) + TTS (lesson "Listen"), gated on `OPENAI_API_KEY`
- **Payments:** Stripe (`stripe`) — checkout + webhook
- **Email:** Resend, with a Noop logger fallback when unkeyed
- **Styling:** CSS Modules + design tokens, two themes (`white`/`dark`), theme-aware brand accent (lime in dark → olive in light)

## Running locally

```bash
cd course-web
docker compose up -d         # Postgres + Redis
cp .env.example .env.local   # set NEXTAUTH_SECRET (+ keys as needed)
npm install
npm run db:migrate           # apply migrations
npm run db:seed              # demo org + users (admin@/reviewer@/john@/jane@ acme.com, pw: password123)
npm run dev                  # app  → http://localhost:3000   (terminal 1)
npm run worker               # AI generation worker            (terminal 2)
```

Both `dev` and `worker` must run for course generation to complete. See `README.md` for prerequisites and `docs/SCALING.md` for the scale design (targets ~500 orgs / 100k users).

---

## Features complete

### Authoring (admin/editor)
- Import source material: PDF, audio, video, documents, and **URL ingest**; audio/video auto-transcribed (Whisper, ≤25 MB)
- Background AI generation (BullMQ worker) with progress + resilience/retry
- **Content fidelity:** lessons + tutor are RAG-grounded to the source ("generate only from source"), verified to use source vocabulary and avoid hallucinated jargon
- Outline / lesson / quiz editors; per-lesson and per-quiz regeneration
- Full create pipeline stepper: Basic Info → Settings → Upload → Generate → Review → Publish
- Review workflow (request/approve) + publish/unpublish
- Course visual: deterministic per-course gradient or uploaded thumbnail
- Onboarding checklists (admin-defined, learner-tracked)

### Learning (trainee)
- Catalog with search + difficulty/type/price filters and gradient thumbnails
- Pricing models: **free / paid / first-chapter-free**; demo purchase → unlock; chapter gating
- Lesson player (FitSlide, fits desktop + mobile), **Listen** (OpenAI TTS), per-lesson **notes**
- **AI tutor** chat per course (grounded, with history)
- **Flashcards** with spaced-repetition review
- Mandatory chapter **quizzes** (content-derived) gating progression; attempts + results
- **Certificates** with public verification page + in-app **certificate preview modal**
- Gamification: points, streaks, badges; **in-app award toasts** (no OS/browser push) + notification bell

### Org / Admin
- Dashboard with stats; course + member management; member CSV import
- **Teams** + team-scoped progress analytics (with team selector) + CSV export
- Course assignment; roles (owner/admin/editor/trainee) with role-change guards
- Billing (Stripe checkout + webhook); org settings; account settings
- Email reminders via `/api/cron/reminders` (`CRON_SECRET`-guarded)

### Platform
- Public marketing pages (landing, features, pricing) + auth (login/signup)
- Multi-tenant isolation: org-scoped queries across routes (cross-tenant audit closed 30+ leaks across 19 routes)
- 27 schema tables; theme-aware UI; graceful degradation when optional services are unkeyed

---

## Known gaps / risks (to production launch)

| Area | State | Risk |
|------|-------|------|
| **Automated tests** | 3 unit test files (`sr`, `quiz`, `ai/retrieve`) vs ~60 API routes + worker | **High** — no coverage on auth, tenant isolation, billing webhook, progress/quiz |
| **Stripe** | Code complete; needs live keys + staging smoke test of a real purchase | Medium — billing is stubbed (unlimited-free) without keys |
| **Email (Resend)** | Code complete; Noop fallback logs instead of sending without `RESEND_API_KEY` | Medium |
| **SSO / SAML** | Not implemented (credentials auth only) | Medium for enterprise sales |
| **`OPENAI_API_KEY`** | Used by TTS + transcription but **absent from `.env.example`** | Low — document it |
| **Load/scale validation** | `docs/SCALING.md` designed for 500 orgs/100k users; not load-tested | Medium |
| **Fresh-DB bootstrap** | `db:migrate` + `db:seed` exist; not re-verified end-to-end recently | Low |

---

## Suggested next milestones

1. **Test the money + correctness paths** — auth, tenant isolation, Stripe webhook, quiz/progress.
2. **Go-live credentials** — wire Stripe + Resend in staging; smoke-test a real purchase and a real email.
3. **Add `OPENAI_API_KEY` to `.env.example`** with a note that it powers Listen + media transcription.
4. **(Enterprise) SSO/SAML** when a customer requires it.
