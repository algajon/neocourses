# Implementation Plan — Course Editing & End-to-End Flow

**Goal:** let admins edit generated course **and** quiz content (titles, paragraphs, text/background colour, images, …), and define the best admin + trainee flow for an AI course-generation product with our mission. This doc assesses the current app, recommends evolve-vs-rewrite, designs the target flows, and lays out a phased build.

## 0. Mission & product principles
courseneo turns raw material (files, a brief, or a phone upload) into polished, on‑brand training courses via an (on‑prem) LLM, consumed as bite‑size slide lessons + mandatory quizzes, with admins curating quality and trainees tracking progress. The product wins on three axes — keep every decision serving them:
1. **Speed** — AI does the first 90%; humans curate the last 10%.
2. **Control & brand** — admins can fix, restyle, and brand anything before it ships.
3. **Privacy** — runs against an on‑prem model; no content leaves the network.

The editing feature is principle #2 made real.

## 1. Current state — what works, what's missing

**Solid foundation (keep):** Zustand stores + localStorage persistence; OpenAI‑compatible model abstraction with provider presets + on‑prem DGX/Qwen (tiers, thinking‑disable); background‑job generation; the **finalize‑at‑publish** step that now *persists* all lesson content (`SavedCourse.generated.lessons`) and quizzes (`useQuizStore`); the slide renderer (`LessonView`), quiz flow, presentation mode, and the mobile companion (pair / upload / present).

**Gaps blocking the mission:**
- **No content editing.** Only the outline markdown (`OutlineEditor` textarea) is editable. Generated lesson bodies, callouts, takeaways, and **all quiz questions** are take‑it‑or‑leave‑it. Admins can't fix AI errors, adjust tone, or brand.
- **No styling or images in lessons.** `LessonView` is a fixed layout with theme tokens; no per‑lesson colours, no lesson imagery (only the quiz *presentation* pulls stock photos).
- **Outline editing is raw markdown**, not structural (no add/reorder/rename UI).
- **Regeneration clobbers.** Re‑running AI would overwrite any human edit; there's no "edited vs generated" provenance.
- **No explicit review/curate stage** between generate and publish.

## 2. Recommendation: **evolve, do not rewrite**
A from‑scratch rebuild would throw away working infrastructure (model layer, finalize/persistence, stores, mobile, presentation) to rebuild the same plumbing. The single real gap is an **editable, styleable, persisted content model + an editor UI** — that's *additive*. The finalize feature already made generated content a persisted first‑class object; editing is the natural next layer on top of it.

> Verdict: incremental. ~5 focused phases, no rewrite. (A full block‑based CMS — §4 Option B — is a possible *later* evolution, not now.)

## 3. Target ADMIN flow
A clear five‑stage pipeline, each stage resumable:

1. **Create** — Import files (drag‑drop or phone push) · paste a brief · or start blank. → AI drafts the **outline**.
2. **Structure** — a real outline editor: add / reorder / rename / delete chapters & lessons (markdown stays the storage format under the hood).
3. **Generate** — one click runs the existing finalize pipeline *at the draft stage* (progress screen), producing full lesson + quiz content. The course is now a fully‑populated **draft**.
4. **Curate (the new core)** — a WYSIWYG **Course Editor** (see §4/§5): walk chapters→lessons, edit any text, restyle (text/bg/accent colour), add/replace images, edit quiz questions, and **regenerate a single lesson/quiz** without touching the rest.
5. **Publish** — validation (every lesson has content, every chapter a valid quiz) → live. Because content was generated in stage 3, publish is instant. Unpublish / re‑edit any time.

Cross‑cutting: **edited‑content provenance** (`source: 'ai' | 'edited'`) so a "Regenerate" never silently destroys human work — it warns first.

## 4. Target TRAINEE flow (mostly intact, sharpened)
Catalog (search/filter) → course detail → enroll → **roadmap** (progress, chapter gating) → **lesson slides** (now branded, with images) → **mandatory chapter quiz** (pass to advance) → completion. Trainees read the *curated* content, never raw AI. (Optional later: completion certificate, resume‑where‑left‑off surfacing.)

## 5. The editing feature — content model & editor

### 5.1 Content model (the key decision)
**Option A — structured + styleable (RECOMMENDED, build now).** Keep the existing `LessonContent` shape (intro, concepts[], keyPoints, example, trivia, tip) as the editable source of truth (already persisted in `generated.lessons`), and extend it:
```ts
type LessonStyle = { textColor?: string; bgColor?: string; accentColor?: string };
type LessonMedia = { heroImage?: string; conceptImages?: Record<number, string> };
type EditableLesson = LessonContent & {
  style?: LessonStyle;
  media?: LessonMedia;
  source: 'ai' | 'edited';   // provenance — guards regeneration
};
```
Quiz: the persisted `QuizQuestion[]` gains the same `source` flag; questions/options/correctIndex editable.
- **Pros:** every named requirement (titles, paragraphs, text colour, bg colour, images) is covered; reuses `LessonView`'s renderer for true WYSIWYG; small, fast, on‑brand by construction; no parsing/migration churn.
- **Cons:** not free‑form (can't add arbitrary blocks/sections). Acceptable — the slide format *is* the product's identity.

**Option B — block-based rich document.** Each lesson becomes an ordered array of typed blocks (heading/paragraph/image/callout/quote…) with per‑block styling. Maximum flexibility (Notion‑like).
- **Pros:** unlimited layout freedom.
- **Cons:** large rewrite of `LessonView` + the generator→content mapping + the renderer; slower; risks diluting the consistent slide identity. **Defer.**

→ Build **Option A**. Its `style`/`media`/`source` fields are forward‑compatible if we later graduate to B.

### 5.2 Editor UX (admin "Curate" stage)
A dedicated **Course Editor** view (admins/editors), reachable from a draft course:
- **Left rail:** chapter → lesson tree (+ "Quiz" node per chapter); reorder/rename here too.
- **Center:** the live lesson slide rendered exactly as trainees see it, but **inline‑editable** — click a title/paragraph/concept to edit text in place; an element toolbar for **text colour / background colour / accent**; an **image slot** on the hero and each concept card (paste URL now; upload/library later — phone‑push images can feed this).
- **Right/inspector:** per‑lesson style, reset‑to‑generated, and **"Regenerate this lesson with AI"** (re‑roll one piece; warns if `source === 'edited'`).
- **Quiz editor:** per chapter — edit question text + four options, set the correct answer, add/remove questions, regenerate the set.
- **Autosave** to the course draft on edit (debounced); a Save/Done returns to the pipeline.

Reuse: `LessonView` becomes render‑only vs. editable via an `editable` prop (or a thin `LessonSlideEditor` wrapping the same markup) so trainee + editor views never diverge.

### 5.3 Persistence
- `SavedCourse.generated.lessons: Record<title, EditableLesson>` is the single source of truth (already persisted). Editor writes here via `useCourseStore.updateCourse`.
- Quizzes stay in `useQuizStore` (already persisted + hydrated); add the editable fields + `source`.
- A schema bump + migration: old `LessonContent` → `EditableLesson` with `source:'ai'`, empty style/media.

## 6. Phased implementation

| Phase | Scope | Key files |
|---|---|---|
| **1 — Editable model** | Extend `LessonContent`→`EditableLesson` (style/media/source); migrate; make `generated.lessons` the read source everywhere; quiz `source` flag. | `lib/types.ts`, `lib/contentGenerator.ts`, `lib/migrations.ts`, `useCourseStore`, `useQuizStore` |
| **2 — Lesson editor** | `CourseEditor` view + left rail; make `LessonView` editable (inline text, colour pickers, image slots); autosave. | `views/CourseEditor/*`, `components/LessonView/*`, `App.tsx` (route) |
| **3 — Quiz editor** | Edit questions/options/correct; add/remove; per‑chapter. | `components/QuizEditor/*`, `useQuizStore` |
| **4 — Regenerate‑one + provenance** | Single lesson/quiz AI re‑roll; `source` guard + warnings; "reset to AI". | `modelClient`, editor views |
| **5 — Flow polish** | Move Generate to draft stage; structural outline editor; publish validation; live preview parity. | `EditorDashboard`, `OutlineEditor`→structural, finalize wiring |
| **6 — (optional) Media & extras** | Image upload/library (incl. phone‑pushed images), completion certificate, resume surfacing. | mobile upload reuse, new components |

Phases 1–3 deliver the requested editing; 4–5 make it safe and smooth; 6 is upside.

## 7. Risks & decisions to confirm
- **Styling scope:** per‑element colour (heavier UI) vs per‑lesson theme (simpler, more on‑brand). Recommend **per‑lesson theme + per‑element text colour**, not arbitrary everything, to preserve brand consistency. *(confirm)*
- **Images:** URL paste first (works today, incl. phone‑pushed URLs) vs built‑in upload/library (Phase 6). Recommend URL first. *(confirm)*
- **Regeneration vs edits:** warn‑before‑overwrite (recommended) vs branch/version. Versioning is heavier — defer. *(confirm)*
- **localStorage size:** baked content + images push storage; large image **data URLs** would blow the ~5–10MB budget — store image **URLs/refs**, not bytes. *(constraint)*
- **Block editor (Option B):** explicitly out of scope now; revisit only if structured editing proves too limiting.

## 8. Suggested starting point
Phase 1 + 2 together are the smallest slice that lets an admin actually edit a lesson end‑to‑end (model + editor + autosave). Recommend building those first, demoing, then 3–5.
