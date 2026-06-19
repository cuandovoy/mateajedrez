# Payment & Inventory Integrity — Plan de implementación

## Principios transversales

- **Idempotencia obligatoria**: cualquier cron puede correr dos veces sin efecto doble
- **Detectar, no asumir**: los crons leen estado real de MP antes de actuar
- **Nunca auto-cancelar sin evidencia**: solo cancelar cuando MP confirma rechazo/inexistencia
- **Patrón de infraestructura**: pg_cron + net.http_post → Edge Function (igual que `daily-sales-summary`)

---

## Items

### 01 — mp-payment-reconciler
**Estado**: ✅ Completado

**Qué hace**: Consulta MP cada 15 min por órdenes `pending` con placeholder de pago sin `mp_payment_id`. Si MP ya aprobó, procesa igual que el webhook. Cubre el caso donde el IPN falló o no llegó.

**Riesgo sin fix**: Revenue invisible · stock incorrecto indefinidamente

**Archivos**:
- `supabase/functions/mp-payment-reconciler/index.ts` — Edge Function
- `supabase/migrations/132_pg_cron_mp_payment_reconciler.sql` — cron + RPC helper
- `supabase/config.toml` — verify_jwt = false

**Criterios de aceptación**:
- [ ] Procesa máx 50 órdenes por ciclo (evita timeout)
- [ ] Prioriza pagos `approved` sobre cualquier otro estado
- [ ] Si hay pago `in_process`/`pending` en MP, deja la orden (la revisa en el próximo ciclo)
- [ ] Actualiza `orders.status` + llena el placeholder en `order_payments`
- [ ] No toca órdenes con `created_at > 24h` (las maneja el cron 03)
- [ ] Idempotente: si ya tiene `mp_payment_id`, no hace nada

---

### 02 — webhook-secret-enforcement
**Estado**: ✅ Completado

**Qué hace**: Si una org no tiene `webhook_secret`, rechazar con 401 en lugar de procesar. Cualquiera que conozca la URL puede forjar notificaciones hoy.

**Archivos**:
- `supabase/functions/mp-webhook/index.ts` — cambio de comportamiento en verificación

---

### 03 — abandoned-cart-cleanup
**Estado**: ✅ Completado

**Qué hace**: Cancela órdenes MP en `pending` con +24h donde MP no tiene pago activo. Restaura stock vía trigger existente.

**Archivos**:
- `supabase/functions/abandoned-cart-cleanup/index.ts`
- `supabase/migrations/133_pg_cron_abandoned_cart_cleanup.sql`
- `supabase/config.toml` — verify_jwt = false

---

### 04 — order_payments.updated_at
**Estado**: ✅ Completado

**Qué hace**: Agrega columna `updated_at` con trigger de auto-update a `order_payments`.

**Archivos**:
- `supabase/migrations/134_order_payments_updated_at.sql`

---

### 05 — stale-orders-notifier
**Estado**: ✅ Completado

**Qué hace**: Detecta órdenes stuck por tipo y notifica al merchant via `notification_queue` (Twilio ya existe).

**Casos**:
- `pending_allocation` sin asignar en +24h
- `pending` con pago no-MP en +2h
- `processing` sin avanzar en +7 días

**Archivos**:
- `supabase/functions/stale-orders-notifier/index.ts`
- `supabase/migrations/135_pg_cron_stale_orders_notifier.sql`
- `supabase/config.toml` — verify_jwt = false

---

### 06 — inventory-drift-auditor
**Estado**: ✅ Completado

**Qué hace**: Compara `branch_inventory.stock` vs `new_stock` del último `inventory_movements` para cada entrada. Registra diferencias en `inventory_drift_log` — sin mutar nada. Ignora entradas sin movimientos (no hay baseline). Corre diariamente a las 3am.

**Archivos**:
- `supabase/functions/inventory-drift-auditor/index.ts`
- `supabase/migrations/136_pg_cron_inventory_drift_auditor.sql` — tabla + RPC + cron
- `supabase/config.toml` — verify_jwt = false

**Criterios de aceptación**:
- [x] Solo lee datos — nunca muta `branch_inventory.stock`
- [x] Ignora entradas sin ningún movimiento registrado (no hay baseline)
- [x] Registra en `inventory_drift_log`: stock actual, stock esperado, drift, último movimiento
- [x] Insert en batches de 500 (evita payload limits)
- [x] RLS: solo admins/managers pueden ver los logs
- [x] Cron: diario a las 3am
