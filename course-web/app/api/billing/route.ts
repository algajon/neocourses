import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { getOrgPlan, getUsage, isBillingEnabled, PLAN_ORDER, PLANS } from '@/lib/billing'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = session.user.organizationId
  const [{ planId, status }, usage] = await Promise.all([
    getOrgPlan(orgId),
    getUsage(orgId),
  ])

  return NextResponse.json({
    billingEnabled: isBillingEnabled(),
    planId,
    status,
    usage: { used: usage.used, limit: usage.limit, period: usage.period },
    plans: PLAN_ORDER.map((id) => {
      const p = PLANS[id]
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        priceSub: p.priceSub,
        desc: p.desc,
        monthlyGenerations: p.monthlyGenerations,
        seats: p.seats,
        features: p.features,
        checkoutAvailable: id !== 'free' && !!p.stripePriceId,
      }
    }),
  })
}
