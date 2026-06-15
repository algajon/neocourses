import { invoke } from '@tauri-apps/api/core';
import { ModelSettings, AppError } from './types';
import { LessonContent, QuizQuestion } from './contentGenerator';
import { fromUnknown } from './errors';
import type { StartPairingResponse, CourseSummary } from '@courseneo/shared';

// The compute tier + thinking-disable only apply to the on-prem vLLM cluster
// (served over http on the LAN). Hosted providers (https) reject those, so we
// send `tier` only for the local cluster; undefined → None on the Rust side.
function localTier(settings: ModelSettings): string | undefined {
  return settings.baseUrl.trim().startsWith('http://') ? settings.tier : undefined;
}

export type ModelTestResult = { ok: true; reply: string } | { ok: false; error: AppError };

export async function testModelEndpoint(settings: ModelSettings): Promise<ModelTestResult> {
  try {
    const reply = await invoke<string>('test_model_endpoint', {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      tier: localTier(settings),
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
      tier: localTier(settings),
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
      tier: localTier(settings),
    });
    const content = parseLessonContentJson(raw);
    if (!content) return { ok: false, error: { code: 'MODEL_PARSE_FAILED', message: 'Invalid lesson content JSON' } };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

function parseQuizJson(raw: string): QuizQuestion[] | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const p = JSON.parse(cleaned);
    const list = Array.isArray(p) ? p : p.questions;
    if (!Array.isArray(list) || list.length === 0) return null;

    const questions: QuizQuestion[] = [];
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (
        typeof q?.question === 'string' &&
        Array.isArray(q?.options) &&
        q.options.length >= 2 &&
        q.options.every((o: unknown) => typeof o === 'string') &&
        typeof q?.correctIndex === 'number' &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
      ) {
        questions.push({
          id: `aiq${i + 1}`,
          question: q.question.trim(),
          options: q.options.map((o: string) => o.trim()),
          correctIndex: q.correctIndex,
        });
      }
    }
    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

export async function generateChapterQuizAI(
  chapterName: string,
  chapterContent: string,
  courseTopic: string,
  settings: ModelSettings
): Promise<{ ok: true; questions: QuizQuestion[] } | { ok: false; error: AppError }> {
  try {
    const raw = await invoke<string>('generate_quiz', {
      chapterName,
      chapterContent,
      courseTopic,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      tier: localTier(settings),
    });
    const questions = parseQuizJson(raw);
    if (!questions) return { ok: false, error: { code: 'MODEL_PARSE_FAILED', message: 'Invalid quiz JSON' } };
    return { ok: true, questions };
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
      tier: localTier(settings),
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

export async function startPairing(
  requirePin: boolean,
  useTunnel: boolean
): Promise<{ ok: true; pairing: StartPairingResponse } | { ok: false; error: AppError }> {
  try {
    const pairing = await invoke<StartPairingResponse>('start_pairing', { requirePin, useTunnel });
    return { ok: true, pairing };
  } catch (err) {
    return { ok: false, error: fromUnknown(err) };
  }
}

export async function stopPairing(): Promise<void> {
  try {
    await invoke('stop_pairing');
  } catch {
    // best-effort teardown
  }
}

export async function syncPairingCourses(courses: CourseSummary[]): Promise<void> {
  try {
    await invoke('sync_pairing_courses', { courses });
  } catch {
    // best-effort; the phone simply sees a stale/empty list until next sync
  }
}

export async function cancelJob(jobId: string): Promise<void> {
  try {
    await invoke('cancel_job', { jobId });
  } catch {
    // best-effort
  }
}
