# neoCourses — Course Studio

Turn company knowledge into structured training courses.

## Stack

- **Shell:** Tauri 2.x
- **Frontend:** React 18 + Vite 5 + TypeScript 5
- **Backend:** Rust (stable)
- **State:** Zustand 5 (persisted to localStorage)
- **Styling:** CSS Modules + CSS custom properties

## Prerequisites

- Rust (stable): `rustup update stable`
- Node.js 20+
- Tauri CLI v2: `cargo install tauri-cli --version "^2"`

## Development

```bash
# Run from course-studio/
export PATH="/usr/local/opt/node/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"
npm install
npm run tauri dev                              # Vite + Tauri dev mode
npm run build                                  # TypeScript check only
npm test                                       # Vitest
cargo test --manifest-path src-tauri/Cargo.toml
```

Default login: **admin / admin**

## AI features

Set an OpenAI-compatible API key in Settings (Admin panel → Model & API) to enable:
- AI-generated course outlines (`generate_outline_direct`)
- AI-generated lesson content (`generate_lesson_content`) — pre-fetched per lesson
- Content-based chapter quizzes drawn from real lesson material

Without an API key the app falls back to template-based outlines and lesson content (instant, no network).

## Build Versions

| Version | Feature |
|---------|---------|
| 0.1 | Fake outline generator |
| 0.2 | Local saving (localStorage) |
| 0.3 | Editable outline + unsaved-changes tracking |
| 0.4 | Markdown export to disk |
| 0.5 | Model endpoint test (OpenAI-compatible) |
| 0.6 | AI outline generation with background job + progress bar |
| 0.7 | AI lesson content generation (per-lesson, OpenAI API) |
| 0.8 | Mandatory chapter quizzes with content-based questions |
| 0.9 | PowerPoint-style lesson view + pre-fetch strategy |
