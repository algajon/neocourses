Generate a course outline brief for neoCourses without opening the UI.

Topic/details: $ARGUMENTS

Parse the input to extract:
- **topic** — the subject of the course
- **audience** — who it's for (default: "General audience" if not specified)
- **level** — beginner / intermediate / advanced (default: beginner)
- **goal** — what learners will achieve (infer from topic if not given)

Check `course-studio/src/store/useSettingsStore.ts` to understand the settings shape, then:

- If an API key is configured in settings: the app would call `generate_outline_direct` (Tauri → Rust → OpenAI API). Simulate this by producing a factual, topic-specific outline with real chapter and lesson names.
- If no API key: the app falls back to `generate_fake_outline` which produces a generic 3-chapter template. Simulate the fallback instead.

Produce a well-structured Markdown outline in this exact format:

```
## Chapter Name
### Lesson Title
### Lesson Title

## Chapter Name
### Lesson Title
```

Rules:
- `##` headings = chapter names, `###` headings = lesson names
- No number prefixes (no "1.", "1.1", "Chapter 1:")
- No em dashes in names
- No bullet points, no intro text, no glossary sections
- 3–5 chapters, 3–5 lessons each
- Lesson names should be specific to the topic (not generic like "Introduction" or "Review")

Output the outline as a fenced markdown code block so the user can copy-paste it directly into the OutlineEditor.
