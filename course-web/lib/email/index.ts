import { getEmailProvider, isEmailEnabled, emailFrom } from './providers'
import type { EmailMessage } from './types'

export * from './types'
export * from './templates'
export { getEmailProvider, isEmailEnabled, emailFrom }

/**
 * Sends an email via the configured provider. Best-effort: with no RESEND_API_KEY
 * the Noop provider just logs, and any send error is swallowed and logged so email
 * never blocks or breaks the calling request. Returns true if the send succeeded.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await getEmailProvider().send(message)
    return true
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[email] send failed to=${message.to}: ${detail}`)
    return false
  }
}
