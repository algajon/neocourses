import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { getStripe, isBillingEnabled, getPlan, isPlanId } from '@/lib/billing'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const stripe = getStripe()
  if (!isBillingEnabled() || !stripe) {
    return NextResponse.json(
      { error: 'Billing is not configured.' },
      { status: 501 },
    )
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const planId = typeof body?.plan === 'string' ? body.plan : ''
  if (!isPlanId(planId) || planId === 'free') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const plan = getPlan(planId)
  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for the ${plan.name} plan.` },
      { status: 501 },
    )
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Reuse an existing Stripe customer, otherwise create one and persist its id.
  let customerId = org.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organizationId: org.id },
    })
    customerId = customer.id
    await db
      .update(organizations)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(organizations.id, org.id))
  }

  const origin =
    req.headers.get('origin') ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    // The webhook is the source of truth; metadata lets it attribute the sub.
    subscription_data: { metadata: { organizationId: org.id, plan: planId } },
    metadata: { organizationId: org.id, plan: planId },
    success_url: `${origin}/admin/billing?checkout=success`,
    cancel_url: `${origin}/admin/billing?checkout=cancelled`,
  })

  return NextResponse.json({ url: checkout.url })
}
