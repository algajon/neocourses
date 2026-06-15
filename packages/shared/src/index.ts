/**
 * courseneo shared contracts — the single source of truth for the
 * desktop (course-studio) ↔ mobile (course-mobile) pairing & upload protocol.
 *
 * These types MUST match docs/PAIRING-PROTOCOL.md field-for-field, and the
 * Rust `serde` structs in src-tauri must mirror them. Bump PROTOCOL_VERSION on
 * any breaking change.
 */

export const PROTOCOL_VERSION = 1 as const;

/** Default max upload size enforced by the desktop server (100 MB). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** HTTP endpoints exposed by the desktop's ephemeral LAN server. */
export const ENDPOINTS = {
  ping: '/v1/ping',
  pair: '/v1/pair',
  courses: '/v1/courses',
  present: '/v1/present',
} as const;

/** Payload encoded in the pairing QR code (kept small for low QR density). */
export interface PairingPayload {
  /** Protocol version. Clients must reject versions they do not support. */
  v: number;
  /** Desktop LAN IPv4, e.g. "192.168.1.42". */
  host: string;
  /** Ephemeral server port. */
  port: number;
  /** Single-use pairing token (base64url, 32 bytes), TTL 120s. */
  token: string;
  /** Desktop display name, e.g. "Jonas' Mac". */
  name?: string;
  /**
   * Full public base URL of a tunnel to the pairing server, e.g.
   * "https://abc.trycloudflare.com". Present when the desktop paired over the
   * internet instead of the LAN. When set, clients MUST use this as the base
   * URL (ignoring host/port); otherwise they use `http://host:port`.
   */
  url?: string;
}

/** Resolve the base URL a client should call, given a scanned payload. */
export function baseUrlFor(p: Pick<PairingPayload, 'host' | 'port' | 'url'>): string {
  return p.url && p.url.length > 0 ? p.url.replace(/\/$/, '') : `http://${p.host}:${p.port}`;
}

/**
 * Result of the desktop `start_pairing` Tauri command. Drives the pairing
 * panel: render `qrSvg`, show `pin` when present, expire at `expiresAt`.
 */
export interface StartPairingResponse {
  host: string;
  port: number;
  token: string;
  /** 4-digit PIN, present only when the admin required one (on-demand). */
  pin?: string;
  name?: string;
  /** Public tunnel base URL when paired over the internet (ngrok). */
  url?: string;
  /** Pre-rendered QR code (encodes the PairingPayload) as an inline SVG string. */
  qrSvg: string;
  /** ISO-8601 expiry of the pairing token. */
  expiresAt: string;
  /** Expo Go URL to load the app on the phone (exp://…exp.direct), if discoverable. */
  expoUrl?: string;
  /** Pre-rendered QR (inline SVG) encoding `expoUrl`, for scanning with Expo Go. */
  expoQrSvg?: string;
}

/** GET /v1/ping response — liveness + identity, no auth. */
export interface PingResponse {
  app: 'courseneo';
  v: number;
  name?: string;
}

/** POST /v1/pair request body. `pin` is only sent when the desktop requires it (on-demand). */
export interface PairRequest {
  token: string;
  pin?: string;
  /** Human label for the connecting device, e.g. "iPhone 15". */
  device: string;
}

/** POST /v1/pair success response. */
export interface PairResponse {
  /** Bearer session (base64url, 32 bytes), TTL 10 min sliding. */
  session: string;
  /** ISO-8601 expiry. */
  expiresAt: string;
  /** Desktop display name. */
  host?: string;
}

/** Lifecycle status of an uploaded course on the desktop. */
export type UploadStatus = 'received' | 'generating' | 'draft_ready' | 'failed';

/**
 * Fields of the multipart POST /v1/courses body.
 * `title` is required; at least one of `brief` or `file` must be present.
 * v1 allows exactly one file per upload.
 */
export interface UploadFields {
  title: string;
  brief?: string;
}

/** POST /v1/courses success response (202). */
export interface UploadResponse {
  courseId: string;
  status: UploadStatus;
}

/** GET /v1/courses/:id response (optional status polling). */
export interface CourseStatusResponse {
  courseId: string;
  status: UploadStatus;
}

/* ── Course browsing & remote presentation ────────────────────────────── */

/** A published course the phone can browse, view, and present. */
export interface CourseSummary {
  id: string;
  topic: string;
  level: string;
  /** Markdown outline (## chapter / ### lesson); parse with parseOutlineModules. */
  outline: string;
}

/** GET /v1/courses response (auth required). Published courses only. */
export interface CoursesResponse {
  courses: CourseSummary[];
}

/** POST /v1/present request body (auth required). */
export interface PresentRequest {
  courseId: string;
}

/** A parsed chapter and its lessons. */
export interface OutlineModule {
  module: string;
  lessons: string[];
}

/** Parse a course outline (`## chapter` / `### lesson`) into modules. */
export function parseOutlineModules(outline: string): OutlineModule[] {
  const mods: OutlineModule[] = [];
  let cur: OutlineModule | null = null;
  for (const line of outline.split('\n')) {
    if (line.startsWith('## ')) {
      cur = { module: line.replace(/^## /, '').trim(), lessons: [] };
      mods.push(cur);
    } else if (line.startsWith('### ') && cur) {
      cur.lessons.push(line.replace(/^### /, '').trim());
    }
  }
  return mods;
}

export type PairErrorCode = 'invalid_token' | 'invalid_pin' | 'already_paired';
export type UploadErrorCode =
  | 'missing_payload'
  | 'invalid_session'
  | 'file_too_large'
  | 'unsupported_type';
export type ApiErrorCode = PairErrorCode | UploadErrorCode;

/** Uniform error body shape: `{ "error": "<code>" }`. */
export interface ApiError<C extends ApiErrorCode = ApiErrorCode> {
  error: C;
}

/* ── Desktop-internal Tauri event payloads (typed here for reuse) ──────── */

export interface DevicePairedEvent {
  device: string;
  /** ISO-8601. */
  pairedAt: string;
}

export interface CourseUploadReceivedEvent {
  courseId: string;
  title: string;
  brief?: string;
  /** Absolute temp path of the received file, if a file was uploaded. */
  filePath?: string;
  fileName?: string;
  mime?: string;
}

/** Phone asked the desktop to present a course (POST /v1/present). */
export interface PresentCourseEvent {
  courseId: string;
}

/** Tauri event channel names emitted by the desktop pairing server. */
export const PAIRING_EVENTS = {
  devicePaired: 'device_paired',
  courseUploadReceived: 'course_upload_received',
  presentCourse: 'present_course',
  pairingExpired: 'pairing_expired',
  pairingClosed: 'pairing_closed',
} as const;
