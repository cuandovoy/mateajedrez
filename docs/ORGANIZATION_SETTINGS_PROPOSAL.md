# Propuesta: Configuración de Organización

Configuraciones sugeridas para hacer el sistema adaptable a distintos tipos de negocio y escalable. La columna `settings` (JSONB) ya existe y puede almacenar la mayoría sin migraciones.

---

## Orden de prioridad sugerido (implementar en este orden)

| # | Configuración | Impacto | Esfuerzo | Motivo |
|---|---------------|---------|----------|--------|
| **1** | `currency` + `locale` | Alto | Bajo | `formatPrice` y `formatDate` están hardcodeados en `es-AR`/`ARS`. Afecta toda la app (caja, órdenes, productos, checkout). |
| **2** | `timezone` | Alto | Bajo | Fechas de órdenes, caja y reportes deben respetar la zona horaria del negocio. |
| **3** | `payment_methods` | Alto | Medio | Checkout y ManualSaleForm muestran siempre cash/transfer/mercadopago. Algunos negocios solo usan efectivo o solo transferencia. |
| **4** | `allow_negative_stock` | Medio | Medio | Regla de negocio crítica: permitir o bloquear ventas con stock insuficiente. |
| **5** | `tax_enabled` + `tax_rate` + `tax_inclusive` | Medio | Medio | Necesario para facturación y reportes en países con IVA. |
| **6** | `low_stock_alert_threshold` | Medio | Bajo | Ya existe `low_stock_threshold` en productos; esto sería el default por org. |
| **7** | `contact_email` + `whatsapp_url` | Medio | Bajo | Útil para OrderConfirmation (envío de comprobante) y contacto. |
| **8** | `legal_name` + `tax_id` (columnas) | Medio | Medio | Para facturas y reportes fiscales. |
| **9** | `allow_guest_orders` | Bajo | Medio | Órdenes sin cuenta. |
| **10** | `features` + límites por plan | Bajo | Alto | Escalabilidad SaaS; implementar cuando haya planes de pago. |

---

## 1. Comercio / Ventas (en `settings`)

| Clave | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `currency` | string | Código ISO 4217 | `"UYU"`, `"USD"`, `"ARS"` |
| `currency_symbol` | string | Símbolo para mostrar | `"$"`, `"US$"` |
| `decimal_places` | number | Decimales en precios | `2` |
| `tax_enabled` | boolean | ¿Aplica IVA/impuestos? | `true` |
| `tax_rate` | number | % de IVA (0-100) | `22` |
| `tax_inclusive` | boolean | Precios con IVA incluido | `true` |
| `allow_negative_stock` | boolean | Ventas con stock insuficiente | `true` |
| `free_shipping_threshold` | number | Mínimo para envío gratis | `2000` |
| `timezone` | string | Zona horaria IANA | `"America/Montevideo"` |

---

## 2. Métodos de Pago (en `settings`)

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `payment_methods` | object | Habilitar/deshabilitar por método |
| `payment_methods.cash` | boolean | Efectivo |
| `payment_methods.transfer` | boolean | Transferencia |
| `payment_methods.mercadopago` | boolean | MercadoPago |

---

## 3. Operaciones (en `settings`)

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `allow_guest_orders` | boolean | Órdenes sin cuenta |
| `require_order_approval` | boolean | Aprobación manual antes de procesar |
| `default_order_status` | string | Estado inicial de órdenes |
| `low_stock_alert_threshold` | number | % stock bajo para alerta |

---

## 4. Facturación / Legal (columnas o `settings`)

Para búsquedas y reportes, conviene columnas:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `tax_id` | VARCHAR | RUC, CUIT, NIF |
| `legal_name` | VARCHAR | Razón social |
| `billing_address` | TEXT/JSON | Dirección fiscal |
| `billing_email` | VARCHAR | Email para facturas |

---

## 5. Comunicación (en `settings`)

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `contact_email` | string | Email de contacto |
| `contact_phone` | string | Teléfono |
| `notification_email` | string | Alertas (stock, órdenes) |
| `whatsapp_url` | string | Link de WhatsApp |

---

## 6. Escalabilidad / Planes (en `settings` o `subscription_tier`)

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `max_products` | number | Límite por plan (null = ilimitado) |
| `max_branches` | number | Límite de sucursales |
| `max_users` | number | Límite de usuarios |
| `features` | array | Módulos habilitados: `["caja","inventory","reports","customers"]` |

---

## 7. UI / Localización (en `settings`)

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `locale` | string | `es`, `en`, `pt` |
| `date_format` | string | `DD/MM/YYYY` o `MM/DD/YYYY` |
| `first_day_of_week` | number | 0=Dom, 1=Lun |

---

## 8. Ejemplo de schema para `settings`

```typescript
type OrganizationSettings = {
  // Comercio
  currency?: string
  currency_symbol?: string
  decimal_places?: number
  tax_enabled?: boolean
  tax_rate?: number
  tax_inclusive?: boolean
  allow_negative_stock?: boolean
  free_shipping_threshold?: number
  timezone?: string

  // Pagos
  payment_methods?: {
    cash?: boolean
    transfer?: boolean
    mercadopago?: boolean
  }

  // Operaciones
  allow_guest_orders?: boolean
  require_order_approval?: boolean
  default_order_status?: string
  low_stock_alert_threshold?: number

  // Comunicación
  contact_email?: string
  contact_phone?: string
  notification_email?: string
  whatsapp_url?: string

  // Planes
  max_products?: number | null
  max_branches?: number | null
  max_users?: number | null
  features?: string[]

  // UI
  locale?: string
  date_format?: string
  first_day_of_week?: number
}
```

---

## 9. Migración sugerida (columnas nuevas)

```sql
-- Solo para datos que necesitan indexación o filtros
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);
```

---

## 10. Resumen ejecutivo

**Implementar primero (Fase 1):**
1. `currency` + `locale` → adaptar `formatPrice` y `formatDate` en `@/lib/utils.ts` para recibir settings de org
2. `timezone` → usar en fechas de órdenes, caja y reportes

**Implementar después (Fase 2):**
3. `payment_methods` → filtrar opciones en Checkout y ManualSaleForm según org
4. `allow_negative_stock` → validar antes de confirmar venta
5. `tax_*` → cálculo de IVA en totales y facturación

**Implementar cuando escale (Fase 3):**
6. Resto: contacto, legal, guest orders, features por plan

---

## 11. Uso en el código

```typescript
// formatPrice con settings de org
function formatPrice(price: number, settings?: OrganizationSettings): string {
  const currency = settings?.currency ?? 'UYU'
  const decimals = settings?.decimal_places ?? 2
  return new Intl.NumberFormat(settings?.locale ?? 'es-UY', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price)
}
```
