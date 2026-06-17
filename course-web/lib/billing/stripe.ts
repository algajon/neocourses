import Stripe from 'stripe'

/**
 * Billing is OPTIONAL. When STRIPE_SECRET_KEY is absent the whole feature runs in
 * "disabled" mode: every org is treated as a generous Free plan, all gates pass,
 * and the UI shows "Billing not configured." This mirrors the lib/ai/mock.ts
 * graceful-degradation pattern.
 */
export function isBillingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim()
}

let cached: Stripe | null = null

/** Returns a Stripe client, or null when no secret key is configured. */
export function getStripe(): Stripe | null {
  if (!isBillingEnabled()) return null
  if (cached) return cached
  cached = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), {
    apiVersion: '2024-06-20' as NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion'],
    appInfo: { name: 'courseneo' },
  })
  return cached
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null
}
