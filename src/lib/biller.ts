// src/lib/biller.ts
// Cliente que llama a la edge function biller-proxy (evita CORS).
// La edge function se encarga de autenticar con Biller server-side.

import { supabase } from '@/lib/supabase'
import type {
  BillerComprobanteInput,
  BillerComprobanteResponse,
  BillerConfig,
} from '@/types/biller'

// Formato de error de la API de Biller:
// { error: string, details?: Record<string, string[]> }
function buildBillerMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Error desconocido de Biller'
  const b = body as Record<string, unknown>

  const main = typeof b.error === 'string' ? b.error : null
  const details = b.details && typeof b.details === 'object'
    ? Object.entries(b.details as Record<string, string[]>)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join(' | ')
    : null

  if (main && details) return `${main} (${details})`
  if (main) return main
  if (details) return details
  return 'Error desconocido de Biller'
}

/** Abre un PDF blob como descarga sin depender de window.open (evita popup blockers). */
export function descargarPDFBlob(blob: Blob, filename = 'comprobante.pdf') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export class BillerApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(buildBillerMessage(body))
    this.name = 'BillerApiError'
  }
}

// Extrae el body JSON de un FunctionsHttpError (supabase-js >= 2.x)
async function extractFunctionsErrorBody(error: unknown): Promise<{ status: number; body: unknown } | null> {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    (error as { context: unknown }).context instanceof Response
  ) {
    const res = (error as { context: Response }).context
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  }
  return null
}

async function callProxy<T>(
  organizationId: string,
  action: 'crear' | 'anular',
  opts: { payload?: unknown; biller_id?: number } = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('biller-proxy', {
    body: { action, organization_id: organizationId, ...opts },
  })

  if (error) {
    // supabase.functions.invoke pone el error HTTP en `error`, con el body
    // en error.context (Response). Intentamos extraer el error real de Biller.
    const extracted = await extractFunctionsErrorBody(error)
    if (extracted) throw new BillerApiError(extracted.status, extracted.body)
    throw new BillerApiError(0, { error: (error as Error).message ?? 'Error de red' })
  }

  // Respuesta 2xx pero con estructura de error (no debería pasar, pero por si acaso)
  const result = data as Record<string, unknown> | null
  if (result?.error) {
    throw new BillerApiError(400, result)
  }

  return data as T
}

export async function emitirComprobante(
  config: BillerConfig,
  payload: BillerComprobanteInput,
): Promise<BillerComprobanteResponse> {
  return callProxy<BillerComprobanteResponse>(config.organization_id, 'crear', { payload })
}

export async function anularComprobante(
  config: BillerConfig,
  billerId: number,
): Promise<void> {
  await callProxy<void>(config.organization_id, 'anular', { biller_id: billerId })
}

export async function obtenerPDF(
  config: BillerConfig,
  billerId: number,
): Promise<Blob> {
  // supabase.functions.invoke no maneja bien binarios — usar fetch directo.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const { data: { session } } = await supabase.auth.getSession()
  const authToken = session?.access_token ?? anonKey

  const res = await fetch(`${supabaseUrl}/functions/v1/biller-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({
      action: 'pdf',
      organization_id: config.organization_id,
      biller_id: billerId,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new BillerApiError(res.status, body)
  }

  return res.blob()
}
