/**
 * Límites y features por plan (Starter vs Profesional).
 * Usado para restringir funcionalidad según subscription_tier de la organización.
 */

export const PLAN_STARTER = 'starter'
export const PLAN_PROFESIONAL = 'profesional'

export type PlanTier = typeof PLAN_STARTER | typeof PLAN_PROFESIONAL

export type PlanLimits = {
  products: number | null
  branches: number | null
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  [PLAN_STARTER]: {
    products: 700,
    branches: 1,
  },
  [PLAN_PROFESIONAL]: {
    products: null,
    branches: null,
  },
}

export type PlanFeature =
  | 'transfers'
  | 'cash_register'
  | 'advanced_reports'
  | 'custom_store'
  | 'notifications_config'

/** Tier mínimo requerido para cada feature */
export const PLAN_FEATURES: Record<PlanFeature, PlanTier> = {
  transfers: PLAN_PROFESIONAL,
  cash_register: PLAN_PROFESIONAL,
  advanced_reports: PLAN_PROFESIONAL,
  custom_store: PLAN_PROFESIONAL,
  notifications_config: PLAN_PROFESIONAL,
}

const TIER_ORDER: Record<string, number> = {
  [PLAN_STARTER]: 1,
  [PLAN_PROFESIONAL]: 2,
}

export function getPlanLimits(tier: string): PlanLimits {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS[PLAN_STARTER]
}

export function canUseFeature(tier: string, feature: PlanFeature): boolean {
  const minTier = PLAN_FEATURES[feature]
  if (!minTier) return true
  const tierLevel = TIER_ORDER[tier] ?? 0
  const minLevel = TIER_ORDER[minTier] ?? 0
  return tierLevel >= minLevel
}

export function getProductLimit(tier: string): number | null {
  return getPlanLimits(tier).products
}

export function getBranchLimit(tier: string): number | null {
  return getPlanLimits(tier).branches
}

/** Máximo de imágenes por producto según el plan: Starter 1, Profesional 3 */
export function getMaxProductImages(tier: string): number {
  return tier === PLAN_PROFESIONAL ? 3 : 1
}
