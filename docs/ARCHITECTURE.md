# courseneo — Architecture

This document describes how the system fits together end to end: the desktop app today, and the mobile companion + pairing layer being added. For the wire-level pairing/upload spec see `PAIRING-PROTOCOL.md`. For the build-out sequence see `plans/mobile-course-upload.md`.

## 1. System overview

```
┌────────────────────────────┐         LAN (no cloud)          ┌───────────────────────────┐
│  courseneo DESKTOP          │  ◀───── QR: {host,port,token} ──│  courseneo MOBILE (Expo)   │
│  Tauri 2 + React + Rust     │                                 │  React Native + TS         │
│                             │  ──── POST /v1/pair  (token) ──▶ │   • scan QR (expo-camera)  │
│  ┌───────────────────────┐  │  ◀─── { session, expiresAt } ── │   • pick file (doc-picker) │
│  │ React UI (Zustand)    │  │                                 │   • upload                 │
│  │  • Pairing panel + QR │  │  ──── POST /v1/courses ───────▶ │                            │
│  │  • Import→Generate     │  │        (multipart + Bearer)     └───────────────────────────┘
│  └──────────┬────────────┘  │
│             │ invoke/events  │
│  ┌──────────▼────────────┐  │
│  │ Rust (Tauri commands) │  │
│  │  • model HTTP calls   │  │
│  │  • local HTTP server  │──┼──▶ binds 0.0.0.0:<ephemeral>, LAN-only, session-gated
│  └───────────────────────┘  │
└────────────────────────────┘
```

The **desktop is the source of truth**. The mobile app is a thin remote that hands a file to the desktop; all generation, storage, and publishing happen on the desktop exactly as they do for a drag-drop import.

## 2. Desktop app (shipped)

- **Frontend** — React 18 + TypeScript, Zustand stores persisted to `localStorage`, CSS Modules with a two-theme token system. No cloud backend.
- **Backend** — Rust via Tauri 2. Tauri commands live in `src-tauri/src/commands/` and are the only place that talks to external HTTP (OpenAI-compatible APIs through `model.rs::call_model`). Long work runs as a `tokio::task` that emits `job_*` events.
- **Boundary rule** — React never calls `invoke()` directly; everything goes through `src/lib/modelClient.ts`. Rust handlers return `Result<T, AppError>`.

See `../CLAUDE.md` for the full flow descriptions (import→generate, lesson content, quiz).

## 3. Mobile companion (in progress)

- **Runtime** — Expo (managed workflow), React Native, TypeScript.
- **Why Expo** — first-class access to the camera (QR scan), document/image pickers, and file system without writing native modules; fast iteration via Expo Go / dev builds.
- **Responsibilities** — pair to a desktop, let the admin choose a source file (or type a brief), upload it, and report success/failure. It holds no course data and renders no courses.
- **Screens** — `Pair` (scan QR + handshake), `Upload` (pick + send + progress), `Status/Paired` (connection state, recent uploads).

## 4. Pairing & transfer layer (in progress)

- **Transport** — an ephemeral HTTP server started by the desktop (Rust) and bound to the machine's LAN IPv4 on an OS-assigned port. It exists only while the pairing panel is active.
- **Discovery** — none required: the QR code carries `host`, `port`, and a one-time `token`, so the phone connects directly. (mDNS/Bonjour is a possible later enhancement, not a dependency.)
- **Trust** — the `token` is single-use and short-lived; exchanging it yields a short-lived bearer `session` used to authorize the upload. Optionally a desktop-displayed PIN must be confirmed. Everything stays on the LAN — there is no relay server.
- **Hand-off** — on receiving a file the server writes it to a temp path and emits a Tauri event (`course_upload_received`) with metadata; the desktop UI then runs the existing Import → Generate pipeline to produce a draft `SavedCourse`.

Full message formats, status codes, lifetimes, and threat model: `PAIRING-PROTOCOL.md`.

## 5. Shared types (`packages/shared`, planned)

Cross-app contracts (the QR payload, the pair request/response, the upload metadata, and the minimal course DTO) live in one TypeScript package imported by both `course-studio` and `course-mobile`. This keeps the wire format from drifting between the two codebases. Rust mirrors these shapes with `serde` structs; the protocol doc is the single source of truth they must both satisfy.

## 6. Boundaries & invariants

- **No cloud.** All data is local; the mobile feature is LAN-only by design. Anything requiring an internet round-trip (AI generation) is a desktop concern, unchanged by the mobile feature.
- **Desktop owns generation.** The phone never calls the model API and never sees an API key.
- **One source of truth per concern.** UI strings → `lib/strings.ts`; desktop types → `lib/types.ts`; cross-app types → `packages/shared`; protocol → `docs/PAIRING-PROTOCOL.md`.
- **Local server is opt-in and ephemeral.** It is never listening unless an admin has the pairing panel open, and it dies when pairing closes.
