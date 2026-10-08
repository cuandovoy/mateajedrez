// src/components/features/BillerCheckoutPanel.tsx
// Panel de emisión de CFE en el checkout.
// Solo se renderiza si la org tiene Biller configurado.

import { useState } from 'react'
import { TIPO_DOCUMENTO_CLIENTE } from '@/types/biller'
import type { BillerConfig, CheckoutBillerState } from '@/types/biller'

interface Props {
  config: BillerConfig
  onChange: (state: CheckoutBillerState) => void
}

export function BillerCheckoutPanel({ config, onChange }: Props) {
  const [emitirCFE, setEmitirCFE] = useState(false)
  const [tipo, setTipo]           = useState<'ticket' | 'factura'>('ticket')
  const [documento, setDocumento] = useState('')
  const [tipoDoc, setTipoDoc]     = useState<number>(TIPO_DOCUMENTO_CLIENTE.CI)
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')

  const notify = (patch: Partial<CheckoutBillerState> = {}) => {
    onChange({
      emitirCFE,
      tipoComprobante: tipo,
      clienteDocumento: documento || undefined,
      clienteTipoDocumento: tipoDoc,
      clienteNombre: nombre || undefined,
      clienteEmail: email || undefined,
      ...patch,
    })
  }

  return (
    <div className="border border-brand-line rounded-lg p-4 space-y-3">
      {/* Toggle principal */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={emitirCFE}
          onChange={(e) => {
            setEmitirCFE(e.target.checked)
            notify({ emitirCFE: e.target.checked })
          }}
          className="h-4 w-4 rounded"
        />
        <span className="font-medium text-sm text-brand-tinta">
          Emitir comprobante fiscal electrónico
        </span>
        {config.ambiente === 'test' && (
          <span className="text-xs bg-brand-crema text-brand-cuero-oscuro px-2 py-0.5 rounded font-medium">
            MODO TEST
          </span>
        )}
      </label>

      {emitirCFE && (
        <div className="space-y-3 pt-2 border-t border-brand-line">
          {/* e-Ticket vs e-Factura */}
          <div className="flex gap-2">
            {(['ticket', 'factura'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); notify({ tipoComprobante: t }) }}
                className={`flex-1 py-2 px-3 rounded border text-sm font-medium transition-colors ${
                  tipo === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-brand-line text-brand-muted hover:border-indigo-400'
                }`}
              >
                {t === 'ticket' ? 'e-Ticket' : 'e-Factura'}
                <span className="block text-xs font-normal opacity-75">
                  {t === 'ticket' ? 'Consumidor final' : 'Con RUT / CI'}
                </span>
              </button>
            ))}
          </div>

          {/* Datos del receptor — solo si eligió e-Factura */}
          {tipo === 'factura' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={tipoDoc}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setTipoDoc(v)
                    notify({ clienteTipoDocumento: v })
                  }}
                  className="border border-brand-line rounded-md px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={TIPO_DOCUMENTO_CLIENTE.RUT}>RUT</option>
                  <option value={TIPO_DOCUMENTO_CLIENTE.CI}>CI</option>
                  <option value={TIPO_DOCUMENTO_CLIENTE.DNI}>DNI</option>
                  <option value={TIPO_DOCUMENTO_CLIENTE.PASAPORTE}>Pasaporte</option>
                </select>
                <input
                  type="text"
                  placeholder={
                    tipoDoc === TIPO_DOCUMENTO_CLIENTE.RUT
                      ? 'Ej: 210475730011'
                      : 'Número de documento'
                  }
                  value={documento}
                  onChange={(e) => {
                    setDocumento(e.target.value)
                    notify({ clienteDocumento: e.target.value })
                  }}
                  className="flex-1 border border-brand-line rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <input
                type="text"
                placeholder="Nombre o razón social (opcional)"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  notify({ clienteNombre: e.target.value })
                }}
                className="w-full border border-brand-line rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="email"
                placeholder="Email para recibir el PDF (opcional)"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  notify({ clienteEmail: e.target.value })
                }}
                className="w-full border border-brand-line rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
