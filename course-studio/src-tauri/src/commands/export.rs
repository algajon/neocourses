use std::fs;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use crate::utils::errors::AppError;
use crate::utils::filenames::sanitise_filename;

#[tauri::command]
pub async fn export_markdown(
    app: AppHandle,
    filename: String,
    content: String,
) -> Result<String, AppError> {
    let safe_name = sanitise_filename(&filename);
    let suggested = format!("{safe_name}.md");

    let path = app
        .dialog()
        .file()
        .set_file_name(&suggested)
        .add_filter("Markdown", &["md"])
        .blocking_save_file();

    let path = match path {
        Some(p) => p,
        None => return Err(AppError::ExportPathInvalid("No path selected".into())),
    };

    let path_str = path.to_string();

    // Ensure content ends with a single newline
    let mut finalised = content.trim_end_matches('\n').to_string();
    finalised.push('\n');

    // Warn on skipped heading levels (write anyway)
    validate_heading_hierarchy(&finalised);

    fs::write(&path_str, &finalised)
        .map_err(|e| AppError::ExportWriteFailed(e.to_string()))?;

    Ok(path_str)
}

fn validate_heading_hierarchy(content: &str) {
    let mut prev_level: Option<usize> = None;
    for line in content.lines() {
        if line.starts_with('#') {
            let level = line.chars().take_while(|&c| c == '#').count();
            if let Some(prev) = prev_level {
                if level > prev + 1 {
                    eprintln!("Warning: heading level skipped from h{prev} to h{level}");
                }
            }
            prev_level = Some(level);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn write_and_read_temp_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test-course.md");
        let content = "## Module 1\n### Lesson 1\n";
        fs::write(&path, content).unwrap();
        let read_back = fs::read_to_string(&path).unwrap();
        assert_eq!(read_back, content);
    }

    #[test]
    fn invalid_path_returns_error() {
        let result = fs::write("/nonexistent/deeply/nested/path/file.md", "content");
        assert!(result.is_err());
    }
}
