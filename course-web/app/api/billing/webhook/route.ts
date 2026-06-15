import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { getStripe, getWebhookSecret, isBillingEnabled, planIdForPriceId } from '@/lib/billing'

// Stripe needs the raw, unparsed body to verify the signature.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = getWebhookSecret()

  // No-op stub when billing isn't configured — acknowledge so Stripe (if ever
  // pointed here) doesn't retry, but do nothing.
  if (!isBillingEnabled() || !stripe || !webhookSecret) {
    return NextResponse.json({ received: true, disabled: true }, { status: 200 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      }
      default:
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const orgId =
    (sub.metadata?.organizationId as string | undefined) ?? null
  const priceId = sub.items.data[0]?.price?.id ?? null
  const planId = planIdForPriceId(priceId)

  // Locate the org by metadata, falling back to the Stripe customer id.
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const whereClause = orgId
    ? eq(organizations.id, orgId)
    : eq(organizations.stripeCustomerId, customerId)

  const canceled = sub.status === 'canceled' || sub.cancel_at_period_end

  await db
    .update(organizations)
    .set({
      plan: canceled ? 'free' : planId ?? 'free',
      planStatus: sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      updatedAt: new Date(),
    })
    .where(whereClause)
}
