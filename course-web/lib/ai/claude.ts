import Anthropic from '@anthropic-ai/sdk'
import { JsonChatProvider, SYSTEM_PROMPT } from './base'

const MODEL = 'claude-haiku-4-5-20251001'

export class ClaudeAIProvider extends JsonChatProvider {
  private client: Anthropic

  constructor() {
    super()
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  protected async complete(prompt: string, system?: string): Promise<string> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: system ?? SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type !== 'text') {
      throw new Error('Unexpected content block type from Claude API')
    }
    return block.text
  }
}
