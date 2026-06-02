mod commands;
mod utils;

use commands::jobs::JobRegistry;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let registry: JobRegistry = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(registry)
        .invoke_handler(tauri::generate_handler![
            commands::outline::generate_fake_outline,
            commands::outline::generate_outline_direct,
            commands::outline::generate_lesson_content,
            commands::export::export_markdown,
            commands::model::test_model_endpoint,
            commands::jobs::generate_outline_with_model,
            commands::jobs::cancel_job,
            commands::window::set_fullscreen,
            commands::window::is_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
