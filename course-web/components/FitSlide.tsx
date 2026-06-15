'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Scales its child down uniformly so the whole slide fits the available area
 * without scrolling (PowerPoint-style). Measures the child's natural size
 * (scrollHeight/Width are unaffected by the transform, so there's no feedback
 * loop) against the container and applies a transform: scale().
 */
export function FitSlide({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const fit = () => {
      const availH = outer.clientHeight
      const availW = outer.clientWidth
      const contentH = inner.scrollHeight
      const contentW = inner.scrollWidth
      if (!availH || !contentH || !contentW) return
      const next = Math.min(1, availH / contentH, availW / contentW)
      // Don't shrink below 0.5 — beyond that text gets unreadable; the rare
      // ultra-dense slide will scroll instead.
      setScale(Number.isFinite(next) && next > 0 ? Math.max(next, 0.5) : 1)
    }

    // The flex height constraint + async content/font load aren't settled on the
    // first layout pass, and a ResizeObserver doesn't reliably catch the settle,
    // so converge by re-measuring on a short poll for the first ~1.6s, then rely
    // on the observer + window resize for anything after that.
    const raf = requestAnimationFrame(() => requestAnimationFrame(fit))
    const poll = window.setInterval(fit, 150)
    const stop = window.setTimeout(() => window.clearInterval(poll), 1600)
    const ro = new ResizeObserver(fit)
    ro.observe(outer)
    ro.observe(inner)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(poll)
      window.clearTimeout(stop)
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
    // Run once on mount; the ResizeObserver handles content/size changes afterward.
    // (Depending on `children` here tore the effect down on every parent re-render,
    // cancelling the poll before it could converge.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={outerRef}
      style={{ flex: 1, minHeight: 0, overflow: scale > 0.5 ? 'hidden' : 'auto', display: 'flex', justifyContent: 'center' }}
    >
      <div
        ref={innerRef}
        style={{
          width: '100%',
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
          transition: 'transform 0.2s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}
