// All courses are free in this deployment — there is no paid option and no prices
// are shown anywhere. These access helpers remain as a single source of truth so
// the enrollment and lesson flows have a stable seam: any enrolled learner has
// full access to every chapter, and nothing is ever locked behind payment.
//
// Signatures accept (and ignore) their former arguments so existing call sites
// keep compiling without per-site rewrites.

export function hasFullAccess(..._args: unknown[]): boolean {
  return true
}

export function isLessonLocked(..._args: unknown[]): boolean {
  return false
}
