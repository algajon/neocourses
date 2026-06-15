import type { EmailMessage, EmailProvider } from './types'

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || 'courseneo <noreply@example.com>'
}

/**
 * Logs the email instead of sending it. Used whenever RESEND_API_KEY is absent
 * so the app degrades gracefully in dev / unconfigured deployments — mirrors the
 * /api/tts 501 fallback and lib/ai/mock.ts behaviour.
 */
export class NoopProvider implements EmailProvider {
  readonly name = 'noop'

  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email:noop] would send to=${message.to} subject=${JSON.stringify(message.subject)} (no RESEND_API_KEY set)`
    )
  }
}

export class ResendProvider implements EmailProvider {
  readonly name = 'resend'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Resend request failed (${res.status}): ${detail.slice(0, 200)}`)
    }
  }
}

let cached: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY?.trim()
  cached = key ? new ResendProvider(key) : new NoopProvider()
  return cached
}

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY?.trim()
}
