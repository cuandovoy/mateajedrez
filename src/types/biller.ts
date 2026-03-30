// src/types/biller.ts
// Tipos para la integración con Biller v2 (facturación electrónica DGI Uruguay)

export type BillerAmbiente = 'test' | 'production'

export interface BillerConfig {
  id: string
  organization_id: string
  ambiente: BillerAmbiente
  token: string
  sucursal_id: number
  /** 1 = precios con IVA incluido (retail), 0 = precios netos sin IVA (B2B). Default: 1 */
  montos_brutos: 0 | 1
  /** Indicador de facturación por defecto: 1=exento, 2=10%, 3=22%, 5=gratuito. Default: 3 */
  indicador_facturacion_default: 1 | 2 | 3 | 5
  created_at: string
  updated_at: string
}

// ─── Enums de Biller ──────────────────────────────────────────────────────────

export const TIPO_COMPROBANTE = {
  E_TICKET:     101,
  NC_E_TICKET:  102,
  ND_E_TICKET:  103,
  E_FACTURA:    111,
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
  TASA_MINIMA: 2, // IVA 10%
  TASA_BASICA: 3, // IVA 22%
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

// ─── Payloads de la API ───────────────────────────────────────────────────────

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

// ─── Estado del panel CFE en el checkout ─────────────────────────────────────

export interface CheckoutBillerState {
  emitirCFE: boolean
  tipoComprobante: 'ticket' | 'factura'
  clienteDocumento?: string
  clienteTipoDocumento?: number
  clienteNombre?: string
  clienteEmail?: string
}
