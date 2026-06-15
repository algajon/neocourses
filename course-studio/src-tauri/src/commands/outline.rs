use crate::utils::errors::AppError;

#[tauri::command]
pub fn generate_fake_outline(
    topic: String,
    _audience: String,
    _level: String,
    _goal: String,
) -> Result<String, AppError> {
    if topic.trim().is_empty() {
        return Err(AppError::OutlineGenerationFailed("Topic cannot be empty".into()));
    }

    let outline = format!(
        r#"## Foundations of {topic}
### Introduction to {topic}
### Core Concepts and Principles
### Getting Started in Practice

## Working with {topic}
### Key Techniques and Patterns
### Real-World Application
### Common Challenges and Solutions

## Advanced {topic}
### Deeper Exploration
### Integration and Workflows
### Capstone Review
"#
    );

    Ok(outline)
}

#[tauri::command]
pub async fn generate_lesson_content(
    lesson_title: String,
    chapter_name: String,
    course_topic: String,
    base_url: String,
    api_key: String,
    model: String,
    tier: Option<String>,
) -> Result<String, AppError> {
    if lesson_title.trim().is_empty() {
        return Err(AppError::OutlineGenerationFailed("Lesson title cannot be empty".into()));
    }

    let system = "You are an educational content writer. Return only valid JSON with no markdown fences or extra text.";
    let user = format!(
        r#"Write lesson content for a lesson titled "{lesson_title}" in chapter "{chapter_name}" of a course about "{course_topic}".

Return this exact JSON with no other text:
{{
  "intro": "2-3 sentences explaining what this lesson covers and why it matters",
  "concepts": [
    {{"title": "Concept title", "body": "2-3 sentences of factual, specific educational content about {lesson_title}"}},
    {{"title": "Concept title", "body": "2-3 sentences of factual, specific educational content about {lesson_title}"}},
    {{"title": "Concept title", "body": "2-3 sentences of factual, specific educational content about {lesson_title}"}}
  ],
  "keyPoints": [
    "Short factual bullet point about {lesson_title}",
    "Short factual bullet point about {lesson_title}",
    "Short factual bullet point about {lesson_title}"
  ],
  "example": "One concrete real-world example or scenario demonstrating {lesson_title} in practice (2-3 sentences)",
  "trivia": "One surprising fact, piece of history, or interesting bit of context about {lesson_title} that makes it more memorable (1-2 sentences)",
  "tip": "One specific, actionable insight or practical tip about {lesson_title}"
}}"#
    );

    crate::commands::model::call_model(&base_url, &api_key, &model, system, &user, tier.as_deref()).await
}

#[tauri::command]
pub async fn generate_quiz(
    chapter_name: String,
    chapter_content: String,
    course_topic: String,
    base_url: String,
    api_key: String,
    model: String,
    tier: Option<String>,
) -> Result<String, AppError> {
    if chapter_content.trim().is_empty() {
        return Err(AppError::OutlineGenerationFailed("Chapter content cannot be empty".into()));
    }

    let system = "You are an expert assessment designer. You write clear, unambiguous multiple-choice \
quiz questions that test genuine understanding of the material. Each question has exactly four answer \
options with one unambiguously correct answer and three plausible but incorrect distractors. \
Return only valid JSON with no markdown fences or extra text.";

    let user = format!(
        r#"Based on the following content from the chapter "{chapter_name}" of a course about "{course_topic}", write 5 multiple-choice quiz questions that test understanding of the key concepts taught.

CHAPTER CONTENT:
{chapter_content}

Requirements:
- Write complete, self-contained questions that make sense on their own.
- Each question must have exactly 4 answer options.
- Exactly one option is correct; the other three are plausible distractors.
- Do not truncate or abbreviate any question or answer text — write full, natural sentences.
- Vary the question style (definitions, application, comparison, best-practice).
- Base every question strictly on the chapter content above.

Return this exact JSON structure with no other text:
{{
  "questions": [
    {{
      "question": "Full question text ending with a question mark?",
      "options": ["First option", "Second option", "Third option", "Fourth option"],
      "correctIndex": 0
    }}
  ]
}}

The "questions" array must contain exactly 5 questions. "correctIndex" is the 0-based index of the correct option."#
    );

    crate::commands::model::call_model(&base_url, &api_key, &model, system, &user, tier.as_deref()).await
}

#[tauri::command]
pub async fn generate_outline_direct(
    topic: String,
    audience: String,
    level: String,
    goal: String,
    base_url: String,
    api_key: String,
    model: String,
    tier: Option<String>,
) -> Result<String, AppError> {
    if topic.trim().is_empty() {
        return Err(AppError::OutlineGenerationFailed("Topic cannot be empty".into()));
    }

    let system = "You are a course curriculum designer. Output a course outline in Markdown. \
Use ## for chapter names and ### for lesson names only. \
No numbering prefixes, no em dashes, no bullet points, no intro text, no glossary, no extra sections. \
Output exactly 3 to 5 chapters, each with 3 to 5 lessons. Nothing else.";

    let user = format!(
        "Topic: {topic}\nAudience: {audience}\nLevel: {level}\nGoal: {goal}"
    );

    crate::commands::model::call_model(&base_url, &api_key, &model, system, &user, tier.as_deref()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fake_outline_returns_non_empty() {
        let result = generate_fake_outline(
            "Rust".into(),
            "Systems developers".into(),
            "intermediate".into(),
            "Write memory-safe code".into(),
        );
        assert!(result.is_ok());
        let outline = result.unwrap();
        assert!(!outline.is_empty());
        assert!(outline.contains("## Foundations of Rust"));
        assert!(outline.contains("### Introduction to Rust"));
    }

    #[test]
    fn fake_outline_includes_topic() {
        let result = generate_fake_outline(
            "TypeScript".into(),
            "JS developers".into(),
            "beginner".into(),
            "Add types to existing JS".into(),
        );
        assert!(result.unwrap().contains("TypeScript"));
    }

    #[test]
    fn empty_topic_returns_error() {
        let result = generate_fake_outline("".into(), "anyone".into(), "beginner".into(), "learn".into());
        assert!(result.is_err());
    }
}
