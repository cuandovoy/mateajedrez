// Minimum time the initial BrandLoader stays on screen so its animation can play.
export const SPLASH_MIN_MS = 1000

export function getSplashRemainingMs(elapsedMs: number, minMs: number = SPLASH_MIN_MS): number {
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return minMs
  return Math.max(0, minMs - elapsedMs)
}
