import { JsonChatProvider, SYSTEM_PROMPT } from './base'

export interface OpenAICompatibleConfig {
  baseURL: string
  apiKey: string
  model: string
  /** Compute tier for the on-prem DGX/vLLM cluster (sent as X-LLM-Tier). Empty = hosted provider. */
  tier?: string
  /** Request timeout in ms (on-prem clusters can be slow). */
  timeoutMs?: number
}

/**
 * Talks to any OpenAI-compatible chat-completions endpoint — OpenAI, DeepSeek,
 * Qwen/DashScope, or the on-prem DGX Spark vLLM cluster. Mirrors the desktop app's
 * Rust `call_model`: POST {baseURL}/v1/chat/completions, bearer auth, and — only for
 * the on-prem vLLM case (a tier set on an http base) — send the X-LLM-Tier header and
 * disable Qwen thinking so the reply is clean JSON instead of a reasoning ramble.
 */
export class OpenAICompatibleProvider extends JsonChatProvider {
  private cfg: OpenAICompatibleConfig

  constructor(cfg: OpenAICompatibleConfig) {
    super()
    this.cfg = cfg
  }

  protected async complete(prompt: string, system?: string): Promise<string> {
    const base = this.cfg.baseURL.replace(/\/+$/, '')
    const url = `${base}/v1/chat/completions`

    // A tier on an http(non-TLS) base signals the on-prem vLLM cluster. Hosted
    // providers (https) never see the tier header or the thinking-disable kwarg.
    const isVllm = !!this.cfg.tier && base.startsWith('http://')

    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: [
        { role: 'system', content: system ?? SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
      max_tokens: 4096,
    }
    if (isVllm) {
      body.chat_template_kwargs = { enable_thinking: false }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`
    if (isVllm && this.cfg.tier) headers['X-LLM-Tier'] = this.cfg.tier

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 120_000)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '')
        throw new Error(`Model endpoint ${url} returned ${resp.status}: ${detail.slice(0, 200)}`)
      }
      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('Model response had no message content')
      return content
    } finally {
      clearTimeout(timeout)
    }
  }
}
