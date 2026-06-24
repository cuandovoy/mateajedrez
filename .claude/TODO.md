# TODO — Axiostock

Archivo mantenido por Claude Code. Se actualiza automáticamente cuando se detecta algo a mejorar.
Prioridades: 🔴 crítico · 🟠 alta · 🟡 media · 🟢 baja

---

## Carrito — Tienda Pública

### 🟠 Alta

- ✅ ~~`cartStore.ts` `addToCart` — para usuarios logueados que NO son admin de esa org, `useOrganizationStore` retornaba null. Resuelto: org ID se deriva del producto fetched.~~

---

## UX — Panel de Clientes (admin)


### 🟢 Baja

_(todos completados)_

---

## Permisos — Panel Admin

### 🟡 Media

- 🟡 `AdminProductDetail.tsx` — no tiene guard de permisos (`catalogo:ver` / `catalogo:gestionar`). Es solo lectura pero el botón de edición tampoco está gateado.
- 🟡 `AdminStoreStats.tsx` — sin guard. Es solo lectura pero no hay verificación de acceso.
- 🟡 Los componentes modales de inventario (`InventoryAdjustmentModal`, `InventoryReceiptModal`, `InventoryTransferModal`, `ManualSaleForm`, `PaymentMethodsManager`, `EditOrganizationModal`) no tienen `usePermission` interno — confían en que el padre ya gateó el botón que los abre. Considerar agregar un check interno para mayor robustez.

---

## Testing

- 🟠 Agregar tests para `src/lib/biller.ts` — lógica de integración DGI sin cobertura
- 🟠 Agregar tests para `src/lib/billerSaleService.ts` — flujo de venta con CFE sin cobertura
- 🟠 Agregar tests para `src/lib/posService.ts` — lógica de POS sin cobertura
- 🟡 Agregar tests para `src/lib/storage.ts` — validaciones de upload sin cobertura
- 🟡 Agregar tests para `src/lib/organization.ts` y `src/lib/orgAccess.ts`
- 🟡 Agregar `@vitest/coverage-v8` y configurar reporter en `vitest.config.ts`

## Performance / Build

- 🟡 Separar `recharts` del chunk `vendor` en `vite.config.ts` — pesa ~300kb y frena el parse inicial
  ```ts
  manualChunks: {
    vendor: ['react', 'react-dom', 'react-router-dom'],
    charts: ['recharts'],
    forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
  }
  ```

## Infraestructura / Config

- 🟡 Actualizar keys de Twilio en producción para `stale-orders-notifier` — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` deben estar configuradas en los secrets de la Edge Function (`supabase/functions/stale-orders-notifier/index.ts`)
- 🟠 Evaluar si habilitar Supabase MCP (`disabledMcpjsonServers` en settings.local.json) — actualmente deshabilitado, verificar si fue intencional o accidental
- 🟡 Mover archivos de planificación del root a `docs/`: `BARCODE_STRUCTURE.md`, `CUSTOMERS_FEATURE.md`, `GTM_STRATEGY.md`, `IMPLEMENTATION_PLAN.md`, `LOT_TRACKING_PLAN.md`, `MULTI_BRANCH_MIGRATION_SUMMARY.md`, `MULTI_STORE_PLAN.md`, `PROJECT_SUMMARY.md`, `PWA_SETUP.md`, `STOCK_IMPROVEMENTS.md`, `YOUTUBE_SCRIPT.md`, `axios-improvement-plan.md`
- 🟢 Mover `gimnasios_cdmx.xlsx`, `locales_montevideo.xlsx`, `scrape_contacto.py`, `script.py` fuera del root (no pertenecen al proyecto)

## Completado ✅

- ✅ 2026-06-14 — **AdminCustomerReports**: filtrado de fecha movido al query de Supabase (server-side) — eliminado fetch masivo de toda la tabla orders
- ✅ 2026-06-14 — **AdminCustomerReports**: spinner de página completa reemplazado por skeleton en primera carga + overlay semitransparente en recargas
- ✅ 2026-06-14 — **AdminCustomerReports**: nombres de clientes en las tres tablas son links a `/customers/:id`
- ✅ 2026-06-14 — **AdminCustomers**: delete reemplazado por modal de confirmación con advertencia de órdenes asociadas
- ✅ 2026-06-14 — **constants.ts + AdminCustomerDetail**: `ACTIVE_ORDER_STATUSES` centralizado; KPIs "Total gastado" y "Órdenes totales" ahora consistentes (excluyen canceladas)
- ✅ 2026-06-14 — **AdminCustomers**: sorting por Nombre/Pedidos + "Ver ficha" en ActionsMenu
- ✅ 2026-06-14 — **AdminCustomerDetail**: links `tel:`/`mailto:` en contacto, badge "Inactivo" en header, paginación progresiva en historial de órdenes
- ✅ 2026-06-14 — **AdminCustomerReports**: BarChart recharts para evolución mensual, botón "Limpiar" en filtros
- ✅ 2026-06-14 — **POSCustomerSearch**: error de red distinguido de resultado vacío con "Reintentar"
- ✅ 2026-06-14 — **AdminCustomerDetail**: modal de edición + botón Editar en header + `navigate(-1)` en botón volver
- ✅ 2026-06-14 — **POSCustomerSearch**: shortcut "Crear cliente" inline cuando búsqueda da vacío
- ✅ 2026-06-14 — **POSCustomerSearch**: navegación por teclado (ArrowUp/Down + Enter + Escape); clientes recientes en estado vacío (localStorage por org)
- ✅ 2026-06-14 — **AdminCustomerReports**: tabla "Base de clientes" con "Mostrar más" progresivo (100 filas iniciales, +100 por click) en lugar del cap fijo de 200

- ✅ 2026-06-14 — Eliminada dependencia muerta `date-fns`
- ✅ 2026-06-14 — Permisos de Claude Code reescritos con allowlist semántico
- ✅ 2026-06-14 — Hook PostToolUse configurado (type-check automático en cada edit)
- ✅ 2026-06-14 — Custom commands creados: `/migration`, `/typecheck`, `/test`, `/types`
- ✅ 2026-06-14 — SDD inicializado, proyecto indexado en Engram (`axios-stock`)
