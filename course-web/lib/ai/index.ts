import type { AIProvider } from './types'
import { ClaudeAIProvider } from './claude'
import { OpenAICompatibleProvider } from './openai-compatible'
import { MockAIProvider } from './mock'

/**
 * Provider selection, highest priority first:
 *  1. MODEL_BASE_URL + MODEL_API_KEY  → OpenAI-compatible (OpenAI, DeepSeek, Qwen,
 *     or the on-prem DGX Spark vLLM cluster — same wiring as the desktop app).
 *  2. ANTHROPIC_API_KEY               → Claude.
 *  3. nothing configured              → deterministic mock content.
 */
export function getAIProvider(): AIProvider {
  const baseURL = process.env.MODEL_BASE_URL?.trim()
  if (baseURL) {
    return new OpenAICompatibleProvider({
      baseURL,
      apiKey: process.env.MODEL_API_KEY?.trim() ?? '',
      model: process.env.MODEL_NAME?.trim() || 'gpt-4o-mini',
      tier: process.env.MODEL_TIER?.trim() || undefined,
    })
  }

  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') {
    return new ClaudeAIProvider()
  }

  return new MockAIProvider()
}

export type { AIProvider } from './types'
export type { LessonContent, CourseOutline, FullLessonContent, QuizQuestion, ChecklistItem } from './types'
