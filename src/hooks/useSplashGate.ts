import { useEffect, useState } from 'react'
import { getSplashRemainingMs } from '@/lib/splash'

// Measured from page navigation start (performance.now), not from mount, so the
// app-level and store-level loaders share one minimum instead of stacking two.
export function useSplashGate(loading: boolean): boolean {
  const [minElapsed, setMinElapsed] = useState(() => getSplashRemainingMs(performance.now()) === 0)

  useEffect(() => {
    if (minElapsed) return
    const timer = setTimeout(() => setMinElapsed(true), getSplashRemainingMs(performance.now()))
    return () => clearTimeout(timer)
  }, [minElapsed])

  return loading || !minElapsed
}
