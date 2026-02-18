import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOrgPaymentMethods } from '@/hooks/useOrgPaymentMethods'
import { hasConfigSchema } from '@/lib/paymentMethodConfig'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { OrganizationPaymentMethod, OrganizationPaymentMethodInsert } from '@/types/database.types'
import { Plus, Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PaymentMethodConfigModal } from './PaymentMethodConfigModal'

const PRESET_KEYS = [
  { key: 'cash', name: 'Efectivo', requiresCashSession: true },
  { key: 'transfer', name: 'Transferencia Bancaria', requiresCashSession: false },
  { key: 'mercadopago', name: 'Mercado Pago', requiresCashSession: false },
  { key: 'credit_card', name: 'Tarjeta de Crédito', requiresCashSession: false },
  { key: 'paypal', name: 'PayPal', requiresCashSession: false },
]

type Props = {
  organizationId: string
}

export function PaymentMethodsManager({ organizationId }: Props) {
  const { methods, loading, refetch } = useOrgPaymentMethods(organizationId, { includeInactive: true })
  const { show } = useToastStore()
  const [isAdding, setIsAdding] = useState(false)
  const [configMethod, setConfigMethod] = useState<OrganizationPaymentMethod | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newName, setNewName] = useState('')
  const [newRequiresCash, setNewRequiresCash] = useState(false)

  const existingKeys = new Set(methods.map((m) => m.key))

  const handleAdd = async () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_')
    const name = newName.trim()
    if (!key || !name) {
      show('Key y nombre son obligatorios', 'error')
      return
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      show('Key solo puede tener letras minúsculas, números y guiones bajos', 'error')
      return
    }
    if (existingKeys.has(key)) {
      show('Ya existe un método con esa key', 'error')
      return
    }

    try {
      const insert: OrganizationPaymentMethodInsert = {
        organization_id: organizationId,
        key,
        name,
        requires_cash_session: newRequiresCash,
        is_active: true,
        display_order: methods.length,
      }
      const { error } = await supabase.from('organization_payment_methods').insert(insert as never)
      if (error) throw error
      show('Método agregado', 'success')
      setNewKey('')
      setNewName('')
      setNewRequiresCash(false)
      setIsAdding(false)
      refetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar'
      const isDuplicate = /duplicate key|unique constraint/i.test(msg)
      show(isDuplicate ? 'Ese método ya existe. Actívalo desde la lista.' : msg, 'error')
      if (isDuplicate) refetch()
    }
  }

  const handleToggleActive = async (method: OrganizationPaymentMethod) => {
    try {
      const { error } = await supabase
        .from('organization_payment_methods')
        .update({ is_active: !method.is_active } as never)
        .eq('id', method.id)
      if (error) throw error
      show(method.is_active ? 'Método desactivado' : 'Método activado', 'success')
      refetch()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Error al actualizar', 'error')
    }
  }

  const handleDelete = async (method: OrganizationPaymentMethod) => {
    if (!confirm(`¿Eliminar "${method.name}"? No se puede deshacer.`)) return
    try {
      const { error } = await supabase.from('organization_payment_methods').delete().eq('id', method.id)
      if (error) throw error
      show('Método eliminado', 'success')
      refetch()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Error al eliminar', 'error')
    }
  }

  const addPreset = async (preset: (typeof PRESET_KEYS)[0]) => {
    if (existingKeys.has(preset.key)) {
      show(`"${preset.name}" ya existe`, 'info')
      return
    }
    try {
      const insert: OrganizationPaymentMethodInsert = {
        organization_id: organizationId,
        key: preset.key,
        name: preset.name,
        requires_cash_session: preset.requiresCashSession,
        is_active: true,
        display_order: methods.length,
      }
      const { error } = await supabase.from('organization_payment_methods').insert(insert as never)
      if (error) throw error
      show(`${preset.name} agregado`, 'success')
      refetch()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar'
      const isDuplicate = /duplicate key|unique constraint/i.test(msg)
      show(isDuplicate ? 'Ese método ya existe. Actívalo desde la lista.' : msg, 'error')
      if (isDuplicate) refetch()
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Cargando métodos...</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Métodos de pago</p>
      <p className="text-xs text-gray-500">
        Solo los métodos activos aparecen en Checkout y ventas manuales. Podés agregar métodos predefinidos o crear
        personalizados.
      </p>

      <div className="space-y-2">
        {methods.map((m) => (
          <div
            key={m.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
              m.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => handleToggleActive(m)}
                className={`w-10 h-5 rounded-full transition-colors shrink-0 ${
                  m.is_active ? 'bg-admin-600' : 'bg-gray-300'
                }`}
                aria-label={m.is_active ? 'Desactivar' : 'Activar'}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    m.is_active ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${m.is_active ? 'text-gray-900' : 'text-gray-500'}`}>{m.name}</p>
                <p className="text-xs text-gray-400 font-mono">{m.key}</p>
              </div>
              {m.requires_cash_session && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded shrink-0">Requiere caja</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {hasConfigSchema(m.key) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfigMethod(m)}
                  className="text-gray-600 hover:text-gray-900"
                  aria-label="Configurar"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(m)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!isAdding ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar personalizado
          </Button>
          {PRESET_KEYS.filter((p) => !existingKeys.has(p.key)).map((preset) => (
            <Button key={preset.key} type="button" variant="outline" size="sm" onClick={() => addPreset(preset)}>
              + {preset.name}
            </Button>
          ))}
        </div>
      ) : (
        <div className="p-3 bg-gray-50 rounded-lg space-y-2">
          <Input
            placeholder="Key (ej: credit_card)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="text-sm"
          />
          <Input
            placeholder="Nombre para mostrar"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newRequiresCash}
              onChange={(e) => setNewRequiresCash(e.target.checked)}
              className="rounded border-gray-300"
            />
            Requiere sesión de caja abierta (ej: efectivo)
          </label>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd}>
              Agregar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {configMethod && (
        <PaymentMethodConfigModal
          method={configMethod}
          onClose={() => setConfigMethod(null)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
