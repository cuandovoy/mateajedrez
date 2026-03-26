/**
 * Registro centralizado de tipos de notificaciones in-app.
 * Para agregar un nuevo tipo:
 *   1. Añadirlo al union type NotificationType
 *   2. Agregar su config en NOTIFICATION_TYPES
 *   3. Crear el trigger SQL correspondiente en la migración
 */

export type NotificationType = 'new_order' | 'low_stock' | 'order_status_change'

export interface NotificationTypeConfig {
  /** Identificador único — debe coincidir con el campo `type` en user_notifications */
  type: NotificationType
  /** Etiqueta visible en la UI */
  label: string
  /** Descripción corta para el panel de configuración */
  description: string
  /** Nombre del ícono en lucide-react (e.g. 'ShoppingCart') */
  icon: string
  /** Clase de color Tailwind para el ícono */
  color: string
  /** Si se activa por defecto al crear una org nueva */
  defaultEnabled: boolean
  /** Si permite configurar un umbral numérico */
  hasThreshold?: boolean
  /** Key en inapp_notifications donde se guarda el umbral */
  thresholdKey?: string
  /** Etiqueta del campo umbral */
  thresholdLabel?: string
  /** Valor por defecto del umbral */
  defaultThreshold?: number
}

export const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  {
    type: 'new_order',
    label: 'Nuevo pedido',
    description: 'Cuando se crea una nueva orden en tu tienda',
    icon: 'ShoppingCart',
    color: 'text-green-500',
    defaultEnabled: true,
  },
  {
    type: 'low_stock',
    label: 'Stock bajo',
    description: 'Cuando un producto cae por debajo del umbral configurado',
    icon: 'AlertTriangle',
    color: 'text-yellow-500',
    defaultEnabled: true,
    hasThreshold: true,
    thresholdKey: 'low_stock_threshold',
    thresholdLabel: 'Umbral mínimo de unidades',
    defaultThreshold: 5,
  },
  {
    type: 'order_status_change',
    label: 'Cambio de estado de pedido',
    description: 'Cuando el estado de una orden cambia (procesando, enviado, etc.)',
    icon: 'RefreshCw',
    color: 'text-blue-500',
    defaultEnabled: true,
  },
]

export type InappNotificationsConfig = {
  [K in NotificationType]: boolean
} & {
  low_stock_threshold?: number
}

export const DEFAULT_INAPP_NOTIFICATIONS: InappNotificationsConfig = {
  new_order: true,
  low_stock: true,
  low_stock_threshold: 5,
  order_status_change: true,
}

/** Parsea el JSONB de settings.inapp_notifications con defaults seguros */
export function parseInappConfig(raw: unknown): InappNotificationsConfig {
  const obj = (raw as Record<string, unknown>) ?? {}
  return {
    new_order: (obj.new_order as boolean) ?? DEFAULT_INAPP_NOTIFICATIONS.new_order,
    low_stock: (obj.low_stock as boolean) ?? DEFAULT_INAPP_NOTIFICATIONS.low_stock,
    low_stock_threshold:
      Number.isFinite(obj.low_stock_threshold as number)
        ? Number(obj.low_stock_threshold)
        : DEFAULT_INAPP_NOTIFICATIONS.low_stock_threshold,
    order_status_change:
      (obj.order_status_change as boolean) ?? DEFAULT_INAPP_NOTIFICATIONS.order_status_change,
  }
}
