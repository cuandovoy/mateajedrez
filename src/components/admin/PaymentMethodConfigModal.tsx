import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import type { OrganizationPaymentMethod } from '@/types/database.types'
import { getConfigSchema, type ConfigField } from '@/lib/paymentMethodConfig'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  method: OrganizationPaymentMethod
  onClose: () => void
  onSaved: () => void
}

function getConfigValue(config: Record<string, unknown>, field: ConfigField): string | boolean {
  const val = config[field.key]
  if (field.type === 'boolean') return Boolean(val)
  return typeof val === 'string' || typeof val === 'number' ? String(val) : ''
}

export function PaymentMethodConfigModal({ method, onClose, onSaved }: Props) {
  const { show } = useToastStore()
  const schema = getConfigSchema(method.key)
  const config = (method.config as Record<string, unknown>) ?? {}
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const initial: Record<string, string | boolean> = {}
    for (const field of schema) {
      initial[field.key] = getConfigValue(config, field)
    }
    setValues(initial)
  }, [method.id, method.key])

  const handleChange = (key: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const configUpdate: Record<string, unknown> = {}
      for (const field of schema) {
        const val = values[field.key]
        if (field.type === 'boolean') {
          configUpdate[field.key] = Boolean(val)
        } else if (typeof val === 'string' && val.trim()) {
          configUpdate[field.key] = val.trim()
        } else if (field.required && (val === undefined || val === '')) {
          show(`"${field.label}" es obligatorio`, 'error')
          setLoading(false)
          return
        }
      }

      const { error } = await supabase
        .from('organization_payment_methods')
        .update({ config: configUpdate, updated_at: new Date().toISOString() } as never)
        .eq('id', method.id)

      if (error) throw error
      show('Configuración guardada', 'success')
      onSaved()
      onClose()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Error al guardar', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (schema.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            Configurar {method.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {schema.map((field) => (
              <div key={field.key}>
                {field.type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      onChange={(e) => handleChange(field.key, e.target.checked)}
                      className="rounded border-gray-300 text-admin-600 focus:ring-admin-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{field.label}</span>
                  </label>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <Input
                      type={field.type as 'text' | 'password'}
                      value={String(values[field.key] ?? '')}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="text-sm"
                      autoComplete="off"
                    />
                  </>
                )}
                {field.help && (
                  <p className="mt-1 text-xs text-gray-500">{field.help}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-4 py-3 border-t shrink-0">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
