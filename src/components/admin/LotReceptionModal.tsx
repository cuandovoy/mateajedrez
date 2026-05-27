import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/hooks/useOrganization'
import { useToastStore } from '@/store/toastStore'
import type { InventoryLotInsert } from '@/types/database.types'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Branch { id: string; name: string }
interface ProductOption { id: string; name: string; sku: string }
interface SupplierOption { id: string; name: string }

interface LotReceptionModalProps {
  branches: Branch[]
  defaultBranchId?: string
  onCreated: () => void
  onClose: () => void
}

type Step = 1 | 2 | 3 | 'success'

export function LotReceptionModal({ branches, defaultBranchId, onCreated, onClose }: LotReceptionModalProps) {
  const { organizationId } = useOrganization()
  const { show } = useToastStore()

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Paso 1 — sucursal + producto
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Paso 2 — cantidad
  const [quantity, setQuantity] = useState(1)
  const [damaged, setDamaged] = useState(0)
  const [showDamaged, setShowDamaged] = useState(false)

  // Paso 3 — vencimiento y opcionales
  const [hasExpiry, setHasExpiry] = useState<boolean | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [referenceDoc, setReferenceDoc] = useState('')

  // Success state
  const [lastSaved, setLastSaved] = useState<{ name: string; qty: number } | null>(null)

  const resetForNextProduct = () => {
    setSelectedProduct(null)
    setSearch('')
    setProducts([])
    setQuantity(1)
    setDamaged(0)
    setShowDamaged(false)
    setHasExpiry(null)
    setExpiryDate('')
    setStep(1)
  }

  const searchProducts = useCallback(async (term: string) => {
    if (!organizationId || term.length < 2) { setProducts([]); return }
    const { data } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
      .limit(8)
    setProducts(data ?? [])
  }, [organizationId])

  useEffect(() => {
    const t = setTimeout(() => searchProducts(search), 250)
    return () => clearTimeout(t)
  }, [search, searchProducts])

  useEffect(() => {
    if (step === 1) setTimeout(() => searchRef.current?.focus(), 50)
  }, [step])

  useEffect(() => {
    if (!organizationId) return
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setSuppliers(data ?? []))
  }, [organizationId])

  const handleSubmit = async () => {
    if (!organizationId || !selectedProduct || !branchId) return
    setLoading(true)
    try {
      const payload: InventoryLotInsert = {
        organization_id: organizationId,
        branch_id: branchId,
        product_id: selectedProduct.id,
        quantity_received: quantity,
        quantity_remaining: quantity - damaged,
        quantity_damaged: damaged,
        expires_at: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : null,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        supplier_id: supplierId || null,
        reference_document: referenceDoc || null,
      }
      const { error } = await supabase.from('inventory_lots').insert(payload)
      if (error) throw error
      setLastSaved({ name: selectedProduct.name, qty: quantity })
      onCreated()
      setStep('success')
    } catch (e: any) {
      show(e.message ?? 'Error al registrar el lote', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Recibí mercadería</h2>
            {step !== 'success' && (
              <div className="flex gap-1.5 mt-1">
                {([1, 2, 3] as const).map(s => (
                  <div
                    key={s}
                    className={`h-1.5 w-6 rounded-full transition-colors ${s <= (step as number) ? 'bg-admin-600' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Paso 1 — sucursal + producto */}
        {step === 1 && (
          <div className="p-4 space-y-3">
            {branches.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal que recibe</label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-sm text-gray-500">¿Qué producto llegó?</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchRef}
                className="pl-9"
                placeholder="Buscar por nombre o SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedProduct(p); setStep(2) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-admin-50 transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm font-medium text-gray-800 group-hover:text-admin-700">{p.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{p.sku}</span>
                </button>
              ))}
              {search.length >= 2 && products.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin resultados para "{search}"</p>
              )}
              {search.length < 2 && (
                <p className="text-sm text-gray-400 text-center py-4">Escribí al menos 2 caracteres</p>
              )}
            </div>
          </div>
        )}

        {/* Paso 2 — ¿Cuánto llegó? */}
        {step === 2 && selectedProduct && (
          <div className="p-4 space-y-5">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-900">{selectedProduct.name}</span>
            </p>

            <div className="flex flex-col items-center gap-2">
              <label className="text-sm text-gray-500">Cantidad recibida</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-300 flex items-center justify-center text-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  −
                </button>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-24 text-center text-xl font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 rounded-xl border border-gray-300 flex items-center justify-center text-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-gray-400">unidades</span>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showDamaged}
                  onChange={e => { setShowDamaged(e.target.checked); if (!e.target.checked) setDamaged(0) }}
                  className="accent-admin-600"
                />
                ¿Llegaron unidades dañadas?
              </label>
              {showDamaged && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-32">Cantidad dañada:</span>
                  <Input
                    type="number"
                    min={0}
                    max={quantity}
                    value={damaged}
                    onChange={e => setDamaged(Math.min(quantity, Math.max(0, Number(e.target.value))))}
                    className="w-24 text-center"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 3 — ¿Vence? */}
        {step === 3 && selectedProduct && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-900">{selectedProduct.name}</span>
              <span className="text-gray-400"> · {quantity} unidades</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de vencimiento</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={e => { setExpiryDate(e.target.value); setHasExpiry(true) }}
                min={new Date().toISOString().split('T')[0]}
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={hasExpiry === false}
                  onChange={e => { if (e.target.checked) { setHasExpiry(false); setExpiryDate('') } else setHasExpiry(null) }}
                  className="accent-admin-600"
                />
                No tiene vencimiento
              </label>
            </div>

            {/* Opcionales colapsados */}
            <div className="border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setShowOptional(s => !s)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Más datos (opcional)
              </button>
              {showOptional && (
                <div className="mt-3 space-y-3">
                  {suppliers.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                      <select
                        value={supplierId}
                        onChange={e => setSupplierId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
                      >
                        <option value="">Sin especificar</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Costo unitario</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={unitCost}
                      onChange={e => setUnitCost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">N° de remito / documento</label>
                    <Input
                      placeholder="Ej: REM-0042"
                      value={referenceDoc}
                      onChange={e => setReferenceDoc(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Éxito — agregar otro o cerrar */}
        {step === 'success' && lastSaved && (
          <div className="p-6 text-center space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{lastSaved.name}</p>
              <p className="text-sm text-gray-500">{lastSaved.qty} unidades registradas</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button className="w-full bg-admin-600 hover:bg-admin-700 text-white" onClick={resetForNextProduct}>
                + Agregar otro producto a esta remesa
              </Button>
              <Button variant="outline" className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {/* Footer con acciones */}
        {step !== 'success' && (
          <div className="flex gap-2 p-4 border-t border-gray-100">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => (s - 1) as Step)} disabled={loading}>
                ← Atrás
              </Button>
            )}
            {step === 1 && (
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
            )}
            {step === 2 && (
              <Button className="flex-1 bg-admin-600 hover:bg-admin-700 text-white" onClick={() => setStep(3)}>
                Continuar →
              </Button>
            )}
            {step === 3 && (
              <Button
                className="flex-1 bg-admin-600 hover:bg-admin-700 text-white"
                onClick={handleSubmit}
                disabled={loading || (!expiryDate && hasExpiry !== false)}
              >
                {loading ? 'Guardando...' : 'Registrar entrada'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
