import { CreditCard, Truck } from 'lucide-react'
import { usePublicStore } from '@/contexts/PublicStoreContext'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useStorefrontBranch } from '@/hooks/useStorefrontBranch'

// Mismos filtros que el paso de pago del Checkout: los métodos que exigen caja
// abierta solo se ofrecen si hay sucursal que atienda la tienda online.
export function PurchaseReassurance() {
  const { organization } = usePublicStore()
  const settings = useOrgSettings()
  const organizationId = organization?.id
  const { methods } = useOrgPaymentMethods(organizationId)
  const { branchId } = useStorefrontBranch(
    organizationId,
    settings.checkout_exclude_isolated_warehouses !== false
  )

  const names = methods
    .filter((m) => !m.requires_cash_session || branchId)
    .map((m) => m.name)

  return (
    <ul className="mt-4 space-y-2 text-sm text-brand-muted">
      <li className="flex items-start gap-2.5">
        <Truck className="h-4 w-4 mt-0.5 shrink-0 text-brand-cuero" aria-hidden="true" />
        <span>Envíos a todo el país · Retiro sin costo en Paysandú</span>
      </li>
      {names.length > 0 && (
        <li className="flex items-start gap-2.5">
          <CreditCard className="h-4 w-4 mt-0.5 shrink-0 text-brand-cuero" aria-hidden="true" />
          <span>Pagás con {names.join(', ')}</span>
        </li>
      )}
    </ul>
  )
}
