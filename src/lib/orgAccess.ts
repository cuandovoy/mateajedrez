/**
 * Lógica de acceso a la organización según estado de suscripción.
 *
 * Estados:
 *  - trialing   → dentro del período de trial de 10 días
 *  - active     → suscripción paga y vigente (con 10 días de gracia)
 *  - blocked    → trial o gracia vencidos, sin pago registrado
 */

export type OrgAccessStatus = 'trialing' | 'active' | 'blocked'

export interface OrgAccessInfo {
  status: OrgAccessStatus
  /** Días restantes hasta el bloqueo (trial o gracia) */
  daysLeft: number
  /** true si está dentro del período de gracia post-vencimiento */
  inGracePeriod: boolean
  /** Fecha en que se bloqueará si no paga */
  blocksAt: Date | null
}

interface OrgLike {
  subscription_status?: string | null
  subscription_tier?: string | null
  trial_ends_at?: string | null
  subscription_expires_at?: string | null
}

function diffDays(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function getOrgAccessStatus(org: OrgLike | null): OrgAccessInfo {
  if (!org) {
    return { status: 'blocked', daysLeft: 0, inGracePeriod: false, blocksAt: null }
  }

  const now = new Date()
  const status = org.subscription_status

  // ── Suscripción activa ────────────────────────────────────────────────────
  if (status === 'active' && org.subscription_expires_at) {
    const expiresAt = new Date(org.subscription_expires_at)
    const daysLeft = diffDays(now, expiresAt)

    if (daysLeft > 0) {
      return {
        status: 'active',
        daysLeft,
        inGracePeriod: false,
        blocksAt: expiresAt,
      }
    }

    // Venció pero puede que todavía esté en gracia (ya se suma en register_org_payment,
    // pero cubrimos el caso de migración manual donde expires_at no incluye gracia)
    return { status: 'blocked', daysLeft: 0, inGracePeriod: false, blocksAt: expiresAt }
  }

  // ── Trial ─────────────────────────────────────────────────────────────────
  if (status === 'trialing' && org.trial_ends_at) {
    const trialEndsAt = new Date(org.trial_ends_at)
    const daysLeft = diffDays(now, trialEndsAt)

    if (daysLeft > 0) {
      return {
        status: 'trialing',
        daysLeft,
        inGracePeriod: false,
        blocksAt: trialEndsAt,
      }
    }

    return { status: 'blocked', daysLeft: 0, inGracePeriod: false, blocksAt: trialEndsAt }
  }

  // ── Cualquier otro caso (suspended, cancelled, sin campos) → bloqueado ───
  return { status: 'blocked', daysLeft: 0, inGracePeriod: false, blocksAt: null }
}

export function isOrgBlocked(org: OrgLike | null): boolean {
  return getOrgAccessStatus(org).status === 'blocked'
}
