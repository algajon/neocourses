'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import styles from './page.module.css'

interface PlanCard {
  id: 'free' | 'team' | 'business'
  name: string
  desc: string
  monthlyGenerations: number | null
  seats: number | null
  features: string[]
  checkoutAvailable: boolean
}

interface BillingData {
  billingEnabled: boolean
  planId: 'free' | 'team' | 'business'
  status: string
  usage: { used: number; limit: number | null; period: string }
  plans: PlanCard[]
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/billing')
        if (!res.ok) throw new Error('Failed to load billing')
        setData(await res.json())
      } catch {
        setError('Could not load billing information.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function startCheckout(planId: string) {
    setError('')
    setCheckoutFor(planId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Checkout failed')
      if (body.url) {
        window.location.href = body.url
        return
      }
      throw new Error('No checkout URL returned')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setCheckoutFor(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Loading…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error || 'Billing unavailable.'}</div>
      </div>
    )
  }

  const limitLabel = data.usage.limit == null ? '∞' : String(data.usage.limit)
  const pct =
    data.usage.limit == null || data.usage.limit === 0
      ? 0
      : Math.min(100, Math.round((data.usage.used / data.usage.limit) * 100))

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Admin / Billing</div>
      <div className={styles.header}>
        <h1>Billing &amp; plans</h1>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {!data.billingEnabled && (
        <div className={styles.notice}>
          <Icon name="info" size={15} />
          <span>
            Billing is not configured. Every organization is on a generous Free
            plan and all limits are lifted.
          </span>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Current plan</h2>
          <p className={styles.cardDesc}>
            Your subscription and AI generation usage this period.
          </p>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.currentRow}>
            <div>
              <div className={styles.currentPlanName}>
                {data.plans.find((p) => p.id === data.planId)?.name ?? data.planId}
              </div>
              <div className={styles.currentStatus}>Status: {data.status}</div>
            </div>
          </div>

          <div className={styles.usageBlock}>
            <div className={styles.usageLabel}>
              AI course generations ({data.usage.period})
            </div>
            <div className={styles.usageValue}>
              {data.usage.used} / {limitLabel}
            </div>
            {data.usage.limit != null && (
              <div className={styles.usageBar}>
                <div className={styles.usageBarFill} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.plansGrid}>
        {data.plans.map((plan) => {
          const isCurrent = plan.id === data.planId
          return (
            <div
              key={plan.id}
              className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}
            >
              {isCurrent && <div className={styles.currentBadge}>Current</div>}
              <div className={styles.planName}>{plan.name}</div>
              <p className={styles.planDesc}>{plan.desc}</p>

              {plan.id === 'free' || isCurrent ? (
                <button className="btn-secondary" disabled>
                  {isCurrent ? 'Current plan' : plan.name}
                </button>
              ) : !data.billingEnabled ? (
                <button className="btn-secondary" disabled title="Billing not configured">
                  Billing not configured
                </button>
              ) : !plan.checkoutAvailable ? (
                <button className="btn-secondary" disabled title="No price configured">
                  Unavailable
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => startCheckout(plan.id)}
                  disabled={checkoutFor !== null}
                >
                  {checkoutFor === plan.id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </button>
              )}

              <div className={styles.planDivider} />
              <ul className={styles.featureList}>
                {plan.features.map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <span className={styles.check}>
                      <Icon name="check" size={14} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
