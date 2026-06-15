use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::commands::model::call_model;
use crate::utils::errors::AppError;

pub type JobRegistry = Arc<Mutex<HashMap<String, CancellationToken>>>;

#[tauri::command]
pub async fn cancel_job(
    job_id: String,
    registry: tauri::State<'_, JobRegistry>,
) -> Result<(), String> {
    let reg = registry.lock().unwrap();
    if let Some(token) = reg.get(&job_id) {
        token.cancel();
    }
    Ok(())
}

#[derive(serde::Serialize, Clone)]
struct ProgressPayload {
    job_id: String,
    progress: u8,
}

#[derive(serde::Serialize, Clone)]
struct CompletePayload {
    job_id: String,
}

#[derive(serde::Serialize, Clone)]
struct OutlineReadyPayload {
    job_id: String,
    outline: String,
}

#[derive(serde::Serialize, Clone)]
struct FailedPayload {
    job_id: String,
    error: AppError,
}

#[tauri::command]
pub async fn generate_outline_with_model(
    app: AppHandle,
    registry: tauri::State<'_, JobRegistry>,
    topic: String,
    audience: String,
    level: String,
    goal: String,
    base_url: String,
    api_key: String,
    model: String,
    tier: Option<String>,
) -> Result<String, AppError> {
    let job_id = Uuid::new_v4().to_string();
    let token = CancellationToken::new();

    {
        let mut reg = registry.lock().unwrap();
        reg.insert(job_id.clone(), token.clone());
    }

    let app_clone = app.clone();
    let job_id_clone = job_id.clone();

    tokio::spawn(async move {
        let _ = app_clone.emit("job_progress", ProgressPayload { job_id: job_id_clone.clone(), progress: 10 });

        let system = "You are a course design expert. Return only a valid Markdown outline.\nNo preamble. No explanation. Use ## for modules and ### for lessons.";
        let user = format!(
            "Create a training course on: {topic}\nAudience: {audience}\nLevel: {level}\nLearning goal: {goal}"
        );

        tokio::select! {
            result = call_model(&base_url, &api_key, &model, system, &user, tier.as_deref()) => {
                let _ = app_clone.emit("job_progress", ProgressPayload { job_id: job_id_clone.clone(), progress: 90 });
                match result {
                    Ok(outline) => {
                        let _ = app_clone.emit("job_outline_ready", OutlineReadyPayload {
                            job_id: job_id_clone.clone(),
                            outline,
                        });
                        let _ = app_clone.emit("job_complete", CompletePayload { job_id: job_id_clone });
                    }
                    Err(e) => {
                        let _ = app_clone.emit("job_failed", FailedPayload { job_id: job_id_clone, error: e });
                    }
                }
            }
            _ = token.cancelled() => {
                let _ = app_clone.emit("job_failed", FailedPayload {
                    job_id: job_id_clone,
                    error: AppError::JobCancelled,
                });
            }
        }
    });

    Ok(job_id)
}
