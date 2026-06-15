# courseneo — Project Status

_Living document. Update it when a milestone lands, a feature changes state, or a known issue is opened/closed._

**Last updated:** 2026-06-09 · **Desktop:** 0.1.0 · **Mobile:** — (not yet scaffolded)

## Build status
- Frontend: `npm run build` — clean (0 TS errors)
- Rust: `cargo check` — clean (1 dead-code warning, see known issues)
- Frontend tests: Vitest suite passes

---

## Features complete (desktop — `course-studio/`)

### Core — outline generation
- Import & Generate panel — drag-drop PDF, audio, video, doc files → one-click outline generation
- **AI-powered outline**: when API key is set, calls `generate_outline_direct` (Tauri → Rust → OpenAI-compatible API)
- **Fallback**: `generate_fake_outline` stub used when no API key is configured
- Outline editor — edit, save, export Markdown
- Course publish/unpublish workflow
- Background job pattern: Rust emits `job_progress` / `job_outline_ready` / `job_complete` / `job_failed` Tauri events

### Lesson content
- **AI-generated lesson content**: each lesson calls `generate_lesson_content` (Rust) → structured JSON (`intro`, `concepts`, `keyPoints`, `example`, `trivia`, `tip`)
- **Pre-fetch strategy**: first chapter's lessons fetched when course opens; next lesson pre-fetched while reading current
- **Template fallback**: `generateLessonContent()` in `contentGenerator.ts` produces instant content when no API key is set
- **Single-page lesson view**: breadcrumb + title + intro, 2×2 concept card grid, callouts (In practice / Did you know / Tip), key takeaways
- Shimmer skeleton shown while AI content loads

### Chapter quizzes
- **Mandatory**: students cannot advance past the last lesson of a chapter without passing the chapter quiz
- **Content-based questions** generated from actual AI lesson content
- **Quiz presentation mode**: fullscreen, keyboard-driven slideshow; mouse-idle auto-hides controls; curated per-subject images (top-anchored); equal-size option grid; no mid-word hyphenation

### Auth & roles
- Login screen with SubtleCrypto SHA-256 password hashing
- Three roles: **admin**, **editor**, **trainee**; session persistence via localStorage

### Admin / Trainee dashboards
- Admin: overview donut charts, course + user management, Model & API settings
- Trainee: catalog (search + difficulty filter), animated transitions, roadmap, My Learning

### UI / Design / Branding
- **courseneo** wordmark (`course` + accented `neo`); app icon is the `neo` mark
- Two themes (white/dark), CSS-variable-driven via `data-theme`; sidebar always dark
- SVG noise grain + gradient depth layers

## Stack
- **Desktop frontend**: React 18, TypeScript 5, Vite 5, Zustand 5, CSS Modules
- **Desktop backend**: Tauri 2, Rust stable (tokio, reqwest, serde)
- **Mobile (planned)**: Expo / React Native, TypeScript
- **Fonts**: Inter (UI), JetBrains Mono (code)
- **Model default**: OpenAI-compatible API at `https://api.openai.com`, model `gpt-4o-mini`

## Running locally
```bash
export PATH="/usr/local/opt/node/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"
source "$HOME/.cargo/env"
cd course-studio
npm run tauri dev            # launch app (default login: admin / admin)
npm test                     # frontend unit tests
cd src-tauri && cargo test   # Rust unit tests
```

---

## In progress / planned — Mobile companion (`course-mobile/`)
Pair a phone to the desktop over LAN via QR, push a source file, land a draft course on the desktop.
Spec: `docs/PAIRING-PROTOCOL.md` · Plan: `docs/plans/mobile-course-upload.md`

| Phase | Scope | State |
|---|---|---|
| 0 | `packages/shared` DTOs + path-alias wiring (desktop Vite + mobile sync) | ✅ shipped |
| 1 | Desktop local HTTP server (axum) + QR pairing panel (Admin → Devices) | ✅ shipped |
| 2 | Expo app scaffold + pairing (camera scan + handshake, on-demand PIN) | ✅ shipped |
| 3 | Upload (file + brief) → desktop auto-generates a draft course | ✅ shipped |
| 4 | TLS option, status polling, firewall UX, tests | 📋 planned |

**Verified:** desktop builds (Vite + Rust bin) and runs; mobile typechecks + Metro-bundles (1092 modules) for Expo Go. End-to-end on-device pairing pending a manual run.

## Known issues / watch-list
- 🐛 `src-tauri/src/utils/paths.rs::default_export_dir` is dead code (compiler warning) — remove or wire up.
- ⚠️ `bundle.targets: "all"` — release builds need platform toolchains; CI not configured.
- ⚠️ No automated tests for the Rust command layer; only the frontend vitest suite exists.

## Decisions log (most recent first)
- **2026-06-09** — Phone can now **browse published courses and remotely present one**: desktop pushes published courses to the server (`sync_pairing_courses`); `GET /v1/courses` lists them, `POST /v1/present {courseId}` emits `present_course` → desktop opens `QuizPresentationMode` for the course's first chapter. Mobile gained Courses + Course-detail screens.
- **2026-06-09** — Added optional **internet tunnel** mode: desktop spawns a `cloudflared` quick tunnel to the pairing port and embeds the `https://…trycloudflare.com` URL in the QR (`PairingPayload.url`); mobile uses it via `baseUrlFor()`. For test devices that can't reach the Mac on the LAN. Still terminates at the desktop — no courseneo cloud relay. Mobile app itself is loaded via Expo's own tunnel.
- **2026-06-09** — Product calls locked: **PIN on-demand** (admin toggle), phone uploads **file and/or brief**, **Expo Go** distribution, **one file** per upload, **auto-generate** on arrival.
- **2026-06-09** — Skipped root npm workspaces. Desktop consumes `packages/shared` via a Vite + tsconfig **path alias**; mobile **auto-syncs** the shared file into `course-mobile/src/_shared` (prestart hook) because this Metro/RN 0.85 build won't map sources outside the project root. `packages/shared` stays the single source of truth.
- **2026-06-09** — Desktop server uses **axum** on the existing tokio runtime; QR rendered server-side as SVG (`qrcode` crate). Mobile pinned to **Expo SDK 54** (RN 0.81, React 19.1) to match Expo Go on the test device; pruned unused SDK-56 template packages.
- **2026-06-09** — Mobile stack = **Expo (managed)** (camera/QR + document picker); shared DTOs in `packages/shared`.
- **2026-06-09** — Mobile companion is **LAN-only, no cloud relay**; QR carries `{host, port, token}`; pairing token single-use + short TTL, upgraded to a session for upload.
- **2026-06-09** — App renamed `neoCourses → courseneo`; icon set to the `neo` mark.

## Excluded (future work)
- File parsing backends (PDF text extraction, audio transcription, video processing)
- On-device / local model integration
- Server-side auth, cloud relay, or cross-network multi-device sync (mobile companion is LAN-only by design)

## How to update this file
Keep tables terse. When a phase/feature moves state, add a one-line note. Record any cross-cutting architectural choice in the decisions log with a date. Link specs/plans rather than duplicating them.
