# Implementation Plan — Mobile course upload via QR pairing

**Feature:** An admin opens a pairing panel in courseneo (desktop), scans a QR code with the courseneo phone app, picks a source file (or types a brief) on the phone, and it uploads over the local network and lands on the desktop as a draft course — ready to generate, review, and publish.

**Specs:** wire format → `../PAIRING-PROTOCOL.md` · system view → `../ARCHITECTURE.md` · status → `../../STATUS.md`
**Owning agents:** `@pairing-sync` (desktop server + protocol), `@mobile-rn` (Expo app), with `@rust-tauri`, `@react-frontend`, `@state-stores` as needed.

---

## 1. Goal & non-goals

**Goal:** the shortest trustworthy path from "file on my phone" to "draft course on the desktop", reusing the existing Import → Generate pipeline unchanged.

**Non-goals (v1):**
- No cloud relay, no internet round-trip for the transfer, no cross-network pairing.
- No course/lesson/quiz UI on the phone — it is a thin remote.
- No multi-device fleet; one active paired device per session.
- No on-device parsing/generation; the desktop owns all generation and storage.

## 2. Success criteria
- Admin pairs a phone in < 15 s from opening the panel.
- A picked file uploads on the LAN and appears as a desktop **draft** course within the normal generation time.
- Every failure path (expired token, wrong PIN, bad session, oversized/unsupported file, panel closed) shows a clear message and never crashes either app.
- The pairing server is **never** listening unless the panel is open; closing it clears all secrets.
- No protocol drift: Rust structs, `packages/shared` types, and `PAIRING-PROTOCOL.md` agree.

## 3. Architecture decisions (locked for v1)
- **Transport:** desktop-hosted ephemeral HTTP server (Rust, axum on the existing tokio runtime), bound `0.0.0.0:<ephemeral>`, LAN IPv4 in the QR. No mDNS dependency.
- **Trust:** single-use pairing token (TTL 120 s) → short-lived bearer session (10 min sliding); optional desktop PIN. Plaintext HTTP on a trusted LAN for v1; pinned self-signed TLS deferred to Phase 4.
- **Mobile stack:** Expo managed workflow + TypeScript; `expo-camera`, `expo-document-picker`, `expo-file-system`; `expo-router`.
- **Contracts:** shared TS types in `packages/shared`, mirrored by Rust `serde` structs, governed by the protocol doc.
- **Reuse:** on upload, hand off to the existing Import → Generate flow; do not fork a second generation path.

## 4. Phases

### Phase 0 — Monorepo & shared contracts (foundation)
**Why first:** both apps must import one set of protocol types; doing this late causes drift.
- Introduce root **npm workspaces**: `["course-studio", "course-mobile", "packages/*"]`. ⚠️ Highest-risk step — it changes the desktop's dependency resolution. De-risk by verifying `course-studio` still builds/tests green immediately after, and keep a fallback (standalone `course-mobile/` vendoring the types) if workspaces fight the Tauri/Vite setup.
- Create `packages/shared/`: `PairingPayload`, `PairRequest/Response`, `UploadMetadata`, `CourseDraftDTO`, status/endpoint enums, protocol version `v`. Types only.
- **Files:** root `package.json` (new/updated), `packages/shared/{package.json,tsconfig.json,src/index.ts}`.
- **Done:** `course-studio` build + vitest still pass; `packages/shared` compiles; types match the protocol doc.

### Phase 1 — Desktop server + QR pairing UI
**Owner:** `@pairing-sync` (+ `@react-frontend`, `@css-design`).
- Rust: new `src-tauri/src/commands/pairing.rs` + an axum server task. Commands: `start_pairing()` (mint token/PIN, bind, return `{host, port, token, pin?}`), `stop_pairing()`. Resolve LAN IPv4 (`local-ip-address` or `if-addrs`). In-memory token/session store with TTLs; teardown clears it.
- Endpoints: `GET /v1/ping`, `POST /v1/pair`. (`/v1/courses` lands in Phase 3.)
- Events: emit `device_paired`, `pairing_expired`, `pairing_closed`. Register commands in `lib.rs`; add any capability in `capabilities/default.json`. New `AppError` variants (`PairingFailed`, …).
- React: a **Pairing panel** in the admin area — calls `start_pairing` via a new `modelClient.ts` wrapper, renders the QR (a JS QR lib, e.g. `qrcode`), shows the PIN, and a live "waiting → connected" state driven by events. Closing the panel calls `stop_pairing`.
- **Done:** `curl /v1/ping` returns identity from another LAN device; a manual `POST /v1/pair` with the QR token yields a session; panel close stops the listener (verify port closed).

### Phase 2 — Mobile scaffold + pairing
**Owner:** `@mobile-rn` (use the `scaffold-mobile` skill).
- Scaffold `course-mobile/` (if Phase 0 didn't): Expo TS app, router, branded theme, three screens, `src/lib/pairingClient.ts` importing `packages/shared`.
- Implement **Pair** screen: camera QR scan → parse + validate `PairingPayload.v` → `ping` → `pair` (with PIN entry when required) → store session in memory → navigate to Upload. Handle invalid/expired token, wrong PIN, unreachable host.
- **Done:** scanning a real desktop QR pairs successfully; desktop fires `device_paired`; bad inputs show clear errors.

### Phase 3 — Upload → draft course (the payoff)
**Owners:** `@pairing-sync` (server) + `@mobile-rn` (client) + `@react-frontend`/`@state-stores` (desktop intake).
- Rust: `POST /v1/courses` (multipart, Bearer session): validate session, enforce size (`413`) + type allowlist mirroring `ImportPanel` (`415`), write the file to a temp dir, return `202 {courseId, status:"received"}`, emit `course_upload_received {courseId, title, brief?, filePath?, fileName?, mime?}`.
- Mobile: **Upload** screen — `expo-document-picker`/`image-picker` to choose a file, optional title/brief, client-side size/type pre-check, `uploadCourse()` with progress, success/failure UI. **Status** screen shows recent uploads.
- Desktop intake: a listener (in the pairing panel / `EditorDashboard`) reacts to `course_upload_received` by running the existing Import → Generate flow to create a **draft** `SavedCourse`, and shows a toast ("New course from <device>"). Reuse `handleImportGenerate` logic rather than duplicating it.
- **Done:** end-to-end — pick file on phone → draft course appears on desktop and opens in the outline editor like any import.

### Phase 4 — Hardening, polish, tests
- Failure-path matrix from `PAIRING-PROTOCOL.md` §3/§7 fully handled on both ends.
- Optional: pinned self-signed TLS (add `fp` to the QR payload, bump `v`); optional `GET /v1/courses/:id` status polling for nicer mobile feedback.
- Firewall guidance UX (macOS/Windows first-bind prompt). "Use only on a trusted network" notice in the pairing panel.
- Tests: Rust unit tests for token/session lifetimes + endpoint validation; a vitest contract test asserting `packages/shared` matches the documented shapes; manual run via the `pair-device` skill.
- Update `STATUS.md` rows + decisions log.

## 5. Risk register
| Risk | Likelihood | Mitigation |
|---|---|---|
| npm workspaces break the Tauri/Vite build | Med | Verify desktop green right after Phase 0; fallback to standalone mobile + vendored types |
| LAN IP resolution picks the wrong interface (VPN, multiple NICs) | Med | Let the user pick/confirm the IP in the panel; show all candidates |
| macOS/Windows firewall blocks the bind | High (first run) | Expect the prompt; in-app guidance; document it |
| Plaintext HTTP sniffing on shared Wi-Fi | Low–Med | Short-lived single-use token + PIN now; pinned TLS in Phase 4; "trusted network" notice |
| Large media upload times out / OOM | Med | Stream multipart to disk (don't buffer whole file); enforce size cap; show progress |
| Protocol drift between apps | Med | Single source of truth (`packages/shared` + protocol doc); contract test; agents enforce co-editing |

## 6. Open questions — RESOLVED 2026-06-09
1. **PIN** — on demand (admin toggle in the pairing panel); off by default.
2. **Inputs from phone** — file **and/or** brief; at least one required.
3. **Distribution** — Expo Go (internal).
4. **Files per upload** — exactly one in v1.
5. **On arrival** — auto-generate immediately into a draft course.

### Implementation note (deviation from §3)
Root npm **workspaces were skipped**. The desktop imports `packages/shared` through a Vite + tsconfig path alias; the mobile app auto-syncs the shared file into `course-mobile/src/_shared` via a `prestart` hook, because this Expo SDK 56 / RN 0.85 Metro build does not reliably map sources outside the project root (SHA-1 file-map failures). `packages/shared` remains the single source of truth.

## 7. Rough sequencing
Phase 0 → 1 and 2 can proceed in parallel once contracts exist → 3 integrates them → 4 hardens. Phases 1 and 2 are the natural parallel split between `@pairing-sync` and `@mobile-rn`.
