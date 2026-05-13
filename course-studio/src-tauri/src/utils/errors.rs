use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Clone)]
#[serde(tag = "code", content = "detail")]
pub enum AppError {
    #[error("Outline generation failed")]
    #[serde(rename = "OUTLINE_GENERATION_FAILED")]
    OutlineGenerationFailed(String),

    #[error("Model endpoint unreachable")]
    #[serde(rename = "MODEL_UNREACHABLE")]
    ModelUnreachable(String),

    #[error("Model authentication failed")]
    #[serde(rename = "MODEL_AUTH_FAILED")]
    ModelAuthFailed,

    #[error("Failed to parse model response")]
    #[serde(rename = "MODEL_PARSE_FAILED")]
    ModelParseFailed(String),

    #[error("Export write failed")]
    #[serde(rename = "EXPORT_WRITE_FAILED")]
    ExportWriteFailed(String),

    #[error("Export path is invalid")]
    #[serde(rename = "EXPORT_PATH_INVALID")]
    ExportPathInvalid(String),

    #[error("Job was cancelled")]
    #[serde(rename = "JOB_CANCELLED")]
    JobCancelled,
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        serde_json::to_string(&e).unwrap_or_else(|_| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_serialises_with_code() {
        let e = AppError::ModelAuthFailed;
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["code"], "MODEL_AUTH_FAILED");
    }

    #[test]
    fn app_error_with_detail_serialises() {
        let e = AppError::ModelUnreachable("refused".to_string());
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["code"], "MODEL_UNREACHABLE");
        assert_eq!(json["detail"], "refused");
    }

    #[test]
    fn export_error_serialises() {
        let e = AppError::ExportWriteFailed("permission denied".into());
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["code"], "EXPORT_WRITE_FAILED");
    }
}
