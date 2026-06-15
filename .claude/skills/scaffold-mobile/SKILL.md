---
name: scaffold-mobile
description: Stand up the courseneo mobile companion app (course-mobile/, Expo + TypeScript) — dependencies, navigation, the Pair/Upload/Status screens, the upload client, and shared protocol types. Use when the course-mobile/ app does not yet exist or needs its skeleton created. Triggers - "scaffold the mobile app", "set up course-mobile", "create the React Native companion".
---

# Scaffold the courseneo mobile companion

Create the initial `course-mobile/` Expo app and the `packages/shared/` contract package, wired to the pairing protocol. This produces a runnable skeleton — not the finished feature. Defer real behavior to the `@mobile-rn` and `@pairing-sync` agents and `docs/plans/mobile-course-upload.md`.

## Before you start
- Read `docs/PAIRING-PROTOCOL.md` (wire format) and `docs/ARCHITECTURE.md` §3–§5 (mobile + shared types).
- Read `STATUS.md` to confirm which phase this is and update it when done.
- Ensure Node is on PATH: `export PATH="/usr/local/opt/node/bin:/usr/local/bin:$PATH"`.
- Confirm with the user before introducing root **npm workspaces** if `course-studio/` is currently standalone — this touches the desktop's resolution and is the riskiest step (see plan Phase 0). If they decline, fall back to a standalone `course-mobile/` that vendors the shared types.

## Steps
1. **Shared contracts** (`packages/shared/`): a tiny TS package exporting the protocol types — `PairingPayload`, `PairRequest`, `PairResponse`, `UploadMetadata`, `CourseDraftDTO`, and the endpoint/status enums. These MUST match `docs/PAIRING-PROTOCOL.md` field-for-field. No runtime code, just types (plus optional `const` for the protocol version `v`).
2. **Expo app** (`course-mobile/`): create with the Expo TypeScript template. Add `expo-camera`, `expo-document-picker`, `expo-file-system` (and a router — `expo-router` preferred). Set app name/slug to courseneo branding and the `neo` accent.
3. **Screens** (stubs, navigable): `Pair` (camera + QR placeholder), `Upload` (file/brief pickers + send button + progress placeholder), `Status` (connection + recent uploads). Wire them into navigation.
4. **Upload client** (`course-mobile/src/lib/pairingClient.ts`): a typed module with `ping`, `pair`, `uploadCourse` functions hitting the protocol endpoints, importing types from `packages/shared`. Stub the bodies if needed but keep signatures protocol-accurate. No inline `fetch` elsewhere.
5. **Theme**: a small tokens module mirroring the desktop dark surfaces + `#e5ff00` accent so screens are on-brand.
6. **Verify**: `cd course-mobile && npm run start` boots Metro without errors; `tsc --noEmit` passes for both new packages.

## Done criteria
- `course-mobile/` boots in Expo; all three screens reachable.
- `packages/shared/` types compile and are imported by the mobile client.
- No protocol drift: every field/endpoint used matches `docs/PAIRING-PROTOCOL.md`.
- `STATUS.md` Phase 0/2 rows and the decisions log updated; report what was created and any dependency/config-plugin added.

## Guardrails
- Managed Expo workflow only — do not eject.
- The phone is a thin remote: no course/lesson/quiz UI.
- Do not implement the desktop server here — that is `@pairing-sync` (plan Phase 1).
