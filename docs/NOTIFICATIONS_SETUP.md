# Configuración de notificaciones por email

## Resumen

El sistema envía emails automáticamente cuando:
- **Nueva orden**: Se crea una orden (Checkout o venta manual) y la org tiene `new_order_notify` activado
- **Cambio de estado**: Se actualiza el estado de una orden y la org tiene `order_status_notify_customer` activado (solo si el cliente tiene email)

## Requisitos

- Plan **Profesional** (la configuración de notificaciones está restringida por plan)
- **Resend** como proveedor de email (u otro compatible con la Edge Function)

## Configuración

### 1. Variables de entorno para la Edge Function

Configurar en Supabase (Dashboard > Edge Functions > send-notification > Secrets):

- `RESEND_API_KEY`: API key de Resend (obtener en resend.com)
- `FROM_EMAIL`: Email remitente (ej. `notificaciones@tudominio.com`). Por defecto usa `notificaciones@resend.dev`
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: Ya configurados por Supabase

### 2. URL de la Edge Function (producción)

Para Supabase Cloud, actualizar la URL en la base de datos:

```sql
UPDATE notification_config
SET value = 'https://TU_PROJECT_REF.supabase.co/functions/v1/send-notification'
WHERE key = 'edge_function_url';
```

Para Supabase en VPS/self-hosted, usar la URL real de tus Edge Functions.

### 3. Configuración por organización

En Admin > Organizaciones > Editar > pestaña **Notificaciones**:

- Email para notificaciones (admin)
- Notificar nueva orden
- Notificar stock bajo (próximamente)
- Notificar al cliente al cambiar estado

## Flujo técnico

1. **Orden nueva** o **cambio de estado** → trigger en DB inserta en `notification_queue`
2. Trigger de `notification_queue` → llama a la Edge Function vía pg_net
3. Edge Function → envía email con Resend y actualiza `status` a `sent` o `failed`

## Verificación

- Crear una orden con una org que tenga notificaciones configuradas
- Cambiar el estado de una orden que tenga `customer_id` con email
- Revisar la tabla `notification_queue` para ver el estado de cada notificación
