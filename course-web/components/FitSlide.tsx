'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Treats its child as a fixed-width "slide canvas" (DESIGN_W) and scales it
 * uniformly — UP to fill a large display, or DOWN to fit a small one — so the
 * whole slide fills the available area without scrolling (PowerPoint-style).
 *
 * Why a fixed design width rather than width:100%? With width:100% the content
 * always equals the container width, so the width ratio is permanently ~1 and
 * the slide could only ever shrink, never grow — on a big monitor it sat tiny
 * and centered. Measuring against a design width lets it scale past 1.
 *
 * scrollHeight/clientWidth are layout (pre-transform) sizes, so there's no
 * feedback loop with the applied scale.
 */
const DESIGN_W = 1800
const MAX_SCALE = 1.15
// Scale to fit so content never clips. The floor only catches pathologically
// long lessons (which then scroll inside the slide body); the layouts are kept
// landscape/short so real lessons fit comfortably above this.
const MIN_SCALE = 0.6

export function FitSlide({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [scrolls, setScrolls] = useState(false)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const fit = () => {
      const availH = outer.clientHeight
      const availW = outer.clientWidth
      const contentH = inner.scrollHeight
      // On narrow viewports the canvas falls back to 100% (min(1280px,100%)),
      // so use its actual laid-out width as the design width.
      const designW = inner.clientWidth || DESIGN_W
      if (!availH || !contentH || !availW) return
      const raw = Math.min(availW / designW, availH / contentH)
      if (!Number.isFinite(raw) || raw <= 0) return
      setScale(Math.min(MAX_SCALE, Math.max(raw, MIN_SCALE)))
      // If even at the floor the content is taller than the viewport, let it
      // scroll rather than clip.
      setScrolls(raw < MIN_SCALE)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={outerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: scrolls ? 'auto' : 'hidden',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: 'min(1800px, 100%)',
          flexShrink: 0,
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
