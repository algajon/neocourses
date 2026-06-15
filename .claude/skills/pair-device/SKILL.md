---
name: pair-device
description: Drive and test the courseneo desktop↔mobile QR pairing and course-upload handshake locally, end to end. Use to exercise or debug the pairing flow, verify the protocol, or reproduce a pairing/upload bug. Triggers - "test pairing", "debug the QR handshake", "check the upload flow", "pair my phone".
---

# Test the pairing & upload flow end to end

Exercise the full path: desktop starts its server and shows a QR → mobile scans and pairs → mobile uploads a file → a draft course appears on the desktop. Use this to validate the protocol or isolate where a failure occurs.

## Preconditions
- Desktop and phone on the **same LAN/Wi-Fi**.
- Desktop pairing server + mobile client implemented (plan Phases 1–3). If not yet built, this skill becomes a *protocol conformance check* against `docs/PAIRING-PROTOCOL.md` instead of a live run — say so.
- `docs/PAIRING-PROTOCOL.md` open as the reference for expected requests/responses.

## A. Live end-to-end run
1. Start the desktop: `cd course-studio && export PATH="/usr/local/opt/node/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH" && npm run tauri dev`. Log in as **admin**.
2. Open the pairing panel. Confirm the server bound to a LAN IP + ephemeral port and a QR rendered. Note the firewall prompt on first bind (allow it).
3. Sanity-check reachability from another device/terminal on the LAN: `curl http://<host>:<port>/v1/ping` → expect `{ "app": "courseneo", "v": 1, ... }`.
4. Start the mobile app (`pair-device` ↔ use the `/mobile-dev` command) and scan the QR. Enter the PIN if shown. Expect a successful `POST /v1/pair` and the desktop to fire `device_paired`.
5. On mobile, pick a small test file (or type a brief) and upload. Expect `202 { courseId, status: "received" }` and the desktop to fire `course_upload_received`, then run Import → Generate and show a new **draft** course.

## B. Failure-path checks (verify each is handled, not crashed)
- Expired pairing token (wait > TTL, then scan) → `401 invalid_token`, mobile prompts to re-scan.
- Wrong PIN → `401 invalid_pin`.
- Upload without a session / expired session → `401 invalid_session`.
- Oversized file → `413 file_too_large`; unsupported type → `415 unsupported_type`.
- Close the pairing panel mid-flow → server stops, sessions cleared, mobile shows "disconnected".

## C. Manual protocol probe (no UI)
Use `curl` to confirm the wire contract independent of the apps:
```
curl -s http://<host>:<port>/v1/ping
curl -s -X POST http://<host>:<port>/v1/pair -H 'content-type: application/json' -d '{"token":"<from-QR>","device":"curl"}'
curl -s -X POST http://<host>:<port>/v1/courses -H 'authorization: Bearer <session>' -F title='Test' -F file=@/path/to/sample.pdf
```
Compare every status code and field against `docs/PAIRING-PROTOCOL.md`.

## Reporting
State which step failed (if any) and the exact response vs. the spec. If you find drift between the running code and `docs/PAIRING-PROTOCOL.md` / `packages/shared`, call it out — the doc is the source of truth and code must conform. Never weaken the security properties (token single-use, TTLs, LAN-only, ephemeral server) to make a test pass.
