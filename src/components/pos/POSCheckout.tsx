import { BillerCheckoutPanel } from '@/components/features/BillerCheckoutPanel'
import { useBillerConfig } from '@/hooks/useBillerConfig'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import type { POSCartItem, POSCustomer, POSPaymentMethod } from '@/lib/posService'
import { cn, formatPrice } from '@/lib/utils'
import { useOrganizationStore } from '@/store/organizationStore'
import type { CheckoutBillerState } from '@/types/biller'
import { ChevronDown, ChevronUp, UserCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface POSCheckoutProps {
  items: POSCartItem[]
  subtotal: number
  onConfirm: (params: {
    paymentMethod: string | null
    isCreditSale: boolean
    discountKind: 'percentage' | 'fixed' | null
    discountValue: number | null
    customer: POSCustomer | null
    billerState: CheckoutBillerState | null
    paymentMethods: POSPaymentMethod[]
  }) => Promise<void>
  onClose: () => void
  onOpenCustomerSearch: () => void
  selectedCustomer: POSCustomer | null
  loading: boolean
}

export function POSCheckout({
  items,
  subtotal,
  onConfirm,
  onClose,
  onOpenCustomerSearch,
  selectedCustomer,
  loading,
}: POSCheckoutProps) {
  const organizationId = useOrganizationStore((s) => s.currentOrganization?.id)
  const settings = useOrgSettings()
  const { methods: rawMethods } = useOrgPaymentMethods(organizationId)
  const { config: billerConfig } = useBillerConfig(organizationId ?? null)

  const paymentMethods: POSPaymentMethod[] = rawMethods
    .filter((m) => m.is_active)
    .map((m) => ({ key: m.key, label: m.name, requires_cash_session: m.requires_cash_session }))

  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [isCreditSale, setIsCreditSale] = useState(false)
  const [discountKind, setDiscountKind] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [showDiscount, setShowDiscount] = useState(false)
  const [billerState, setBillerState] = useState<CheckoutBillerState>({ emitirCFE: false, tipoComprobante: 'ticket' })
  const panelRef = useRef<HTMLDivElement>(null)

  // Set default payment method
  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethod) {
      setPaymentMethod(paymentMethods[0].key)
    }
  }, [paymentMethods, paymentMethod])

  // Cierre tap fuera del panel
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  const discountAmount = (() => {
    const v = Number(discountValue)
    if (!showDiscount || !Number.isFinite(v) || v <= 0) return 0
    if (discountKind === 'percentage') return Math.max(0, Math.min(subtotal, (subtotal * v) / 100))
    return Math.max(0, Math.min(subtotal, v))
  })()
  const total = Math.max(subtotal - discountAmount, 0)

  const handleConfirm = async () => {
    await onConfirm({
      paymentMethod: isCreditSale ? null : paymentMethod || null,
      isCreditSale,
      discountKind: showDiscount && discountAmount > 0 ? discountKind : null,
      discountValue: showDiscount && discountAmount > 0 ? Number(discountValue) : null,
      customer: selectedCustomer,
      billerState: billerConfig ? billerState : null,
      paymentMethods,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <div>
            <p className="font-semibold text-gray-900">Resumen de venta</p>
            <p className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'producto' : 'productos'}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 space-y-4 pb-2">
          {/* Cliente */}
          <button
            onClick={onOpenCustomerSearch}
            className={cn(
              'w-full flex items-center gap-3 h-11 px-3 border rounded-lg text-sm transition-colors',
              selectedCustomer
                ? 'border-admin-300 bg-admin-50 text-admin-800'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            )}
          >
            <UserCheck className={cn('h-4 w-4 flex-shrink-0', selectedCustomer ? 'text-admin-600' : 'text-gray-400')} />
            <span className="flex-1 text-left truncate">
              {selectedCustomer ? selectedCustomer.full_name : 'Agregar cliente (opcional)'}
            </span>
            {selectedCustomer && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onOpenCustomerSearch() }}
                className="text-xs text-admin-600 font-medium flex-shrink-0"
              >
                Cambiar
              </span>
            )}
          </button>

          {/* Modo de pago — contado / crédito */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Condición de pago</p>
            <div className="flex gap-2">
              {(['contado', 'credito'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setIsCreditSale(mode === 'credito')}
                  className={cn(
                    'flex-1 h-9 rounded-lg text-sm font-medium border transition-colors',
                    (mode === 'contado' ? !isCreditSale : isCreditSale)
                      ? 'bg-admin-600 text-white border-admin-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {mode === 'contado' ? 'Contado' : 'Crédito'}
                </button>
              ))}
            </div>
          </div>

          {/* Método de pago (solo contado) */}
          {!isCreditSale && paymentMethods.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Método de pago</p>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
              >
                {paymentMethods.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Descuento */}
          <div>
            <button
              onClick={() => setShowDiscount((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
            >
              {showDiscount ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showDiscount ? 'Ocultar descuento' : 'Agregar descuento'}
            </button>

            {showDiscount && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {(['percentage', 'fixed'] as const).map((kind) => (
                    <button
                      key={kind}
                      onClick={() => setDiscountKind(kind)}
                      className={cn(
                        'h-9 px-3 text-sm font-medium transition-colors',
                        discountKind === kind
                          ? 'bg-admin-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {kind === 'percentage' ? '%' : '$'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountKind === 'percentage' ? '0' : '0.00'}
                  className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                />
              </div>
            )}
          </div>

          {/* CFE (solo si tiene Biller configurado) */}
          {billerConfig && (
            <BillerCheckoutPanel
              config={billerConfig}
              onChange={setBillerState}
            />
          )}
        </div>

        {/* Totales + botón confirmar */}
        <div className="px-4 pt-3 pb-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <div className="space-y-1">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal, settings)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descuento</span>
                  <span>-{formatPrice(discountAmount, settings)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{formatPrice(total, settings)}</span>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={loading || (!isCreditSale && !paymentMethod)}
            className={cn(
              'w-full h-12 rounded-xl text-sm font-semibold transition-all',
              loading || (!isCreditSale && !paymentMethod)
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-admin-600 text-white hover:bg-admin-700 active:scale-[0.98]'
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Registrando...
              </span>
            ) : (
              `Confirmar venta · ${formatPrice(total, settings)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
