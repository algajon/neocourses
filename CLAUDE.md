# neoCourses — Claude Code Guide

## What this is
neoCourses is a desktop app built with **Tauri 2 + React 18 + TypeScript 5 + Rust (stable)**. It lets editors import PDFs, audio, video, and documents, then automatically generates structured course outlines. Trainees enroll and track progress through a visual chapter roadmap, viewing AI-generated lesson content and taking mandatory chapter quizzes. Admins manage users and courses.

## Running the app

```bash
# All commands must be run from course-studio/
cd course-studio

# Dev server (hot reload + Rust rebuild on file change)
export PATH="/usr/local/opt/node/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"
npm run tauri dev

# TypeScript build only (fast check)
npm run build

# Tests
npm test
```

Node must be sourced from `/usr/local/opt/node/bin` — the system PATH may not include it.

## Repo layout

```
coursestudio/
  course-studio/          ← all frontend + Tauri config
    src/
      components/         ← shared UI components
        AppSidebar/       ← navigation + theme switcher
        ImportPanel/      ← drag-drop file importer
        CourseRoadmap/    ← visual chapter/lesson progress tree
        CourseBriefForm/  ← manual course brief form
        OutlineEditor/    ← textarea for editing generated outlines
        SavedCourseList/  ← sidebar list of saved courses
        JobProgressBar/   ← streaming generation progress
        ModelSettingsPanel/ ← API key / model URL modal
        LessonView/       ← PowerPoint-style single-page lesson display
      views/
        LoginScreen/      ← full-page auth, neoCourses branded
        EditorDashboard/  ← Import panel + Manual builder (editors + admins)
        StudentDashboard/ ← Catalog, My Learning, Course roadmap, Lesson, Quiz (trainees)
        AdminDashboard/   ← Overview stats, Courses, Users (admins only)
      store/
        useAuthStore.ts   ← users, sessions, SubtleCrypto password hashing
        useCourseStore.ts ← CRUD for SavedCourse, active course
        useEnrollmentStore.ts ← per-user enrollment, lesson completion, quiz passes
        useJobStore.ts    ← background generation job state
        useSettingsStore.ts ← model URL, API key, model name
      lib/
        types.ts          ← all TypeScript types (User, SavedCourse, LessonContent, etc.)
        auth.ts           ← SHA-256 hashing with salt via SubtleCrypto
        storage.ts        ← localStorage read/write for all stores
        migrations.ts     ← schema version upgrades for persisted data
        strings.ts        ← all UI labels (update APP_NAME etc. here)
        modelClient.ts    ← Tauri invoke wrappers + generateLessonContentAI + parseLessonContentJson
        contentGenerator.ts ← LessonContent type, template fallback, cleanForProse, generateChapterQuiz
      styles/
        variables.css     ← design tokens: 2 themes (white/dark), sidebar vars, noise texture
        typography.css    ← base font rules
        reset.css         ← box-sizing + margin reset
    src-tauri/
      src/commands/       ← Rust Tauri commands
        outline.rs        ← generate_fake_outline, generate_outline_direct, generate_lesson_content
        model.rs          ← call_model, test_model_endpoint
        jobs.rs           ← generate_outline_with_model (background job)
        export.rs         ← export_markdown (saves .md file via dialog)
      capabilities/default.json ← Tauri permissions (fs, http, dialog)
      Cargo.toml
      tauri.conf.json
```

## Architecture

### State
All state lives in Zustand stores and is persisted to `localStorage`. No server. Stores load on app mount via `loadFromStorage()` called in `App.tsx`.

### Auth
Passwords hashed with SubtleCrypto (SHA-256, 16-byte random salt, two rounds). Default admin: `admin` / `admin` seeded on first launch.

### Roles
- `admin` — sees Import & Generate, Course Builder, Admin Panel
- `editor` — sees Import & Generate, Course Builder
- `trainee` — sees Course Catalog, My Learning

### Themes
Two themes: `white` and `dark`. Applied via `data-theme` attribute on `<html>`. All components use CSS custom properties from `variables.css` — never hardcode colors. Sidebar is always dark regardless of theme via separate `--sidebar-*` variables.

### Import → Generate flow
1. User drops files onto `ImportPanel`
2. Clicks "Generate Course from Files"
3. `EditorDashboard.handleImportGenerate()` extracts topic from filenames
4. If API key is set: calls `generate_outline_direct` (Tauri → Rust → OpenAI API) via background job with progress bar
5. If no API key: calls `generate_fake_outline` (Rust stub, instant)
6. Pending outline displayed → user clicks "Save course" → saved as draft
7. Draft can then be published so trainees see it in catalog

### Lesson content flow
1. Trainee opens a course → `StudentDashboard` pre-fetches all lessons in the first chapter
2. As trainee reads a lesson, the next lesson is pre-fetched in the background
3. If API key is set: `generateLessonContentAI()` (in `modelClient.ts`) invokes `generate_lesson_content` (Rust → OpenAI API), returns structured `LessonContent` JSON
4. If no API key: `generateLessonContent()` (in `contentGenerator.ts`) returns template-based content instantly
5. `LessonView` renders content as a non-scrolling PowerPoint-style slide: intro, 2×2 concept card grid, key takeaways, tip bar
6. `fetchingRef: useRef<Set<string>>` prevents duplicate concurrent fetches; `lessonContents: Map<string, LessonContent>` caches results for the session

### Mandatory quiz flow
1. Last lesson in each chapter shows "Complete chapter and take quiz" instead of "Next lesson"
2. After completing the last lesson, `ChapterQuizScreen` is shown
3. Quiz questions are generated by `generateChapterQuiz()` using the cached AI lesson content for that chapter
4. On passing: "Start next chapter" navigates to the first lesson of the next chapter
5. On failing: student can retry
6. `passedQuizzes: Set<string>` (keyed by module name) in `useEnrollmentStore` gates progression

### Course outline format (Markdown)
```
## Module Name
### Lesson Title
### Another Lesson
## Second Module
### Lesson Here
```
`## ` headings = chapters, `### ` headings = lessons. `parseModules()` in `StudentDashboard` parses this.

### Background job pattern
Rust spawns a `tokio::task`, emits `job_progress` / `job_outline_ready` / `job_complete` / `job_failed` Tauri events. Frontend subscribes via `useJobProgress` hook (registered in `App.tsx`) and `listen()` in `EditorDashboard`.

## Key conventions

- **CSS**: Always use CSS Modules + `var(--token-name)`. Never inline colors. File: `ComponentName.module.css` co-located with the component.
- **Components**: Functional, no class components. Named exports only.
- **No comments** unless the WHY is non-obvious (hidden constraint, workaround).
- **Errors**: Use `AppError` type from `lib/types.ts` and `makeError()` / `fromUnknown()` from `lib/errors.ts`.
- **Strings**: All user-facing UI strings live in `lib/strings.ts` as `UI.CONSTANT_NAME`.
- **Types**: All shared types in `lib/types.ts`. Don't scatter type definitions.
- **Tauri commands**: Wrapped in `lib/modelClient.ts`. Components never call `invoke()` directly.
- **AI trigger**: presence of a non-empty `settings.apiKey` switches from template fallback to live AI calls — no separate feature flag.
- **Model default**: `https://api.openai.com`, model `gpt-4o-mini`. Configurable in Admin → Model & API settings.

## Available skills (slash commands)

- `/new-component` — scaffold a component + CSS module
- `/new-view` — scaffold a view + CSS module + wire into App.tsx
- `/run-tests` — run the vitest suite and summarise failures
- `/add-import-type` — add a new file type to ImportPanel
- `/add-theme-var` — add a new CSS variable to both themes in variables.css
- `/gen-outline` — generate a course outline without opening the UI

## Available agents

- `@rust-tauri` — Rust/Tauri backend (commands, AppError, Cargo, Tauri config)
- `@react-frontend` — React components, views, TypeScript types
- `@css-design` — design tokens, themes, CSS Modules, layout patterns
- `@state-stores` — Zustand stores, localStorage, auth, enrollment, migrations
- `@ai-content` — AI content generation, quiz logic, prompts, pre-fetch strategy
