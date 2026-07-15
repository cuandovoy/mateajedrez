import type { OrganizationSettings } from '@/types/database.types'

type RawSettings = OrganizationSettings | Record<string, unknown> | null | undefined

/**
 * Solo el literal `false` deshabilita el módulo de sucursales (default opt-out: true).
 */
export function resolveBranchesEnabled(settings: RawSettings): boolean {
  return ((settings as Record<string, unknown> | null | undefined)?.branches_enabled as boolean) !== false
}

/**
 * Valor crudo almacenado para transferencias, sin aplicar la cascada de sucursales.
 * Solo el literal `false` deshabilita (default opt-out: true).
 */
export function resolveTransfersEnabledRaw(settings: RawSettings): boolean {
  return ((settings as Record<string, unknown> | null | undefined)?.transfers_enabled as boolean) !== false
}

/**
 * Valor efectivo de transferencias aplicando la cascada: si sucursales está
 * deshabilitado, transferencias queda deshabilitado independientemente de su
 * propio valor almacenado.
 */
export function resolveTransfersEnabled(settings: RawSettings): boolean {
  return resolveBranchesEnabled(settings) && resolveTransfersEnabledRaw(settings)
}
