import { invoke } from '@tauri-apps/api/core';
import { ModelSettings, AppError } from './types';
import { LessonContent } from './contentGenerator';
import { fromUnknown } from './errors';

export type ModelTestResult = { ok: true; reply: string } | { ok: false; error: AppError };

export async function testModelEndpoint(settings: ModelSettings): Promise<ModelTestResult> {
  try {
    const reply = await invoke<string>('test_model_endpoint', {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    });
    return { ok: true, reply };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

export type OutlineResult = { ok: true; jobId: string } | { ok: false; error: AppError };

export async function generateOutlineWithModel(
  topic: string,
  audience: string,
  level: string,
  goal: string,
  settings: ModelSettings
): Promise<OutlineResult> {
  try {
    const jobId = await invoke<string>('generate_outline_with_model', {
      topic,
      audience,
      level,
      goal,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    });
    return { ok: true, jobId };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

function parseLessonContentJson(raw: string): LessonContent | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const p = JSON.parse(cleaned);
    if (typeof p.intro === 'string' && Array.isArray(p.concepts) && typeof p.tip === 'string') {
      return p as LessonContent;
    }
  } catch { /* fall through */ }
  return null;
}

export async function generateLessonContentAI(
  lessonTitle: string,
  chapterName: string,
  courseTopic: string,
  settings: ModelSettings
): Promise<{ ok: true; content: LessonContent } | { ok: false; error: AppError }> {
  try {
    const raw = await invoke<string>('generate_lesson_content', {
      lessonTitle,
      chapterName,
      courseTopic,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    });
    const content = parseLessonContentJson(raw);
    if (!content) return { ok: false, error: { code: 'MODEL_PARSE_FAILED', message: 'Invalid lesson content JSON' } };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

export async function generateOutlineDirect(
  topic: string,
  audience: string,
  level: string,
  goal: string,
  settings: ModelSettings
): Promise<{ ok: true; outline: string } | { ok: false; error: AppError }> {
  try {
    const outline = await invoke<string>('generate_outline_direct', {
      topic,
      audience,
      level,
      goal,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    });
    return { ok: true, outline };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

export async function generateFakeOutline(
  topic: string,
  audience: string,
  level: string,
  goal: string
): Promise<{ ok: true; outline: string } | { ok: false; error: AppError }> {
  try {
    const outline = await invoke<string>('generate_fake_outline', {
      topic,
      audience,
      level,
      goal,
    });
    return { ok: true, outline };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

export async function exportMarkdown(
  filename: string,
  content: string
): Promise<{ ok: true; path: string } | { ok: false; error: AppError }> {
  try {
    const path = await invoke<string>('export_markdown', { filename, content });
    return { ok: true, path };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

export async function cancelJob(jobId: string): Promise<void> {
  try {
    await invoke('cancel_job', { jobId });
  } catch {
    // best-effort
  }
}
