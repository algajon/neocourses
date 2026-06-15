use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Multipart, State as AxumState},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::Engine;
use chrono::{Duration as ChronoDuration, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use uuid::Uuid;

use crate::utils::errors::AppError;

const TOKEN_TTL_SECS: i64 = 120;
const SESSION_TTL_SECS: i64 = 600;
const MAX_UPLOAD_BYTES: usize = 100 * 1024 * 1024;

/// Env var holding the pre-configured public tunnel URL (e.g. an external ngrok
/// agent's URL). Required when `use_tunnel` is true.
const ENV_TUNNEL_URL: &str = "COURSENEO_TUNNEL_URL";
/// Env var holding the fixed local port the external tunnel agent targets.
const ENV_TUNNEL_PORT: &str = "COURSENEO_TUNNEL_PORT";
/// Default fixed port used in tunnel mode when the env var is unset/invalid.
const DEFAULT_TUNNEL_PORT: u16 = 47813;

const EV_DEVICE_PAIRED: &str = "device_paired";
const EV_COURSE_UPLOAD_RECEIVED: &str = "course_upload_received";
const EV_PRESENT_COURSE: &str = "present_course";
const EV_PAIRING_EXPIRED: &str = "pairing_expired";
const EV_PAIRING_CLOSED: &str = "pairing_closed";

/// A published course summary mirrored to the phone over the pairing server.
/// Mirrors the TS `CourseSummary`; all keys are lowercase single words.
#[derive(Serialize, Deserialize, Clone)]
pub struct CourseSummary {
    pub id: String,
    pub topic: String,
    pub level: String,
    pub outline: String,
}

/// In-memory pairing token record. Never logged or persisted.
struct TokenRecord {
    token: String,
    expires_at: chrono::DateTime<Utc>,
    pin: Option<String>,
    used: bool,
}

struct SessionRecord {
    expires_at: chrono::DateTime<Utc>,
}

/// All ephemeral pairing state. Lives only between start_pairing/stop_pairing.
#[derive(Default)]
pub struct PairingInner {
    token: Option<TokenRecord>,
    sessions: HashMap<String, SessionRecord>,
    shutdown: Option<oneshot::Sender<()>>,
    host: Option<String>,
    port: Option<u16>,
    name: String,
    courses: Vec<CourseSummary>,
}

#[derive(Clone)]
pub struct PairingState(pub Arc<Mutex<PairingInner>>);

impl Default for PairingState {
    fn default() -> Self {
        PairingState(Arc::new(Mutex::new(PairingInner::default())))
    }
}

/// Shared handle passed into axum handlers so they can mutate pairing state and
/// emit Tauri events.
#[derive(Clone)]
struct AppState {
    inner: Arc<Mutex<PairingInner>>,
    app: AppHandle,
    name: String,
}

#[derive(Serialize)]
struct PairingPayload {
    v: u8,
    host: String,
    port: u16,
    token: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartPairingResponse {
    host: String,
    port: u16,
    token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pin: Option<String>,
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    qr_svg: String,
    expires_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    expo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    expo_qr_svg: Option<String>,
}

fn random_b64url(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill(&mut buf[..]);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

fn resolve_name() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "courseneo desktop".to_string())
}

/// Resolve the fixed tunnel port from the environment, falling back to the
/// default when unset or unparseable.
fn resolve_tunnel_port() -> u16 {
    std::env::var(ENV_TUNNEL_PORT)
        .ok()
        .and_then(|v| v.trim().parse::<u16>().ok())
        .unwrap_or(DEFAULT_TUNNEL_PORT)
}

/// Local ngrok agent API ports to probe. Multiple agents bind sequential ports.
const NGROK_API_BASES: &[&str] = &[
    "http://127.0.0.1:4040",
    "http://127.0.0.1:4041",
    "http://127.0.0.1:4042",
];

/// Parse the local port out of an ngrok tunnel `config.addr` such as
/// `http://localhost:8080` or `localhost:8080/foo`. Takes the substring after
/// the last `:`, strips any trailing path, and parses the leading digits.
fn parse_addr_port(addr: &str) -> Option<u16> {
    let after_colon = addr.rsplit_once(':').map(|(_, rest)| rest)?;
    let no_path = after_colon.split('/').next().unwrap_or(after_colon);
    let digits: String = no_path.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<u16>().ok()
}

/// A tunnel parsed from the local ngrok agent API.
struct NgrokTunnel {
    public_url: String,
    local_port: Option<u16>,
}

/// Probe each candidate ngrok agent API port and collect all tunnels found at
/// the first responsive API. All probe/parse failures (closed ports, timeouts,
/// malformed JSON) are swallowed into an empty list.
async fn probe_ngrok_tunnels() -> Vec<NgrokTunnel> {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
    {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    for base in NGROK_API_BASES {
        let url = format!("{base}/api/tunnels");
        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(_) => continue,
        };
        let body: serde_json::Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => continue,
        };
        let tunnels = match body.get("tunnels").and_then(|t| t.as_array()) {
            Some(t) => t,
            None => continue,
        };
        let mut out = Vec::new();
        for tunnel in tunnels {
            let public_url = match tunnel.get("public_url").and_then(|u| u.as_str()) {
                Some(u) => u.to_string(),
                None => continue,
            };
            let local_port = tunnel
                .get("config")
                .and_then(|c| c.get("addr"))
                .and_then(|a| a.as_str())
                .and_then(parse_addr_port);
            out.push(NgrokTunnel {
                public_url,
                local_port,
            });
        }
        return out;
    }

    Vec::new()
}

/// Auto-discover a running ngrok tunnel via the local ngrok agent API.
///
/// Returns the first tunnel whose `public_url` is HTTPS and not an Expo dev
/// tunnel (`exp.direct`), as `(public_url, local_port)`. Returns `None` if no
/// matching tunnel is found.
async fn discover_ngrok_tunnel() -> Option<(String, u16)> {
    for tunnel in probe_ngrok_tunnels().await {
        // Accept only HTTPS public URLs, and exclude Expo's dev tunnel.
        if !tunnel.public_url.starts_with("https://") || tunnel.public_url.contains("exp.direct") {
            continue;
        }
        if let Some(port) = tunnel.local_port {
            let trimmed = tunnel.public_url.trim_end_matches('/').to_string();
            return Some((trimmed, port));
        }
    }
    None
}

/// Auto-discover Expo's dev tunnel (an `exp.direct` ngrok tunnel) via the local
/// ngrok agent API, and convert it to an Expo Go URL.
///
/// Finds the first tunnel whose `public_url` contains `exp.direct` over either
/// http or https, then rewrites its scheme to `exp://` (keeping host + path).
/// e.g. `https://40o7ahs-anonymous-8081.exp.direct` →
/// `exp://40o7ahs-anonymous-8081.exp.direct`. Returns `None` if not found.
async fn discover_expo_url() -> Option<String> {
    for tunnel in probe_ngrok_tunnels().await {
        let url = &tunnel.public_url;
        if !url.contains("exp.direct") {
            continue;
        }
        let rest = if let Some(r) = url.strip_prefix("https://") {
            r
        } else if let Some(r) = url.strip_prefix("http://") {
            r
        } else {
            continue;
        };
        let expo = format!("exp://{}", rest.trim_end_matches('/'));
        return Some(expo);
    }
    None
}

#[tauri::command]
pub async fn start_pairing(
    app: AppHandle,
    state: tauri::State<'_, PairingState>,
    require_pin: bool,
    use_tunnel: bool,
) -> Result<StartPairingResponse, AppError> {
    // Resolve LAN IPv4.
    let host = match local_ip_address::local_ip() {
        Ok(std::net::IpAddr::V4(ip)) => ip.to_string(),
        Ok(std::net::IpAddr::V6(_)) | Err(_) => {
            return Err(AppError::PairingFailed(
                "could not resolve a LAN IPv4 address".to_string(),
            ))
        }
    };

    let name = resolve_name();

    // In tunnel mode, resolve the public URL + local bind port. Resolution order:
    //   1. Auto-discover a running ngrok tunnel via its local agent API.
    //   2. Fall back to the COURSENEO_TUNNEL_URL env var + resolve_tunnel_port().
    //   3. Otherwise error — no tunnel to advertise.
    // In LAN mode, advertise no public URL and bind an ephemeral port.
    let (public_url, tunnel_port): (Option<String>, Option<u16>) = if use_tunnel {
        if let Some((url, port)) = discover_ngrok_tunnel().await {
            (Some(url), Some(port))
        } else {
            let raw = std::env::var(ENV_TUNNEL_URL).unwrap_or_default();
            let trimmed = raw.trim().trim_end_matches('/').to_string();
            if trimmed.is_empty() {
                return Err(AppError::PairingFailed(
                    "No ngrok tunnel found. Start one first (e.g. `ngrok http 8080`), then try again.".to_string(),
                ));
            }
            (Some(trimmed), Some(resolve_tunnel_port()))
        }
    } else {
        (None, None)
    };

    // Bind the listener. Tunnel mode binds the resolved port and must not fall
    // back to a random port (the tunnel agent targets this exact port); LAN mode
    // uses an OS-assigned ephemeral port.
    let listener = if let Some(tunnel_port) = tunnel_port {
        tokio::net::TcpListener::bind(("0.0.0.0", tunnel_port))
            .await
            .map_err(|e| {
                AppError::PairingFailed(format!(
                    "could not bind tunnel port {tunnel_port}: {e}"
                ))
            })?
    } else {
        tokio::net::TcpListener::bind("0.0.0.0:0")
            .await
            .map_err(|e| AppError::PairingFailed(format!("bind failed: {e}")))?
    };
    let bound: SocketAddr = listener
        .local_addr()
        .map_err(|e| AppError::PairingFailed(format!("local_addr failed: {e}")))?;
    let port = bound.port();

    // Mint token (+ optional PIN).
    let token = random_b64url(32);
    let pin = if require_pin {
        let n: u16 = rand::thread_rng().gen_range(0..10000);
        Some(format!("{n:04}"))
    } else {
        None
    };
    let expires_at = Utc::now() + ChronoDuration::seconds(TOKEN_TTL_SECS);
    let expires_at_rfc3339 = expires_at.to_rfc3339();

    // Build the QR payload (now carrying `url` when tunnelled) and render it.
    let payload = PairingPayload {
        v: 1,
        host: host.clone(),
        port,
        token: token.clone(),
        name: name.clone(),
        url: public_url.clone(),
    };
    let payload_json = serde_json::to_string(&payload)
        .map_err(|e| AppError::PairingFailed(format!("payload encode failed: {e}")))?;
    let code = qrcode::QrCode::new(payload_json.as_bytes())
        .map_err(|e| AppError::PairingFailed(format!("qr encode failed: {e}")))?;
    let qr_svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(256, 256)
        .build();

    // Discover the Expo Go dev URL (if `expo start --tunnel` is running) so the
    // pairing panel can show how to load the app via Expo Go. A QR render
    // failure here must never fail pairing.
    let (expo_url, expo_qr_svg): (Option<String>, Option<String>) =
        match discover_expo_url().await {
            Some(url) => {
                let svg = qrcode::QrCode::new(url.as_bytes()).ok().map(|code| {
                    code.render::<qrcode::render::svg::Color>()
                        .min_dimensions(256, 256)
                        .build()
                });
                (Some(url), svg)
            }
            None => (None, None),
        };

    let (tx, rx) = oneshot::channel::<()>();

    // Store state.
    {
        let mut inner = state.0.lock().unwrap();
        // Replace any prior server: signal its shutdown.
        if let Some(prev) = inner.shutdown.take() {
            let _ = prev.send(());
        }
        inner.token = Some(TokenRecord {
            token: token.clone(),
            expires_at,
            pin: pin.clone(),
            used: false,
        });
        inner.sessions.clear();
        inner.shutdown = Some(tx);
        inner.host = Some(host.clone());
        inner.port = Some(port);
        inner.name = name.clone();
    }

    let app_state = AppState {
        inner: state.0.clone(),
        app: app.clone(),
        name: name.clone(),
    };

    let router = Router::new()
        .route("/v1/ping", get(ping_handler))
        .route("/v1/pair", post(pair_handler))
        .route("/v1/courses", post(courses_handler).get(list_courses_handler))
        .route("/v1/present", post(present_handler))
        .with_state(app_state);

    // Token-expiry watchdog: emit pairing_expired once the TTL passes if the
    // token was never consumed.
    let expiry_inner = state.0.clone();
    let expiry_app = app.clone();
    let expiry_token = token.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(TOKEN_TTL_SECS as u64)).await;
        let expired = {
            let mut guard = expiry_inner.lock().unwrap();
            match &guard.token {
                Some(t) if t.token == expiry_token && !t.used => {
                    guard.token = None;
                    true
                }
                _ => false,
            }
        };
        if expired {
            let _ = expiry_app.emit(EV_PAIRING_EXPIRED, json!({}));
        }
    });

    // Spawn the server with graceful shutdown wired to the oneshot receiver.
    tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = rx.await;
            })
            .await;
    });

    Ok(StartPairingResponse {
        host,
        port,
        token,
        pin,
        name: Some(name),
        url: public_url,
        qr_svg,
        expires_at: expires_at_rfc3339,
        expo_url,
        expo_qr_svg,
    })
}

#[tauri::command]
pub async fn stop_pairing(
    app: AppHandle,
    state: tauri::State<'_, PairingState>,
) -> Result<(), AppError> {
    let active = {
        let mut inner = state.0.lock().unwrap();
        let had_server = inner.shutdown.is_some();
        if let Some(tx) = inner.shutdown.take() {
            let _ = tx.send(());
        }
        inner.token = None;
        inner.sessions.clear();
        inner.host = None;
        inner.port = None;
        had_server
    };

    if !active {
        return Err(AppError::PairingNotActive);
    }

    let _ = app.emit(EV_PAIRING_CLOSED, json!({}));
    Ok(())
}

/// Replace the stored published-courses list. Works whether or not a pairing
/// server is currently running — it only updates in-memory state.
#[tauri::command]
pub async fn sync_pairing_courses(
    state: tauri::State<'_, PairingState>,
    courses: Vec<CourseSummary>,
) -> Result<(), AppError> {
    let mut inner = state
        .0
        .lock()
        .map_err(|e| AppError::PairingFailed(format!("state lock poisoned: {e}")))?;
    inner.courses = courses;
    Ok(())
}

/* ───────────────────────── axum handlers ───────────────────────── */

fn err_body(code: StatusCode, error: &str) -> axum::response::Response {
    (code, Json(json!({ "error": error }))).into_response()
}

#[derive(Serialize)]
struct PingResponse {
    app: &'static str,
    v: u8,
    name: String,
}

async fn ping_handler(AxumState(state): AxumState<AppState>) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(PingResponse {
            app: "courseneo",
            v: 1,
            name: state.name.clone(),
        }),
    )
}

#[derive(Deserialize)]
struct PairRequest {
    token: String,
    #[serde(default)]
    pin: Option<String>,
    device: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PairResponse {
    session: String,
    expires_at: String,
    host: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DevicePairedEvent {
    device: String,
    paired_at: String,
}

async fn pair_handler(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<PairRequest>,
) -> axum::response::Response {
    let now = Utc::now();

    // Validate token + pin, then mint a session, under one lock.
    let (session, expires_at_rfc3339) = {
        let mut inner = state.inner.lock().unwrap();

        let token_rec = match &inner.token {
            Some(t) => t,
            None => return err_body(StatusCode::UNAUTHORIZED, "invalid_token"),
        };

        if token_rec.token != req.token || token_rec.used || token_rec.expires_at <= now {
            return err_body(StatusCode::UNAUTHORIZED, "invalid_token");
        }

        // PIN check only when one was minted.
        if let Some(expected) = &token_rec.pin {
            match &req.pin {
                Some(p) if p == expected => {}
                _ => return err_body(StatusCode::UNAUTHORIZED, "invalid_pin"),
            }
        }

        // Single active device: refuse if a session already exists.
        if !inner.sessions.is_empty() {
            return err_body(StatusCode::CONFLICT, "already_paired");
        }

        // Consume token.
        if let Some(t) = inner.token.as_mut() {
            t.used = true;
        }

        let session = random_b64url(32);
        let expires_at = now + ChronoDuration::seconds(SESSION_TTL_SECS);
        inner
            .sessions
            .insert(session.clone(), SessionRecord { expires_at });

        (session, expires_at.to_rfc3339())
    };

    let paired_at = now.to_rfc3339();
    let _ = state.app.emit(
        EV_DEVICE_PAIRED,
        DevicePairedEvent {
            device: req.device.clone(),
            paired_at,
        },
    );

    (
        StatusCode::OK,
        Json(PairResponse {
            session,
            expires_at: expires_at_rfc3339,
            host: state.name.clone(),
        }),
    )
        .into_response()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadResponse {
    course_id: String,
    status: &'static str,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CourseUploadReceivedEvent {
    course_id: String,
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    brief: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mime: Option<String>,
}

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
    let token = value.strip_prefix("Bearer ")?;
    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

const ALLOWED_EXTS: &[&str] = &[
    "pdf", "mp3", "wav", "m4a", "aac", "mp4", "mov", "m4v", "webm", "doc", "docx", "txt", "md",
    "rtf",
];

fn ext_allowed(name: &str) -> bool {
    match name.rsplit_once('.') {
        Some((_, ext)) => ALLOWED_EXTS.contains(&ext.to_ascii_lowercase().as_str()),
        None => false,
    }
}

fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() || cleaned == "." || cleaned == ".." {
        Uuid::new_v4().to_string()
    } else {
        cleaned.to_string()
    }
}

async fn courses_handler(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> axum::response::Response {
    // Session check (sliding renewal on success).
    let session = match extract_bearer(&headers) {
        Some(s) => s,
        None => return err_body(StatusCode::UNAUTHORIZED, "invalid_session"),
    };
    {
        let mut inner = state.inner.lock().unwrap();
        let now = Utc::now();
        let valid = match inner.sessions.get(&session) {
            Some(rec) => rec.expires_at > now,
            None => false,
        };
        if !valid {
            inner.sessions.remove(&session);
            return err_body(StatusCode::UNAUTHORIZED, "invalid_session");
        }
        // Slide expiry.
        if let Some(rec) = inner.sessions.get_mut(&session) {
            rec.expires_at = now + ChronoDuration::seconds(SESSION_TTL_SECS);
        }
    }

    let mut title: Option<String> = None;
    let mut brief: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut file_mime: Option<String> = None;

    loop {
        let field = match multipart.next_field().await {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(_) => return err_body(StatusCode::BAD_REQUEST, "missing_payload"),
        };

        let field_name = field.name().unwrap_or("").to_string();
        match field_name.as_str() {
            "title" => {
                title = field.text().await.ok().map(|t| t.trim().to_string());
            }
            "brief" => {
                brief = field.text().await.ok();
            }
            "file" => {
                let fname = field.file_name().map(|s| s.to_string());
                let mime = field.content_type().map(|s| s.to_string());
                let bytes = match field.bytes().await {
                    Ok(b) => b,
                    Err(_) => return err_body(StatusCode::BAD_REQUEST, "missing_payload"),
                };
                file_name = fname;
                file_mime = mime;
                file_bytes = Some(bytes.to_vec());
            }
            _ => {
                let _ = field.bytes().await;
            }
        }
    }

    // title required.
    let title = match title {
        Some(t) if !t.is_empty() => t,
        _ => return err_body(StatusCode::BAD_REQUEST, "missing_payload"),
    };

    let brief = brief.and_then(|b| {
        let t = b.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });

    let has_file = file_bytes.as_ref().map(|b| !b.is_empty()).unwrap_or(false);

    // At least one of brief or file required.
    if brief.is_none() && !has_file {
        return err_body(StatusCode::BAD_REQUEST, "missing_payload");
    }

    let mut saved_path: Option<String> = None;
    if has_file {
        let bytes = file_bytes.as_ref().unwrap();
        if bytes.len() > MAX_UPLOAD_BYTES {
            return err_body(StatusCode::PAYLOAD_TOO_LARGE, "file_too_large");
        }

        let original = file_name.clone().unwrap_or_default();
        if original.is_empty() || !ext_allowed(&original) {
            return err_body(StatusCode::UNSUPPORTED_MEDIA_TYPE, "unsupported_type");
        }

        let dir = std::env::temp_dir().join("courseneo-uploads");
        if let Err(e) = tokio::fs::create_dir_all(&dir).await {
            return err_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("io_error: {e}"),
            );
        }
        let safe = sanitize_filename(&original);
        let unique = format!("{}-{}", Uuid::new_v4(), safe);
        let path = dir.join(&unique);
        if let Err(e) = tokio::fs::write(&path, bytes).await {
            return err_body(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("io_error: {e}"),
            );
        }
        saved_path = Some(path.to_string_lossy().to_string());
    }

    let course_id = Uuid::new_v4().to_string();

    let _ = state.app.emit(
        EV_COURSE_UPLOAD_RECEIVED,
        CourseUploadReceivedEvent {
            course_id: course_id.clone(),
            title,
            brief,
            file_path: saved_path,
            file_name: if has_file { file_name } else { None },
            mime: if has_file { file_mime } else { None },
        },
    );

    (
        StatusCode::ACCEPTED,
        Json(UploadResponse {
            course_id,
            status: "received",
        }),
    )
        .into_response()
}

/// Validate a Bearer session header against the stored sessions, sliding its
/// expiry on success. Returns `Ok(())` when valid, or the error response to send.
fn check_session(state: &AppState, headers: &HeaderMap) -> Result<(), axum::response::Response> {
    let session = match extract_bearer(headers) {
        Some(s) => s,
        None => return Err(err_body(StatusCode::UNAUTHORIZED, "invalid_session")),
    };
    let mut inner = match state.inner.lock() {
        Ok(g) => g,
        Err(_) => return Err(err_body(StatusCode::UNAUTHORIZED, "invalid_session")),
    };
    let now = Utc::now();
    let valid = match inner.sessions.get(&session) {
        Some(rec) => rec.expires_at > now,
        None => false,
    };
    if !valid {
        inner.sessions.remove(&session);
        return Err(err_body(StatusCode::UNAUTHORIZED, "invalid_session"));
    }
    if let Some(rec) = inner.sessions.get_mut(&session) {
        rec.expires_at = now + ChronoDuration::seconds(SESSION_TTL_SECS);
    }
    Ok(())
}

#[derive(Serialize)]
struct CoursesResponse {
    courses: Vec<CourseSummary>,
}

/// GET /v1/courses — return the stored published-courses list. Auth required.
async fn list_courses_handler(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
) -> axum::response::Response {
    if let Err(resp) = check_session(&state, &headers) {
        return resp;
    }
    let courses = match state.inner.lock() {
        Ok(g) => g.courses.clone(),
        Err(_) => return err_body(StatusCode::INTERNAL_SERVER_ERROR, "state_error"),
    };
    (StatusCode::OK, Json(CoursesResponse { courses })).into_response()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresentRequest {
    #[serde(default)]
    course_id: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PresentCourseEvent {
    course_id: String,
}

#[derive(Serialize)]
struct PresentResponse {
    status: &'static str,
}

/// POST /v1/present — ask the desktop to present a course. Auth required.
async fn present_handler(
    AxumState(state): AxumState<AppState>,
    headers: HeaderMap,
    Json(req): Json<PresentRequest>,
) -> axum::response::Response {
    if let Err(resp) = check_session(&state, &headers) {
        return resp;
    }

    let course_id = req.course_id.trim().to_string();
    if course_id.is_empty() {
        return err_body(StatusCode::BAD_REQUEST, "missing_payload");
    }

    let _ = state.app.emit(
        EV_PRESENT_COURSE,
        PresentCourseEvent {
            course_id: course_id.clone(),
        },
    );

    (
        StatusCode::ACCEPTED,
        Json(PresentResponse { status: "received" }),
    )
        .into_response()
}
