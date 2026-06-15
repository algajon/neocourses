# courseneo — Pairing & Upload Protocol (v1)

LAN-only protocol for pairing a phone (`course-mobile`) to a desktop (`course-studio`) and uploading a source file that becomes a draft course. **No cloud relay.** This document is the single source of truth that the TypeScript types in `packages/shared` and the Rust `serde` structs must both satisfy.

## 0. Roles & assumptions
- **Server** = desktop. Runs an ephemeral HTTP server, only while an admin has the pairing panel open.
- **Client** = mobile app, operated by an admin on the same Wi-Fi/LAN.
- Same L2/L3 network; client can reach `http://<host>:<port>`. No NAT traversal, no internet dependency for the transfer itself.

## 1. Lifecycle

```
desktop: open Pairing panel
  → start server, bind 0.0.0.0:<ephemeral>
  → resolve LAN IPv4 (host)
  → mint pairing token (single-use, TTL 120s) [+ optional 4-digit PIN]
  → render QR encoding the PairingPayload
mobile: scan QR → GET /v1/ping (sanity) → POST /v1/pair {token, pin?}
  → receive { session, expiresAt }  (session TTL 10 min, sliding)
mobile: choose file/brief → POST /v1/courses (multipart, Bearer session)
desktop: write temp file → emit `course_upload_received` → run Import→Generate → draft course
mobile: receive { courseId, status: "received" }
desktop: close panel → server shuts down, sessions invalidated
```

## 2. QR payload (`PairingPayload`)
The QR encodes a compact JSON string (UTF-8). Keep it small so the code stays low-density.

```jsonc
{
  "v": 1,                 // protocol version
  "host": "192.168.1.42", // desktop LAN IPv4
  "port": 49213,          // ephemeral server port
  "token": "b64url-32B",  // single-use pairing token
  "name": "Jonas' Mac",   // desktop display name (optional)
  "url": "https://abc-def.trycloudflare.com" // optional: tunnel base URL
}
```
Clients MUST reject a payload whose `v` they do not support.

**Base URL resolution.** When `url` is present (the desktop paired over the internet via a cloudflared quick tunnel), clients MUST use it verbatim as the base URL and ignore `host`/`port`. When `url` is absent, clients use `http://<host>:<port>` (LAN). See `baseUrlFor()` in `packages/shared`.

### Tunnel mode (optional)
The admin may tick "Connect over the internet" in the pairing panel. The desktop then spawns a `cloudflared` quick tunnel to its ephemeral port and embeds the resulting public `https://…trycloudflare.com` URL as `url`. All endpoints/behaviour below are identical; only the base URL differs. The tunnel process is owned by the pairing session and is killed on `stop_pairing`, token expiry, or panel close. This is the one case where traffic leaves the LAN — it still terminates at the desktop, with no courseneo cloud relay involved.

## 3. Endpoints

All JSON unless noted. Base URL = `http://<host>:<port>`.

### `GET /v1/ping`
Liveness + identity check before pairing. No auth.
→ `200 { "app": "courseneo", "v": 1, "name": "Jonas' Mac" }`

### `POST /v1/pair`
Exchange a pairing token for a session.
Request `{ "token": "...", "pin": "1234"?, "device": "iPhone 15" }`
- `200 { "session": "b64url-32B", "expiresAt": "<ISO-8601>", "host": "Jonas' Mac" }`
- `401 { "error": "invalid_token" }` — unknown/expired/already-used token
- `401 { "error": "invalid_pin" }` — PIN required and wrong
- `409 { "error": "already_paired" }` — a device is already paired this session (single active device)

### `POST /v1/courses`
Upload a source file and/or brief. Auth: `Authorization: Bearer <session>`.
`multipart/form-data`:
- `title` (text, required) — proposed course title
- `brief` (text, optional) — freeform description/goal
- `file` (binary, optional) — one PDF/audio/video/doc (≤ size limit, see §6)
At least one of `brief` or `file` MUST be present.
- `202 { "courseId": "<uuid>", "status": "received" }` — accepted, generation kicked off on desktop
- `400 { "error": "missing_payload" }`
- `401 { "error": "invalid_session" }` — missing/expired session
- `413 { "error": "file_too_large" }`
- `415 { "error": "unsupported_type" }`

### `GET /v1/courses`
List published courses for browsing/presenting on the phone. Auth: `Authorization: Bearer <session>`.
- `200 { "courses": [ { "id", "topic", "level", "outline" } ] }` — `outline` is the markdown the phone parses with `parseOutlineModules`.
- `401 { "error": "invalid_session" }`
The desktop frontend pushes the current published-course list into the server via the `sync_pairing_courses` Tauri command while pairing is active.

### `POST /v1/present`
Ask the desktop to present a course (launches the desktop's fullscreen chapter-quiz presentation). Auth: `Authorization: Bearer <session>`.
Request `{ "courseId": "..." }`
- `202 { "status": "received" }` — desktop emits the `present_course` Tauri event; the frontend builds the first chapter's quiz and opens `QuizPresentationMode`.
- `400 { "error": "missing_payload" }` — no courseId
- `401 { "error": "invalid_session" }`

### `GET /v1/courses/:id` (optional, Phase 4)
Poll generation status for nicer mobile feedback.
→ `200 { "courseId": "...", "status": "generating" | "draft_ready" | "failed" }`

## 4. Desktop ↔ frontend events (Tauri)
The Rust server is headless; it talks to the React UI via events:
- `device_paired` `{ device, pairedAt }`
- `course_upload_received` `{ courseId, title, brief?, filePath?, fileName?, mime? }`
- `pairing_expired` / `pairing_closed`

The React pairing panel listens and drives the existing Import → Generate flow when `course_upload_received` fires.

## 5. Tokens, sessions, lifetimes
| Secret | Bytes | Lifetime | Reuse |
|---|---|---|---|
| pairing `token` | 32 random, base64url | 120 s | single-use (consumed by `/v1/pair`) |
| `session` | 32 random, base64url | 10 min sliding | many requests until expiry/close |
| PIN (optional) | 4 digits | == token | shown on desktop, entered on mobile |

Server keeps these in memory only. Closing the pairing panel clears all of them and stops listening.

## 6. Limits & content types
- Max upload size: configurable, default **100 MB** (reject with `413`).
- Accepted MIME / extensions mirror `ImportPanel` (PDF, common audio/video, doc/txt/md). Reject others with `415`.
- One file per upload in v1.

## 7. Threat model (LAN)
- **Eavesdropping on plaintext HTTP** — acceptable for v1 on a trusted LAN; the token is single-use and the window is short. Phase 4 may add a self-signed TLS cert pinned via the QR (`fp` field) to defeat passive sniffing.
- **QR shoulder-surfing** — mitigated by the optional desktop PIN and the 120 s token TTL; a stolen QR is useless after pairing consumes the token.
- **Port left open** — mitigated by the ephemeral, opt-in server that only runs while the panel is open and binds to a random port.
- **Rogue same-LAN client** — mitigated by single-use token + single active paired device + size/type limits. Out of scope: a fully authenticated multi-device fleet.
- **Not in scope** — internet exposure, NAT traversal, untrusted networks. Document this clearly in the pairing UI ("Use only on a network you trust").

## 8. Versioning
`v` is bumped on any breaking change to the payload or endpoints. Server advertises supported `v` in `/v1/ping`; clients refuse mismatches with a clear "update your app" message.
