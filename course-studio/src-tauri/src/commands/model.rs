use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use crate::utils::errors::AppError;

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

fn build_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::ModelUnreachable(e.to_string()))
}

pub async fn call_model(
    base_url: &str,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, AppError> {
    let client = build_client()?;
    let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));

    let body = ChatRequest {
        model: model.to_string(),
        messages: vec![
            ChatMessage { role: "system".into(), content: system.to_string() },
            ChatMessage { role: "user".into(), content: user.to_string() },
        ],
        stream: false,
    };

    let mut req = client.post(&url).json(&body);
    if !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }

    let resp = req.send().await.map_err(|e| {
        if e.is_connect() || e.is_timeout() {
            AppError::ModelUnreachable(e.to_string())
        } else {
            AppError::ModelUnreachable(e.to_string())
        }
    })?;

    match resp.status() {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            return Err(AppError::ModelAuthFailed);
        }
        s if !s.is_success() => {
            return Err(AppError::ModelUnreachable(format!("HTTP {s}")));
        }
        _ => {}
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::ModelParseFailed(e.to_string()))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| AppError::ModelParseFailed("Empty choices array".into()))
}

#[tauri::command]
pub async fn test_model_endpoint(
    base_url: String,
    api_key: String,
    model: String,
) -> Result<String, AppError> {
    let user = "Reply with exactly one word: pong";
    call_model(&base_url, &api_key, &model, "You are a test assistant.", user).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;

    fn chat_response_json(content: &str) -> String {
        format!(
            r#"{{"choices":[{{"message":{{"role":"assistant","content":"{content}"}}}}]}}"#
        )
    }

    #[tokio::test]
    async fn valid_response_parsed_correctly() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/chat/completions")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(chat_response_json("pong"))
            .create_async()
            .await;

        let result = call_model(&server.url(), "", "test-model", "sys", "user").await;
        mock.assert_async().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "pong");
    }

    #[tokio::test]
    async fn http_401_returns_auth_failed() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/chat/completions")
            .with_status(401)
            .create_async()
            .await;

        let result = call_model(&server.url(), "bad-key", "test-model", "sys", "user").await;
        mock.assert_async().await;
        assert!(matches!(result, Err(AppError::ModelAuthFailed)));
    }

    #[tokio::test]
    async fn connection_refused_returns_unreachable() {
        // Port 1 is always refused
        let result = call_model("http://127.0.0.1:1", "", "test-model", "sys", "user").await;
        assert!(matches!(result, Err(AppError::ModelUnreachable(_))));
    }
}
