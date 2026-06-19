export type PlanId = 'free' | 'team' | 'business'

export interface Plan {
  id: PlanId
  name: string
  desc: string
  /** Monthly AI course generations; null = unlimited. */
  monthlyGenerations: number | null
  /** Included learner seats; null = unlimited. */
  seats: number | null
  features: string[]
  /**
   * Stripe Price ID for this plan, read from env at module load. Free has none.
   * When unset (no Stripe configured) checkout is unavailable for the plan.
   */
  stripePriceId?: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Starter',
    desc: 'For individuals and small teams trying out AI course creation.',
    monthlyGenerations: 5,
    seats: 10,
    features: [
      '5 AI course generations / month',
      'Up to 10 learner seats',
      'PDF & document import',
      'Chapter quizzes',
      'Progress tracking',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    desc: 'For teams that need more generations, seats, and admin controls.',
    monthlyGenerations: 100,
    seats: 50,
    features: [
      '100 AI course generations / month',
      'Up to 50 learner seats',
      'All import formats (video, audio)',
      'Custom AI model endpoint',
      'Admin dashboard & reports',
      'Priority support',
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM,
  },
  business: {
    id: 'business',
    name: 'Business',
    desc: 'For organisations that need unlimited generation and seats.',
    monthlyGenerations: null,
    seats: null,
    features: [
      'Unlimited AI course generations',
      'Unlimited learner seats',
      'Role-based access control',
      'Custom data retention',
      'SSO / SAML (on request)',
      'Dedicated onboarding',
    ],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS,
  },
}

export const PLAN_ORDER: PlanId[] = ['free', 'team', 'business']

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value === 'free' || value === 'team' || value === 'business'
}

export function getPlan(id: string | null | undefined): Plan {
  return isPlanId(id) ? PLANS[id] : PLANS.free
}

/** Maps a Stripe Price ID back to a plan id (used by the webhook). */
export function planIdForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null
  for (const id of PLAN_ORDER) {
    if (PLANS[id].stripePriceId && PLANS[id].stripePriceId === priceId) {
      return id
    }
  }
  return null
}
