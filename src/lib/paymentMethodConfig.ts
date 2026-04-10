/**
 * Esquemas de configuración por método de pago.
 * Cada método que requiere credenciales define sus campos aquí.
 * Escalable: agregar nuevos métodos sin migraciones.
 */

export type ConfigFieldType = 'text' | 'password' | 'number' | 'boolean'

export type ConfigField = {
  key: string
  label: string
  type: ConfigFieldType
  placeholder?: string
  required?: boolean
  help?: string
}

export const PAYMENT_METHOD_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  mercadopago: [
    {
      key: 'access_token',
      label: 'Access Token',
      type: 'password',
      placeholder: 'APP_USR-xxxx...',
      required: true,
      help: 'Token privado para el backend. Obtenerlo en MP Developers → Tu app → Credenciales de producción.',
    },
    {
      key: 'public_key',
      label: 'Public Key',
      type: 'text',
      placeholder: 'APP_USR-xxxx...',
      required: true,
      help: 'Clave pública para el frontend. MP Developers → Tu app → Credenciales de producción.',
    },
    {
      key: 'webhook_secret',
      label: 'Webhook Secret Key',
      type: 'password',
      placeholder: 'abc123...',
      required: true,
      help: 'Clave secreta para verificar webhooks. MP Developers → Tu app → Webhooks → Clave secreta.',
    },
    {
      key: 'sandbox',
      label: 'Modo prueba (sandbox)',
      type: 'boolean',
      help: 'Activar para usar credenciales de prueba. Desactivar en producción.',
    },
  ],
  paypal: [
    {
      key: 'client_id',
      label: 'Client ID',
      type: 'text',
      placeholder: 'Tu Client ID de PayPal',
      required: true,
    },
    {
      key: 'client_secret',
      label: 'Client Secret',
      type: 'password',
      placeholder: 'Tu Client Secret',
      required: true,
    },
    {
      key: 'sandbox',
      label: 'Modo sandbox',
      type: 'boolean',
      help: 'Activar para pruebas.',
    },
  ],
  credit_card: [
    {
      key: 'provider',
      label: 'Proveedor',
      type: 'text',
      placeholder: 'Ej: Stripe, otro',
      help: 'Nombre del procesador de tarjetas.',
    },
  ],
}

export function getConfigSchema(key: string): ConfigField[] {
  return PAYMENT_METHOD_CONFIG_SCHEMAS[key] ?? []
}

export function hasConfigSchema(key: string): boolean {
  return key in PAYMENT_METHOD_CONFIG_SCHEMAS && PAYMENT_METHOD_CONFIG_SCHEMAS[key].length > 0
}
