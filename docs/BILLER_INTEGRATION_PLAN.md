# Plan de Integración: Biller v2 → Axiostock

> **Objetivo:** Integrar la emisión de CFEs (Comprobantes Fiscales Electrónicos) ante la DGI
> directamente desde el módulo de ventas de Axiostock, con configuración por organización.

---

## 0. Contexto de la arquitectura

- **Frontend:** React + TypeScript
- **Backend/DB:** Supabase (Postgres + Edge Functions)
- **Multi-tenant:** cada fila sensible tiene `organization_id`
- **State management:** Zustand (no react-query — usar `useState` + `useEffect` + llamadas directas a Supabase)
- **Toasts:** `useToastStore()` → `show('mensaje', 'success' | 'error' | 'info')`
- **Formularios en modales:** `useState` por campo (igual que `EditOrganizationModal`)
- **Servicios/utilities:** `src/lib/` (no existe `src/services/`)
- **Biller API base URL:** `https://{ambiente}.biller.uy/v2`
- **Autenticación Biller:** Bearer Token por empresa (no por usuario)

---

## 1. Base de datos — Migración `106_biller.sql`

> Convención: `NNN_descripcion.sql`. La última es `105_subscription_billing.sql`, la siguiente es `106`.

```sql
-- supabase/migrations/106_biller.sql

-- ─── Configuración Biller por organización ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.biller_config (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ambiente         text        NOT NULL DEFAULT 'test' CHECK (ambiente IN ('test', 'production')),
  token            text        NOT NULL,
  sucursal_id      integer     NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.biller_config ENABLE ROW LEVEL SECURITY;

-- Solo miembros de la org pueden ver/editar su config
CREATE POLICY "org_members_biller_config"
  ON public.biller_config FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ─── Comprobantes emitidos ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.biller_comprobantes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id         uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  biller_id        integer,
  tipo_comprobante integer     NOT NULL,
  serie            text,
  numero           integer,
  numero_interno   text,
  estado           text        NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'anulado', 'error')),
  pdf_url          text,
  raw_response     jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.biller_comprobantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_biller_comprobantes"
  ON public.biller_comprobantes FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_biller_comprobantes_org_order
  ON public.biller_comprobantes (organization_id, order_id);

CREATE INDEX IF NOT EXISTS idx_biller_comprobantes_org_created
  ON public.biller_comprobantes (organization_id, created_at DESC);
```

---

## 2. Tipos TypeScript

```typescript
// src/types/biller.ts

export type BillerAmbiente = 'test' | 'production'

export interface BillerConfig {
  id: string
  organization_id: string
  ambiente: BillerAmbiente
  token: string
  sucursal_id: number
  created_at: string
  updated_at: string
}

// ---- Enums de Biller ----

export const TIPO_COMPROBANTE = {
  E_TICKET:   101,
  NC_E_TICKET: 102,
  ND_E_TICKET: 103,
  E_FACTURA:  111,
  NC_E_FACTURA: 112,
  ND_E_FACTURA: 113,
} as const
export type TipoComprobante = typeof TIPO_COMPROBANTE[keyof typeof TIPO_COMPROBANTE]

export const FORMA_PAGO = {
  CONTADO: 1,
  CREDITO: 2,
} as const
export type FormaPago = typeof FORMA_PAGO[keyof typeof FORMA_PAGO]

export const INDICADOR_FACTURACION = {
  EXENTO:      1,
  TASA_MINIMA: 2,  // IVA 10%
  TASA_BASICA: 3,  // IVA 22%
  GRATUITO:    5,
} as const
export type IndicadorFacturacion = typeof INDICADOR_FACTURACION[keyof typeof INDICADOR_FACTURACION]

export const TIPO_DOCUMENTO_CLIENTE = {
  RUT:       2,
  CI:        3,
  OTRO:      4,
  PASAPORTE: 5,
  DNI:       6,
} as const

// ---- Payloads de la API ----

export interface BillerClienteInput {
  razon_social?: string
  nombre_fantasia?: string
  tipo_documento?: number
  documento?: string
  pais?: string
  sucursal?: {
    direccion?: string
    ciudad?: string
    departamento?: string
    pais: string
    emails?: string[]
  }
}

export interface BillerItemInput {
  codigo?: string
  cantidad: number
  concepto: string
  precio: number
  indicador_facturacion: IndicadorFacturacion
  unidad_medida?: string
  descuento_tipo?: '$' | '%'
  descuento_cantidad?: number
}

export interface BillerComprobanteInput {
  tipo_comprobante: TipoComprobante
  forma_pago: FormaPago
  sucursal: number
  moneda: 'UYU' | 'USD' | 'EUR'
  montos_brutos: 0 | 1
  numero_interno?: string
  cliente: BillerClienteInput | '-'
  items: BillerItemInput[]
  adenda?: string
  emails_notificacion?: string[]
  referencias?: (number | { tipo: number; serie: string; numero: number })[]
}

export interface BillerComprobanteResponse {
  id: number
  tipo: number
  serie: string
  numero: number
  uuid?: string
}

export interface BillerError {
  error: string
  details?: Record<string, string[]>
}

// ---- Estado del checkout para CFE ----

export interface CheckoutBillerState {
  emitirCFE: boolean
  tipoComprobante: 'ticket' | 'factura'
  clienteDocumento?: string
  clienteTipoDocumento?: number
  clienteNombre?: string
  clienteEmail?: string
}
```

---

## 3. Cliente HTTP de Biller

> Va en `src/lib/biller.ts` (igual que `src/lib/stock.ts`, `src/lib/audit.ts`, etc.)

```typescript
// src/lib/biller.ts

import type {
  BillerComprobanteInput,
  BillerComprobanteResponse,
  BillerConfig,
} from '@/types/biller'

const BASE_URLS: Record<BillerConfig['ambiente'], string> = {
  test:       'https://test.biller.uy/v2',
  production: 'https://biller.uy/v2',
}

export class BillerApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Biller API error ${status}`)
    this.name = 'BillerApiError'
  }
}

async function billerFetch<T>(
  config: BillerConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URLS[config.ambiente]}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new BillerApiError(res.status, data)
  }

  return data as T
}

export async function emitirComprobante(
  config: BillerConfig,
  payload: BillerComprobanteInput,
): Promise<BillerComprobanteResponse> {
  return billerFetch<BillerComprobanteResponse>(config, '/comprobantes/crear', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function anularComprobante(
  config: BillerConfig,
  billerId: number,
): Promise<void> {
  return billerFetch<void>(config, '/comprobantes/anular', {
    method: 'POST',
    body: JSON.stringify({ id: billerId }),
  })
}

export async function obtenerPDF(
  config: BillerConfig,
  billerId: number,
): Promise<Blob> {
  const url = `${BASE_URLS[config.ambiente]}/comprobantes/pdf?id=${billerId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
  })
  if (!res.ok) throw new BillerApiError(res.status, null)
  return res.blob()
}
```

---

## 4. Hook: configuración Biller por organización

> Patrón del proyecto: `useState` + `useEffect` + Supabase directo (sin react-query).

```typescript
// src/hooks/useBillerConfig.ts

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { BillerConfig } from '@/types/biller'

export function useBillerConfig(organizationId: string | null) {
  const [config, setConfig] = useState<BillerConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchConfig = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    const { data } = await supabase
      .from('biller_config')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()
    setConfig(data as BillerConfig | null)
    setLoading(false)
  }, [organizationId])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  return { config, loading, refetch: fetchConfig }
}
```

---

## 5. Tab "Facturación" en EditOrganizationModal

> Se agrega igual que los demás tabs (general, estilos, formato, pagos, notificaciones, hero, suscripcion).
> El modal usa `useState` por campo — NO react-hook-form ni zod.

### 5.1 Estado a agregar al modal

```typescript
// Dentro de EditOrganizationModal — junto al resto de useState

const [billerAmbiente, setBillerAmbiente] = useState<'test' | 'production'>('test')
const [billerToken, setBillerToken] = useState('')
const [billerSucursalId, setBillerSucursalId] = useState<number | ''>('')
const [billerConfig, setBillerConfig] = useState<BillerConfig | null>(null)
const [loadingBiller, setLoadingBiller] = useState(false)
const [savingBiller, setSavingBiller] = useState(false)
const [testingBiller, setTestingBiller] = useState(false)
```

### 5.2 Cargar config al abrir el tab

```typescript
// Llamar esto cuando se abre el tab "facturacion"
const fetchBillerConfig = useCallback(async () => {
  if (!org.id) return
  setLoadingBiller(true)
  const { data } = await supabase
    .from('biller_config')
    .select('*')
    .eq('organization_id', org.id)
    .maybeSingle()
  if (data) {
    setBillerConfig(data as BillerConfig)
    setBillerAmbiente(data.ambiente as 'test' | 'production')
    setBillerToken(data.token)
    setBillerSucursalId(data.sucursal_id)
  }
  setLoadingBiller(false)
}, [org.id])
```

### 5.3 Guardar config

```typescript
const handleSaveBillerConfig = async () => {
  if (!billerToken.trim() || !billerSucursalId) {
    show('Completá todos los campos de Biller', 'error')
    return
  }
  setSavingBiller(true)
  const { error } = await supabase
    .from('biller_config')
    .upsert({
      organization_id: org.id,
      ambiente: billerAmbiente,
      token: billerToken.trim(),
      sucursal_id: Number(billerSucursalId),
      updated_at: new Date().toISOString(),
    })
  if (error) {
    show('Error al guardar configuración de Biller', 'error')
  } else {
    show('Configuración de Biller guardada', 'success')
    fetchBillerConfig()
  }
  setSavingBiller(false)
}
```

### 5.4 Probar conexión

```typescript
const handleTestBiller = async () => {
  if (!billerToken.trim() || !billerSucursalId) {
    show('Completá los campos antes de probar', 'error')
    return
  }
  setTestingBiller(true)
  try {
    const fakeConfig: BillerConfig = {
      id: '', organization_id: org.id,
      ambiente: billerAmbiente,
      token: billerToken.trim(),
      sucursal_id: Number(billerSucursalId),
      created_at: '', updated_at: '',
    }
    await emitirComprobante(fakeConfig, {
      tipo_comprobante: TIPO_COMPROBANTE.E_TICKET,
      forma_pago: FORMA_PAGO.CONTADO,
      sucursal: Number(billerSucursalId),
      moneda: 'UYU',
      montos_brutos: 0,
      cliente: '-',
      items: [{
        cantidad: 1,
        concepto: 'Test de conexión Axiostock',
        precio: 1,
        indicador_facturacion: INDICADOR_FACTURACION.TASA_BASICA,
      }],
    })
    show('Conexión exitosa — comprobante de prueba emitido en Biller', 'success')
  } catch (err) {
    const msg = err instanceof BillerApiError
      ? `Error Biller ${err.status}: ${JSON.stringify(err.body)}`
      : 'Error al conectar con Biller'
    show(msg, 'error')
  }
  setTestingBiller(false)
}
```

### 5.5 TabsTrigger a agregar en el TabsList

```tsx
<TabsTrigger value="facturacion">
  <Receipt className="h-4 w-4" />
  Facturación
</TabsTrigger>
```

### 5.6 TabsContent

```tsx
<TabsContent value="facturacion" className="p-6 space-y-6">
  <div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">Facturación electrónica</h3>
    <p className="text-sm text-gray-500">Configuración de Biller para emisión de CFEs ante DGI.</p>
  </div>

  {loadingBiller ? (
    <p className="text-sm text-gray-500">Cargando configuración...</p>
  ) : (
    <div className="space-y-4">
      {/* Ambiente */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
        <select
          value={billerAmbiente}
          onChange={(e) => setBillerAmbiente(e.target.value as 'test' | 'production')}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="test">Test (DGI homologación)</option>
          <option value="production">Producción</option>
        </select>
        {billerAmbiente === 'production' && (
          <p className="text-xs text-orange-600 mt-1">
            Los comprobantes emitidos tendrán validez fiscal real ante DGI.
          </p>
        )}
      </div>

      {/* Token */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Token de API</label>
        <input
          type="password"
          value={billerToken}
          onChange={(e) => setBillerToken(e.target.value)}
          placeholder="Obtenerlo en biller.uy → Ajustes → API Tokens"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* Sucursal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ID de sucursal</label>
        <input
          type="number"
          value={billerSucursalId}
          onChange={(e) => setBillerSucursalId(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Ver en Biller → Ajustes → Sucursales"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestBiller}
          disabled={testingBiller}
        >
          {testingBiller ? 'Probando...' : 'Probar conexión'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveBillerConfig}
          disabled={savingBiller}
        >
          {savingBiller ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      {billerConfig && (
        <p className="text-xs text-gray-400">
          Última actualización: {new Date(billerConfig.updated_at).toLocaleString('es-UY')}
        </p>
      )}
    </div>
  )}
</TabsContent>
```

---

## 6. Servicio de negocio: emitir desde una orden

> Va en `src/lib/billerSaleService.ts`.
> La tabla de ventas es `orders` con items en `order_items`.
> Los productos no tienen `tax_rate` directo — se asume IVA básico (22%) por defecto,
> salvo que el negocio configure otra cosa en el futuro.

```typescript
// src/lib/billerSaleService.ts

import { supabase } from '@/lib/supabase'
import { emitirComprobante, obtenerPDF, BillerApiError } from '@/lib/biller'
import {
  TIPO_COMPROBANTE,
  FORMA_PAGO,
  INDICADOR_FACTURACION,
} from '@/types/biller'
import type { BillerConfig, CheckoutBillerState } from '@/types/biller'

// El método de pago de Axiostock no se mapea 1:1 con Biller.
// La mayoría son contado; "credit" → crédito.
const toFormaPago = (paymentMethod: string | null): number =>
  paymentMethod === 'credit' ? FORMA_PAGO.CREDITO : FORMA_PAGO.CONTADO

interface OrderItem {
  product_id: string
  variant_id: string | null
  quantity: number
  price: number       // precio unitario (sin IVA en Axiostock)
  name?: string       // nombre del producto — se resuelve aparte si no viene
}

interface OrderForBiller {
  id: string
  organization_id: string
  payment_method: string | null
  items: OrderItem[]
}

export async function emitirCFEDesdeOrden(
  config: BillerConfig,
  order: OrderForBiller,
  billerState: CheckoutBillerState,
): Promise<{ billerId: number; pdfBlob: Blob }> {
  const tieneRUT = billerState.tipoComprobante === 'factura'
  const tipoComprobante = tieneRUT
    ? TIPO_COMPROBANTE.E_FACTURA
    : TIPO_COMPROBANTE.E_TICKET

  const payload = {
    tipo_comprobante: tipoComprobante,
    forma_pago: toFormaPago(order.payment_method),
    sucursal: config.sucursal_id,
    moneda: 'UYU' as const,
    montos_brutos: 0 as const,   // precios sin IVA; Biller calcula el IVA
    numero_interno: order.id,
    cliente: tieneRUT && billerState.clienteDocumento
      ? {
          tipo_documento: billerState.clienteTipoDocumento,
          documento: billerState.clienteDocumento,
          nombre_fantasia: billerState.clienteNombre,
          sucursal: {
            pais: 'UY',
            emails: billerState.clienteEmail ? [billerState.clienteEmail] : [],
          },
        }
      : '-' as const,
    items: order.items.map((item) => ({
      cantidad: item.quantity,
      concepto: item.name ?? `Producto ${item.product_id.slice(0, 8)}`,
      precio: item.price,
      // IVA básico 22% por defecto. Extender con campo tax_rate en productos si se necesita.
      indicador_facturacion: INDICADOR_FACTURACION.TASA_BASICA,
    })),
  }

  const response = await emitirComprobante(config, payload)

  // Guardar en DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('biller_comprobantes').insert({
    organization_id: order.organization_id,
    order_id: order.id,
    biller_id: response.id,
    tipo_comprobante: tipoComprobante,
    serie: response.serie,
    numero: response.numero,
    numero_interno: order.id,
    estado: 'emitido',
    raw_response: response,
  })

  const pdfBlob = await obtenerPDF(config, response.id)

  return { billerId: response.id, pdfBlob }
}
```

---

## 7. Panel de CFE en el Checkout

> Se inserta justo antes del botón "Confirmar pedido" en `src/pages/Checkout.tsx`.
> Solo se muestra si la org tiene Biller configurado.

### 7.1 Estado a agregar en Checkout

```typescript
const [billerConfig, setBillerConfig] = useState<BillerConfig | null>(null)
const [billerState, setBillerState] = useState<CheckoutBillerState>({
  emitirCFE: false,
  tipoComprobante: 'ticket',
})
```

### 7.2 Cargar config al montar

```typescript
useEffect(() => {
  if (!organizationId) return
  supabase
    .from('biller_config')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()
    .then(({ data }) => setBillerConfig(data as BillerConfig | null))
}, [organizationId])
```

### 7.3 Emisión después de crear la orden (dentro de `handleSubmit`)

```typescript
// Después de crear la orden y los order_items exitosamente,
// ANTES de clearCart() y navigate():

if (billerState.emitirCFE && billerConfig) {
  try {
    // Resolver nombres de productos para el CFE
    const orderItemsWithNames = items.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity: item.quantity,
      price: item.variant?.price ?? item.product.price,
      name: item.product.name,
    }))

    const { pdfBlob } = await emitirCFEDesdeOrden(
      billerConfig,
      {
        id: order.id,
        organization_id: organizationId,
        payment_method: paymentMethod,
        items: orderItemsWithNames,
      },
      billerState,
    )

    // Abrir PDF en nueva pestaña
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
    show('Comprobante electrónico emitido correctamente', 'success')

  } catch (err) {
    // ⚠️ La orden YA SE GUARDÓ — el CFE falló pero no se revierte.
    // El operador puede reintentarlo desde el historial.
    console.error('Error emitiendo CFE:', err)
    show(
      'Pedido confirmado. El comprobante electrónico no pudo emitirse — podés reintentarlo desde el historial.',
      'error',
    )
  }
}
```

### 7.4 Componente `BillerCheckoutPanel`

```tsx
// src/components/features/BillerCheckoutPanel.tsx

import { TIPO_DOCUMENTO_CLIENTE } from '@/types/biller'
import type { BillerConfig, CheckoutBillerState } from '@/types/biller'
import { useState } from 'react'

interface Props {
  config: BillerConfig
  onChange: (state: CheckoutBillerState) => void
}

export function BillerCheckoutPanel({ config, onChange }: Props) {
  const [emitirCFE, setEmitirCFE]   = useState(false)
  const [tipo, setTipo]             = useState<'ticket' | 'factura'>('ticket')
  const [documento, setDocumento]   = useState('')
  const [tipoDoc, setTipoDoc]       = useState(TIPO_DOCUMENTO_CLIENTE.CI)
  const [nombre, setNombre]         = useState('')
  const [email, setEmail]           = useState('')

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
    <div className="border border-gray-200 rounded-lg p-4 mt-4 space-y-3">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={emitirCFE}
          onChange={(e) => {
            setEmitirCFE(e.target.checked)
            notify({ emitirCFE: e.target.checked })
          }}
          className="h-4 w-4"
        />
        <span className="font-medium text-sm">Emitir comprobante fiscal electrónico</span>
        {config.ambiente === 'test' && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
            MODO TEST
          </span>
        )}
      </label>

      {emitirCFE && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          {/* Tipo: e-Ticket o e-Factura */}
          <div className="flex gap-2">
            {(['ticket', 'factura'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); notify({ tipoComprobante: t }) }}
                className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                  tipo === t
                    ? 'bg-admin-600 text-white border-admin-600'
                    : 'border-gray-300 text-gray-600 hover:border-admin-400'
                }`}
              >
                {t === 'ticket' ? 'e-Ticket' : 'e-Factura'}
                <span className="block text-xs font-normal opacity-75">
                  {t === 'ticket' ? 'Consumidor final' : 'Con RUT / CI'}
                </span>
              </button>
            ))}
          </div>

          {/* Datos del receptor — solo si eligió factura */}
          {tipo === 'factura' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={tipoDoc}
                  onChange={(e) => { setTipoDoc(Number(e.target.value)); notify({ clienteTipoDocumento: Number(e.target.value) }) }}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-28"
                >
                  <option value={TIPO_DOCUMENTO_CLIENTE.RUT}>RUT</option>
                  <option value={TIPO_DOCUMENTO_CLIENTE.CI}>CI</option>
                  <option value={TIPO_DOCUMENTO_CLIENTE.DNI}>DNI</option>
                  <option value={TIPO_DOCUMENTO_CLIENTE.PASAPORTE}>Pasaporte</option>
                </select>
                <input
                  type="text"
                  placeholder={tipoDoc === TIPO_DOCUMENTO_CLIENTE.RUT ? 'Ej: 210475730011' : 'Número de documento'}
                  value={documento}
                  onChange={(e) => { setDocumento(e.target.value); notify({ clienteDocumento: e.target.value }) }}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Nombre o razón social (opcional)"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); notify({ clienteNombre: e.target.value }) }}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
              <input
                type="email"
                placeholder="Email para recibir el PDF (opcional)"
                value={email}
                onChange={(e) => { setEmail(e.target.value); notify({ clienteEmail: e.target.value }) }}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## 8. Orden de implementación

```
FASE 1 — Infraestructura (sin UI)
  [ ] Crear supabase/migrations/106_biller.sql
  [ ] Aplicar migración (supabase db push)
  [ ] Crear src/types/biller.ts
  [ ] Crear src/lib/biller.ts (cliente HTTP)

FASE 2 — Configuración por organización
  [ ] Crear src/hooks/useBillerConfig.ts
  [ ] Agregar tab "Facturación" en EditOrganizationModal
        - useState para billerAmbiente, billerToken, billerSucursalId
        - fetchBillerConfig al montar el tab (onValueChange en Tabs)
        - handleSaveBillerConfig, handleTestBiller
        - Importar Receipt de lucide-react para el icono del tab

FASE 3 — Emisión en el flujo de venta
  [ ] Crear src/lib/billerSaleService.ts
  [ ] Crear src/components/features/BillerCheckoutPanel.tsx
  [ ] En Checkout.tsx:
        - Cargar billerConfig al montar (useEffect)
        - Agregar BillerCheckoutPanel antes del botón confirmar
        - Llamar emitirCFEDesdeOrden() después de crear la orden
        - Manejar el error sin bloquear la orden (ver sección 7.3)

FASE 4 — Historial y operaciones
  [ ] Badge "CFE emitido" en listado de órdenes/ventas
  [ ] Botón "Re-descargar PDF" desde detalle de orden
  [ ] Botón "Anular comprobante" con confirmación
  [ ] Vista de comprobantes emitidos (filtros por fecha/tipo)
```

---

## 9. Buenas prácticas

- **Nunca hardcodear** token o sucursal_id — siempre de `biller_config`.
- **RLS** garantiza que una org no vea la config de otra.
- **El token se guarda en texto plano** en DB. Si se necesita encriptación, usar Supabase Vault.
- **La orden NUNCA queda bloqueada** por un fallo de Biller — siempre se guarda primero, el CFE es un efecto secundario con reintento manual.
- **`numero_interno`** = `order.id` (UUID) — es único por definición.
- **Ambiente "test" por defecto** — el admin debe cambiarlo explícitamente a producción.
- **Rate limit Biller:** máx. 1 llamada/segundo por token. Para imports masivos, agregar delay.
- **`raw_response`** guarda la respuesta completa de Biller para debug sin exponer el token.
- **IVA:** actualmente se asume 22% (tasa básica) para todos los ítems. Si los productos necesitan IVA diferenciado, agregar campo `tax_rate` a la tabla `products` en el futuro.

---

## 10. Variables de entorno

Ninguna del lado cliente. La configuración de Biller es por organización en DB (`biller_config` vía Supabase con RLS).

---

*Plan ajustado para Axiostock — stack real: Supabase + React + Zustand + useState/useEffect*
