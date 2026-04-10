# Integración Mercado Pago

## Estado actual

| Componente | Estado |
|---|---|
| Edge Function `create-mp-preference` | ✅ Implementada |
| Edge Function `mp-webhook` | ✅ Implementada |
| Checkout redirige a MP cuando el método es `mercadopago` | ✅ Implementado |
| Deploy de las edge functions | ⏳ Pendiente |
| Configurar secret `PUBLIC_APP_URL` en Supabase | ⏳ Pendiente |
| Prueba end-to-end en sandbox | ⏳ Pendiente |
| Moneda configurable por org (lee `organizations.settings.currency`) | ✅ Implementado |
| Guardar `mp_payment_id` y `mp_status` en `order_payments` | ✅ Implementado |
| Signature verification en webhook (header `x-signature`) | ✅ Implementada |
| Notificar al usuario por email cuando el pago es aprobado | ⏳ Pendiente |
| Panel admin: mostrar estado del pago MP en detalle de orden | ⏳ Pendiente |

---

## Arquitectura

```
Usuario confirma orden (MP seleccionado)
        ↓
Checkout.tsx → POST /functions/v1/create-mp-preference
        ↓
create-mp-preference/index.ts:
  1. Lee access_token de organization_payment_methods WHERE key='mercadopago'
  2. Crea la orden en DB (status: pending — ya lo hizo el checkout antes de llamar)
  3. POST https://api.mercadopago.com/checkout/preferences con:
       - items (de order_items)
       - external_reference = order_id
       - back_urls → /{org-slug}/order-confirmation/{order_id}
       - notification_url → /functions/v1/mp-webhook
  4. Retorna { init_point, preference_id }
        ↓
Checkout redirige el browser a init_point
        ↓
Usuario paga en Mercado Pago
        ↓
MP llama POST /functions/v1/mp-webhook (server-to-server)
        ↓
mp-webhook/index.ts:
  1. Recibe { type: "payment", data: { id: payment_id } }
  2. Busca el access_token de la org iterando organization_payment_methods
  3. GET https://api.mercadopago.com/v1/payments/{payment_id}
  4. Lee external_reference = order_id
  5. Mapea status MP → status orden (approved→processing, rejected→cancelled, etc.)
  6. UPDATE orders SET status = ... WHERE id = order_id
        ↓
MP redirige usuario a back_url → order-confirmation page
```

---

## Configuración requerida

### 1. Credenciales por organización

En el panel admin → Organización → Métodos de pago → Mercado Pago:

| Campo | Descripción |
|---|---|
| `access_token` | Token privado (`APP_USR-...`). Nunca exponerlo al cliente. |
| `public_key` | Clave pública (`APP_USR-...`). Usada para el brick de MP si se implementa. |
| `sandbox` | `true` para pruebas, vacío para producción. |

### 2. Secrets de Supabase (deploy)

```bash
supabase secrets set PUBLIC_APP_URL=https://axiostock.com
# MP_WEBHOOK_SECRET ya no es necesario — cada org tiene su propio secret en la DB
```

### 3. Deploy de las funciones

```bash
supabase functions deploy create-mp-preference
supabase functions deploy mp-webhook
```

---

## Mapeo de estados MP → orden

| Estado MP | Estado orden |
|---|---|
| `approved` | `processing` |
| `pending` | `pending` |
| `in_process` | `pending` |
| `rejected` | `cancelled` |
| `cancelled` | `cancelled` |
| `refunded` | `cancelled` |
| `charged_back` | `cancelled` |

---

## Pendientes importantes

### Signature verification ✅ (multi-tenant)
Cada organización tiene su propio `webhook_secret` guardado en `organization_payment_methods.config`.

La `notification_url` incluye el `org_id`:
```
https://<project>.supabase.co/functions/v1/mp-webhook?org=<organization_id>
```

Así el webhook sabe qué secret usar sin ningún global compartido. Flujo:
1. Extrae `org_id` del query param `?org=`
2. Lee `config.webhook_secret` de `organization_payment_methods`
3. Verifica `HMAC-SHA256(id:<pid>;request-id:<rid>;ts:<ts>;, webhook_secret)`
4. Si no coincide → `401`

**Por cada cliente (org):**
1. MP Dashboard → Su aplicación → Webhooks → URL: `.../mp-webhook?org=<org_id>` → copiar **Clave secreta**
2. Admin panel → Métodos de pago → Mercado Pago → pegar en **Webhook Secret Key**

No se requiere ningún secret global en Supabase.

### Moneda
Lee `organizations.settings.currency` (configurable desde Admin → Organización → Moneda). Fallback a `UYU` si no está configurado.

### mp_payment_id en order_payments
`mp-webhook` guarda `mp_payment_id` y `mp_status` directamente en `order_payments` (columnas agregadas en migration `116_order_payments_mp_payment_id.sql`). Hay un índice único en `mp_payment_id` para evitar duplicados.

### Brick de Mercado Pago (alternativa al redirect)
En lugar de redirigir a MP, se puede embeber el Checkout Bricks directamente en la página usando la `public_key`. Más fluido para el usuario. Requiere agregar el SDK de MP al frontend.

### Reembolsos
No implementado. Se haría via `POST https://api.mercadopago.com/v1/payments/{id}/refunds` desde una edge function nueva.
