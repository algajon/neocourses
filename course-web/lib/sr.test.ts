import { describe, it, expect } from 'vitest'
import { nextReview } from './sr'

describe('nextReview', () => {
  it('grade 0 resets interval to 0 (see again today)', () => {
    const r = nextReview({ ease: 2.5, intervalDays: 30 }, 0)
    expect(r.intervalDays).toBe(0)
  })

  it('grows the interval as the prior interval grows on a good grade', () => {
    const r = nextReview({ ease: 2.5, intervalDays: 10 }, 2)
    expect(r.intervalDays).toBe(Math.round(10 * r.ease))
    expect(r.intervalDays).toBeGreaterThan(10)
  })

  it('ramps a fresh card through the early steps', () => {
    const fresh = nextReview({ ease: 2.5, intervalDays: 0 }, 2)
    expect(fresh.intervalDays).toBe(1)
    const second = nextReview({ ease: 2.5, intervalDays: 1 }, 2)
    expect(second.intervalDays).toBe(4)
    const easyFresh = nextReview({ ease: 2.5, intervalDays: 0 }, 3)
    expect(easyFresh.intervalDays).toBe(3)
  })

  it('floors ease at 1.3 after repeated failures', () => {
    let state = { ease: 1.3, intervalDays: 5 }
    for (let i = 0; i < 10; i++) {
      const r = nextReview(state, 0)
      state = { ease: r.ease, intervalDays: r.intervalDays }
    }
    expect(state.ease).toBeGreaterThanOrEqual(1.3)
    expect(state.ease).toBeCloseTo(1.3, 5)
  })

  it('easy grades increase ease relative to good grades', () => {
    const good = nextReview({ ease: 2.5, intervalDays: 10 }, 2)
    const easy = nextReview({ ease: 2.5, intervalDays: 10 }, 3)
    expect(easy.ease).toBeGreaterThan(good.ease)
  })

  it('returns a dueAt that matches the computed interval', () => {
    const r = nextReview({ ease: 2.5, intervalDays: 10 }, 2)
    const expected = new Date()
    expected.setDate(expected.getDate() + r.intervalDays)
    // Compare on the day granularity to avoid millisecond flakiness.
    expect(r.dueAt.toDateString()).toBe(expected.toDateString())
  })
})
