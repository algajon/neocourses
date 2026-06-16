// Deterministic, on-brand course gradient. Given a stable seed (the course id),
// always returns the same tasteful gradient — a "one-time generated" visual that
// needs no storage. Used as the course banner/thumbnail when no image is uploaded.

// Rich, dark-friendly palettes (each: two or three stops). Tuned to sit behind
// light text and to complement the lime brand accent without clashing.
const PALETTES: string[][] = [
  ['#1b2a4a', '#2d1b4a', '#0d0d0d'],
  ['#13343b', '#1b4a3a', '#0d0d0d'],
  ['#3a1b2d', '#4a2d1b', '#0d0d0d'],
  ['#1b2a4a', '#13343b', '#0d0d0d'],
  ['#2d2a1b', '#4a3a1b', '#0d0d0d'],
  ['#2d1b4a', '#1b2a4a', '#0d0d0d'],
  ['#1b3a4a', '#1b2a4a', '#0d0d0d'],
  ['#3a2d4a', '#1b2a3a', '#0d0d0d'],
]

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** CSS linear-gradient for a course, stable per seed. */
export function courseGradient(seed: string): string {
  const h = hash(seed || 'courseneo')
  const palette = PALETTES[h % PALETTES.length]
  const angle = 100 + (h % 80) // 100–180deg
  const stops = palette.map((c, i) => `${c} ${Math.round((i / (palette.length - 1)) * 100)}%`)
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`
}

/** A second-stop accent color for the seed (for subtle decorative dots/glows). */
export function courseAccent(seed: string): string {
  const h = hash(seed || 'courseneo')
  return PALETTES[h % PALETTES.length][1]
}
