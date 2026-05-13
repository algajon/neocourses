# neoCourses — Project Status

## Build status
- Frontend: `npm run build` — clean (0 TS errors)
- Rust: `cargo check` — clean, all unit tests pass
- Frontend tests: Vitest suite passes

## Features complete

### Core — outline generation
- Import & Generate panel — drag-drop PDF, audio, video, doc files → one-click outline generation
- **AI-powered outline**: when API key is set, calls `generate_outline_direct` (Tauri → Rust → OpenAI-compatible API)
- **Fallback**: `generate_fake_outline` stub used when no API key is configured
- Outline editor — edit, save, export Markdown
- Course publish/unpublish workflow
- Background job pattern: Rust emits `job_progress` / `job_outline_ready` / `job_complete` / `job_failed` Tauri events

### Lesson content
- **AI-generated lesson content**: each lesson calls `generate_lesson_content` (Rust) to produce structured JSON (`intro`, `concepts`, `keyPoints`, `example`, `tip`)
- **Pre-fetch strategy**: first chapter's lessons fetched when course opens; next lesson pre-fetched while reading current — eliminates visible loading latency
- **Template fallback**: `generateLessonContent()` in `contentGenerator.ts` produces instant content when no API key is set
- **PowerPoint-style lesson view**: non-scrolling single-page layout — breadcrumb + title + intro, 2×2 concept card grid, key takeaways, tip bar
- Shimmer skeleton shown while AI content loads

### Chapter quizzes
- **Mandatory**: students cannot advance past the last lesson of a chapter without passing the chapter quiz
- **Content-based questions**: quiz generated from actual AI lesson content (concept bodies, keyPoints, tips, examples) — not structural meta-questions
- Five question types: concept body → title, concept title → body, key takeaway recall, practical tip recall, example recall
- After passing: "Start next chapter" navigates to the first lesson of the next chapter

### Auth & roles
- Login screen with SubtleCrypto SHA-256 password hashing
- Three roles: **admin**, **editor**, **trainee**
- Session persistence via localStorage

### Admin dashboard
- Overview stats with SVG donut ring charts (users, courses, enrollments)
- Full course management (publish/unpublish, delete)
- User management (create, change role, delete)
- Model & API settings (OpenAI API key, base URL, model name)

### Trainee dashboard
- Course catalog with search + difficulty filter
- Animated screen transitions (slide left/right)
- Course Roadmap — collapsible chapters, lesson checkboxes, progress tracking
- My Learning view with per-course stats

### UI / Design
- neoCourses brand — indigo/violet gradient identity
- Two themes: White (light) and Dark
- SVG noise grain texture overlay
- Gradient orb depth layers
- Fully CSS-variable-driven theming via `data-theme` attribute

## Stack
- **Frontend**: React 18, TypeScript 5, Vite 5, Zustand 5, CSS Modules
- **Backend**: Tauri 2, Rust stable
- **Fonts**: Inter (UI), JetBrains Mono (code)
- **Model default**: OpenAI-compatible API at `https://api.openai.com`, model `gpt-4o-mini`

## Running locally
```bash
export PATH="/usr/local/opt/node/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"
source "$HOME/.cargo/env"
cd course-studio
npm run tauri dev       # launch app (default login: admin / admin)
npm test                # frontend unit tests
cd src-tauri && cargo test   # Rust unit tests
```

## Excluded (future work)
- File parsing backends (PDF text extraction, audio transcription, video processing)
- DGX Spark / on-device model integration
- Server-side auth / multi-device sync
