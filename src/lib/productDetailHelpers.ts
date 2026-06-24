// ─── Pure helpers for AdminProductDetail ─────────────────────────────────────
// These functions contain no side effects and no framework dependencies.
// They are extracted from useProductHeader so they can be unit-tested independently.

/**
 * Calculates the weighted-average cost across all branch inventory rows.
 *
 * @param rows - Array of { stock, cost } pairs. `stock` and `cost` may be null/undefined
 *               (treated as 0).
 * @returns The weighted average cost, or null when total stock is 0
 *          (would be a divide-by-zero situation).
 */
export function calcWeightedAvgCost(
  rows: Array<{ stock: number | null | undefined; cost: number | null | undefined }>
): number | null {
  const totalStock = rows.reduce((sum, r) => sum + (r.stock ?? 0), 0)

  if (totalStock <= 0) return null

  const weightedSum = rows.reduce(
    (sum, r) => sum + (r.stock ?? 0) * (r.cost ?? 0),
    0
  )

  return weightedSum / totalStock
}

// ─── Margin classification ────────────────────────────────────────────────────

type MarginColor = 'green' | 'yellow' | 'red'

interface MarginResult {
  pct: number | null
  color: MarginColor | null
}

function classifyMargin(pct: number): MarginColor {
  if (pct >= 40) return 'green'
  if (pct >= 20) return 'yellow'
  return 'red'
}

/**
 * Calculates the gross margin percentage and classifies it for display.
 *
 * Thresholds:
 *   ≥ 40% → green
 *   20 – 39.9% → yellow
 *   < 20% → red  (includes negative)
 *
 * Guards:
 *   - `price === 0` → returns null (divide-by-zero)
 *   - `costPerUnit === null` → returns null (unknown cost)
 *
 * @param price       - The effective selling price (must be > 0 to produce a result).
 * @param costPerUnit - The weighted average cost, or null when unknown.
 */
export function calcMargin(
  price: number,
  costPerUnit: number | null
): MarginResult {
  if (price === 0 || costPerUnit === null) return { pct: null, color: null }

  const pct = ((price - costPerUnit) / price) * 100
  return { pct, color: classifyMargin(pct) }
}
