# courseneo — Rebuild Implementation Plan (from scratch)

> A clean, opinionated build spec for rewriting courseneo as an **internal web tool whose
> core product is generating courses and quizzes through our on-prem DGX Spark.**
> Hand this to a fresh session as the source of truth. Build the core feature first and
> polish it; everything else is explicitly deferred.

---

## 1. Product definition

**What it is:** an internal authoring tool. An author gives it a topic and/or uploads source
material; the system uses the **DGX Spark** to generate a structured course (modules →
lessons) and **quizzes**, which the author reviews, edits, regenerates, and publishes.

**The hero feature (must be polished):** the *generate → watch it build → review/edit →
regenerate → publish* loop. This is the product. It must feel fast, transparent, never
"stuck", and produce high-fidelity content grounded in the uploaded source.

**MVP = generation + authoring.** A clean read-only **preview** of a generated course is in
scope. The full learner LMS (enrollment, progress tracking, certificates, etc.) is **Phase 2**.

### Hard constraints (non-negotiable — this is why we're rewriting)
- **All inference runs on our DGX Spark only.** OpenAI-compatible (vLLM) endpoint via
  `MODEL_BASE_URL`. **No third-party AI/data APIs** — no OpenAI, Anthropic, ElevenLabs, etc.
  Course/source content must never leave our infrastructure.
- **On-prem data:** self-hosted Postgres, Redis, object storage (local disk or MinIO). No
  external analytics, email, or telemetry in MVP.
- **Text-to-speech (if/when consumption is built):** OS-native browser speech only
  (Web Speech API, on-device). **No external TTS.**
- **Transcription:** DGX does text generation, not speech-to-text → audio/video import is
  **not supported** in MVP (accept PDF/DOCX/MD/TXT). Revisit with an on-prem STT later.

### Assumptions (confirm before building)
1. **Single internal org / tenant** (no multi-tenant isolation in MVP). ← simplifies everything.
2. **Generation-first**: learner consumption deferred to Phase 2.
3. **Auth**: simple internal email+password accounts for MVP; SSO/SAML later.
4. Roles: `admin` and `author` only for MVP (no `learner` until Phase 2).

If any assumption is wrong, the scope/data-model sections change — flag early.

---

## 2. Stack

Keep what's proven; cut the bloat. Rationale: same team velocity, no surprises, all self-hostable.

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR + API routes in one deploy |
| DB | **Postgres + Drizzle ORM** | typed schema, SQL migrations |
| Jobs | **Redis + BullMQ** worker | generation runs off the request path |
| AI | **DGX Spark via OpenAI-compatible client** | the only inference backend |
| Storage | **local disk (dev) / MinIO (prod)** | source uploads; S3-compatible API |
| Auth | **Auth.js (NextAuth) credentials** | SSO later |
| Validation | **zod** | every model output is schema-validated |
| Styling | **CSS Modules + design tokens** | two themes via `data-theme`; no inline colors |
| Tests | **Vitest** (+ Playwright later) | unit + integration from day one |
| Dev orchestration | **one command runs web + worker + db + redis** | see §8 — this is critical |

---

## 3. Architecture overview

```
                  ┌─────────────── Next.js app ───────────────┐
  Author ───────► │  Authoring UI  ·  API routes  ·  Preview   │
                  └───────────────┬───────────────┬───────────┘
                                  │ enqueue job    │ read state/progress
                                  ▼                ▼
                         ┌──────────────┐   ┌──────────────┐
                         │ Redis (queue)│   │  Postgres    │
                         └──────┬───────┘   └──────▲───────┘
                                │ consume          │ write modules/lessons/quizzes
                                ▼                  │
                      ┌─────────────────────────────────────┐
                      │  Worker (BullMQ)  ── generation core  │
                      │  ingest→extract→retrieve→outline→     │
                      │  lessons→quizzes→validate→assemble    │
                      └──────────────────┬────────────────────┘
                                         │ OpenAI-compatible HTTP
                                         ▼
                                  ┌──────────────┐
                                  │  DGX Spark    │  (vLLM)
                                  └──────────────┘
```

**Why a worker:** generating a full course is ~60–120s of multiple DGX calls. It must run as a
background job, not in an HTTP handler. **The #1 failure in the previous build was the worker
silently not running** — make it first-class (§8).

---

## 4. The DGX client (the foundation — build & test first)

A single module, `lib/ai/dgx.ts`, is the *only* thing that talks to the model.

**Contract**
- Config from env: `MODEL_BASE_URL`, `MODEL_API_KEY?`, `MODEL_NAME`, `MODEL_TIER?`.
- Posts to `${MODEL_BASE_URL}/v1/chat/completions`. Sends `X-LLM-Tier` header when
  `MODEL_TIER` is set (vLLM cluster) and disables "thinking" tokens accordingly.
- **Timeouts** (e.g. 60s/call) + **retry with backoff** on 5xx/timeouts (max 2–3).
- **Streaming** support (for live progress in the UI).
- **Structured output discipline:**
  1. Strong system prompt: "Return valid JSON only, no markdown."
  2. `parseJSON()` strips fences/prose **and repairs unescaped control characters inside
     string literals before `JSON.parse`** (a real LLM failure mode — don't let it silently
     degrade content).
  3. **Validate every result with a zod schema.** On validation failure → one repair retry,
     then surface a typed error. **Never silently fall back to template content** — the UI
     must show the author exactly which item failed and offer "regenerate".
- Token/length budgeting per call.

**Provider abstraction:** `AIProvider` interface with a `DgxProvider` and a `MockProvider`
(deterministic, offline). Tests and local dev run on the mock; the mock is *never* a silent
production fallback.

---

## 5. Generation pipeline (the polished core)

A pure, testable pipeline of stages. Each stage is a function `(input) → output` that the
worker drives and persists between steps (so a job is **resumable** and progress is visible).

1. **Brief** — author input: title, audience, course type, target depth (# modules, lessons
   per module), tone/reading level, and optional uploaded sources.
2. **Extract** — parse uploads to text on-prem (PDF/DOCX/MD/TXT). No external services.
3. **Retrieve** — lexical chunking + relevance selection (`selectRelevantChunks`, BM25/keyword;
   **no external embeddings**). Per-lesson, pass only the most relevant source passages.
4. **Outline** — DGX generates modules + lesson titles, grounded in source if present.
5. **Lessons** — for each lesson, DGX generates structured content (intro, concepts,
   key points, example, tip), **strictly grounded** ("generate only from the source; do not
   invent facts"), with word caps so slides render cleanly. Bounded concurrency (e.g. 3–5).
6. **Quizzes** — per module, generate MCQs from the *generated lesson content*: question,
   options, correct answer, and a short explanation. Validate answer integrity.
7. **Validate & assemble** — zod-validate everything; write modules/lessons/quizzes to Postgres.
8. **Review** — author edits/regenerates per item, then publishes.

**Progress model:** the job persists `{stage, completed, total, statusMessage}` and emits
events; the UI shows a live, per-stage / per-lesson progress view (see §6).

**Fidelity is a feature.** Acceptance: given a source with invented vocabulary, generated
lessons must use that vocabulary and must not introduce outside jargon. Encode this as an
eval test (§7).

---

## 6. The authoring experience (polish lives here)

This is the main screen; spend the polish budget here.

- **New Course wizard:** Brief → Sources → Generate. Minimal, fast, keyboard-friendly.
- **Live generation view:** a per-stage progress rail + lesson cards that fill in as each
  lesson lands (stream/poll). Always show elapsed time, current step, and a **Cancel**. It
  must be *impossible* to look "stuck" — if a job stalls or errors, show the error inline with
  **Retry**. (This directly answers the previous "nothing is generating" problem.)
- **Outline editor:** reorder/rename/add/remove modules & lessons; edit lesson content inline.
- **Per-item regenerate:** regenerate a single lesson or quiz with optional instructions
  ("make it more concrete", "shorten"), with undo.
- **Quiz editor:** edit questions/options, mark correct answers, see explanations.
- **Quality knobs:** grounding strictness, length, reading level, tone — passed into prompts.
- **Read-only preview:** a clean rendering of the finished course + quizzes (the Phase-2
  learner view grows from this).
- **States:** first-class empty / loading / error / partial states everywhere.
- **Responsive + theming:** desktop-first (authoring tool), works on tablet; design tokens,
  light/dark, no hardcoded colors; verify key screens at 1280 and 768.

---

## 7. Data model (MVP)

Minimal — only what generation + authoring needs.

```
users(id, email, password_hash, name, role)            -- role: admin | author
courses(id, title, description, type, status,           -- status: draft | published
        audience, depth_json, created_by, created_at)
source_materials(id, course_id, filename, mime, bytes,
        extracted_text, created_at)
modules(id, course_id, position, title, description)
lessons(id, course_id, module_id, position, title,
        content_json, generated_by, created_at)         -- generated_by: dgx | edited | mock
quizzes(id, course_id, module_id)
quiz_questions(id, quiz_id, position, prompt,
        options_json, correct_index, explanation)
generation_jobs(id, course_id, type, status,            -- status: pending|running|done|failed
        stage, progress, status_message, error,
        started_at, completed_at, created_at)
```

**Deferred tables (do NOT build in MVP):** enrollments, lesson_progress, quiz_attempts,
certificates, teams/team_members, notifications, learner_stats/badges, flashcards,
comments, billing/usage. Add when Phase 2/3 actually needs them.

---

## 8. Jobs, worker & local dev (don't repeat the past mistake)

- **One dev command starts everything:** `npm run dev` → web + worker together (via
  `concurrently` or a `Procfile`/`turbo`), with `docker compose up` for Postgres + Redis.
  A dev should never have to remember to start the worker separately.
- **Worker health & observability:** the worker logs "ready", emits a heartbeat, and exposes
  health. An admin "Jobs" view shows recent jobs with status, stage, elapsed, and error.
- **Failure surfacing:** a failed/stalled job is visible in the UI with the error + Retry —
  never a silent spinner.
- **Idempotent, resumable steps:** re-running a job resumes from the last completed stage.
- **Stalled-job reaper:** mark jobs with no heartbeat as failed so they don't hang forever.

---

## 9. Testing strategy (previous build had ~3 tests — fix that)

- **Unit:** DGX client (JSON repair + zod validation + retry), each pipeline stage (against
  the mock provider), quiz answer-key integrity, text extraction.
- **Integration:** full generation job end-to-end on the mock provider; auth; API routes.
- **Fidelity eval:** seed a source with invented terms → assert generated lessons use them and
  pass schema. Run in CI as a regression guard.
- **E2E (Playwright, once UI stabilizes):** create → generate (mock) → edit → publish → preview.
- CI gate: typecheck + unit + integration must pass.

---

## 10. Milestones & acceptance criteria

> Build in this order. Each milestone is shippable and demoable.

**M0 — Scaffold (½–1 day)**
Next.js + TS + Drizzle + Postgres/Redis via docker-compose + one-command dev (web+worker) +
auth (admin/author) + design tokens/themes + CI (typecheck/test).
*Done when:* log in, see an empty dashboard, `npm run dev` brings up everything.

**M1 — DGX generation core (the heart)**
DGX client (streaming, retry, JSON-repair, zod). Pipeline stages (mock + DGX). BullMQ worker.
Generate a course from a **brief only** (no source yet): outline → lessons → quizzes → persisted.
*Done when:* "New Course" → a full course generates end-to-end on the DGX in <2 min, content
is schema-valid, and the Jobs view shows progress + handles a forced failure with Retry.

**M2 — Source grounding + review/edit**
Upload PDF/DOCX/MD/TXT → extract → retrieve → grounded generation. Outline editor, inline
lesson editing, per-item regenerate, quiz editor.
*Done when:* a course generated from a source uses the source's vocabulary (fidelity eval
passes), and an author can edit/regenerate any lesson or quiz.

**M3 — Polish the hero loop**
Live streaming generation view (per-lesson cards fill in), cancel, quality knobs, robust
empty/error/partial states, responsive + theme pass, read-only preview. Publish/export
(Markdown/JSON).
*Done when:* the generate→review→publish loop feels fast, transparent, and never "stuck";
key screens verified at desktop + tablet, light + dark.

**M4 — Hardening**
Test coverage to a real bar (DGX client, pipeline, auth, jobs). Stalled-job reaper. Admin
Jobs dashboard. Seed script + fresh-DB bootstrap verified. Docs/README.
*Done when:* CI green, a clean `git clone → setup → generate` works on a fresh machine.

### Phase 2+ (explicitly NOT MVP — revisit after the core is polished)
Learner experience (enroll, lesson player, **OS-native TTS**, mandatory quizzes, progress,
certificates), gamification, teams & analytics, SSO, multi-tenant, on-prem STT for media,
public/marketing pages. Each is a separate effort; do not let them dilute the MVP.

---

## 11. Anti-scope (cut from the previous build for MVP)

Billing/Stripe · teams & org analytics · certificates & verification · gamification/badges ·
notifications system · flashcards · tutor chat · public marketing/pricing pages · mobile
companion app · device pairing · email · **all third-party AI/voice/transcription**. These
added surface area without serving the core. Ship the polished generator first.

---

## 12. Open decisions to confirm
1. Does MVP include any **learner consumption**, or is it purely the authoring/generation tool?
2. **Single org** confirmed, or do we need multi-tenant from day one?
3. Auth: internal accounts for MVP with **SSO later**, or SSO required at launch?
4. Export targets — Markdown/JSON enough for MVP, or is SCORM/LMS export needed early?
5. Is the DGX serving **embeddings** (then we can do semantic retrieval), or text-gen only
   (then retrieval stays lexical)?
