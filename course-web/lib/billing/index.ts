import { and, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { organizations, usageCounters } from '@/lib/db/schema'
import { getPlan, type Plan, type PlanId } from './plans'
import { isBillingEnabled } from './stripe'

export { isBillingEnabled, getStripe, getWebhookSecret } from './stripe'
export { PLANS, PLAN_ORDER, getPlan, planIdForPriceId, isPlanId } from './plans'
export type { Plan, PlanId } from './plans'

/** First day of the current month (UTC) as YYYY-MM, used as the period key. */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export interface OrgPlanInfo {
  plan: Plan
  planId: PlanId
  status: string
  billingEnabled: boolean
}

/**
 * Resolves an org's plan. In billing-disabled mode every org is reported on a
 * generous Free plan with limits removed so all gates pass.
 */
export async function getOrgPlan(orgId: string | null | undefined): Promise<OrgPlanInfo> {
  const billingEnabled = isBillingEnabled()

  if (!billingEnabled || !orgId) {
    const free = getPlan('free')
    return {
      // Unlimited generations/seats when billing is off — gates must always pass.
      plan: { ...free, monthlyGenerations: null, seats: null },
      planId: 'free',
      status: 'active',
      billingEnabled,
    }
  }

  const [org] = await db
    .select({ plan: organizations.plan, status: organizations.planStatus })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)

  const planId = (org?.plan ?? 'free') as PlanId
  return {
    plan: getPlan(planId),
    planId,
    status: org?.status ?? 'active',
    billingEnabled,
  }
}

export interface UsageInfo {
  used: number
  limit: number | null
  period: string
}

/** Reads the current period's generation usage (0 when no row yet). */
export async function getUsage(orgId: string | null | undefined): Promise<UsageInfo> {
  const { plan } = await getOrgPlan(orgId)
  const period = currentPeriod()

  if (!orgId) {
    return { used: 0, limit: plan.monthlyGenerations, period }
  }

  const [row] = await db
    .select({ used: usageCounters.generationsUsed })
    .from(usageCounters)
    .where(and(eq(usageCounters.organizationId, orgId), eq(usageCounters.periodStart, period)))
    .limit(1)

  return { used: row?.used ?? 0, limit: plan.monthlyGenerations, period }
}

export interface GenerationGate {
  allowed: boolean
  used: number
  limit: number | null
  reason?: string
}

/**
 * Whether the org may run another AI generation this period. Always true when
 * billing is disabled or the plan has an unlimited (null) generation limit.
 */
export async function canGenerate(orgId: string | null | undefined): Promise<GenerationGate> {
  const { plan, billingEnabled } = await getOrgPlan(orgId)

  if (!billingEnabled || plan.monthlyGenerations == null) {
    const usage = await getUsage(orgId)
    return { allowed: true, used: usage.used, limit: plan.monthlyGenerations }
  }

  const usage = await getUsage(orgId)
  if (usage.used >= plan.monthlyGenerations) {
    return {
      allowed: false,
      used: usage.used,
      limit: plan.monthlyGenerations,
      reason: `You have used all ${plan.monthlyGenerations} AI course generations on the ${plan.name} plan this month. Upgrade your plan to generate more.`,
    }
  }
  return { allowed: true, used: usage.used, limit: plan.monthlyGenerations }
}

/**
 * Increments the org's generation count for the current period (upsert). No-op
 * when billing is disabled or there is no org to attribute usage to.
 */
export async function recordGeneration(orgId: string | null | undefined): Promise<void> {
  if (!isBillingEnabled() || !orgId) return

  const period = currentPeriod()
  const now = new Date()

  await db
    .insert(usageCounters)
    .values({
      id: uuidv4(),
      organizationId: orgId,
      periodStart: period,
      generationsUsed: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [usageCounters.organizationId, usageCounters.periodStart],
      set: {
        generationsUsed: sql`${usageCounters.generationsUsed} + 1`,
        updatedAt: now,
      },
    })
}
