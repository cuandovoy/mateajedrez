# TODO — Axiostock

Archivo mantenido por Claude Code. Se actualiza automáticamente cuando se detecta algo a mejorar.
Prioridades: 🔴 crítico · 🟠 alta · 🟡 media · 🟢 baja

---

## UX — Panel de Clientes (admin)

### 🔴 Crítico

- 🔴 `AdminCustomerReports.tsx` — descarga TODO el historial de órdenes al cliente para luego filtrar por fecha en memoria. Con un volumen alto de órdenes, esto colapsa. Hay que mover el filtro de fecha al query de Supabase (`gte`/`lte` en `created_at`)
- 🔴 `AdminCustomerDetail.tsx` — no hay forma de editar el cliente desde la ficha. El usuario tiene que volver al listado, buscarlo, y usar el menú de acciones. Agregar botón Editar en el header de la ficha
- 🔴 `POSCustomerSearch.tsx` — si el cliente no existe, no hay forma de crearlo desde el POS. El cajero tiene que salir del POS, ir a Clientes, crear, y volver. Agregar shortcut "Crear cliente" cuando la búsqueda no da resultados

### 🟠 Alta

- 🟠 `AdminCustomerDetail.tsx` — `navigate('/customers')` en el botón volver destruye el estado de filtros y página del listado. Cambiar a `navigate(-1)`
- 🟠 `AdminCustomerReports.tsx` — spinner de página completa en cada cambio de filtro (toda la UI desaparece). Usar skeleton overlay o stale-while-revalidate
- 🟠 `AdminCustomerReports.tsx` — no hay ningún link desde las filas de la tabla de reporte a `AdminCustomerDetail`. Click en nombre de cliente debería navegar a la ficha
- 🟠 `AdminCustomers.tsx` — delete con `window.confirm` directo, sin modal, y sin guardia contra clientes con órdenes (falla silenciosa con toast genérico). Agregar modal de confirmación con warning si tiene órdenes
- 🟠 Inconsistencia de definición de "orden completada" entre las 3 páginas: `AdminCustomers` cuenta todas, `AdminCustomerDetail` excluye `pending_allocation` y `cancelled`, `AdminCustomerReports` incluye `pending_allocation`. Definir un criterio único en `src/lib/constants.ts`

### 🟡 Media

- 🟡 `AdminCustomers.tsx` — sin sorting por columna. La tabla es siempre `created_at DESC`. Agregar click-to-sort en Nombre, Órdenes
- 🟡 `AdminCustomers.tsx` — el menú de acciones (ActionsMenu) no tiene "Ver detalle". La única forma es hacer click en el nombre como link. Agregar acción "Ver ficha"
- 🟡 `AdminCustomerDetail.tsx` — teléfono y email se muestran como texto plano en la card de contacto. Convertirlos en links (`tel:`, `mailto:`, `wa.me/`)
- 🟡 `AdminCustomerDetail.tsx` — los KPI "Total gastado" y "Total órdenes" son inconsistentes: órdenes cuenta canceladas pero gastado las excluye. El usuario ve números que no cierran
- 🟡 `AdminCustomerDetail.tsx` — sin badge de estado activo/inactivo en el header. Si el cliente está desactivado, no hay ningún indicador visual
- 🟡 `AdminCustomerDetail.tsx` — sin paginación en el historial de órdenes. Si el cliente tiene 300 órdenes, se cargan todas de una vez
- 🟡 `AdminCustomerReports.tsx` — página llamada "Reportes" sin ningún gráfico. La evolución mensual es una lista de texto. Agregar al menos un `BarChart` de recharts para la evolución de ventas mensuales
- 🟡 `AdminCustomerReports.tsx` — el patrón de filtros es inconsistente: búsqueda/segmento/sort se aplican al instante, pero fecha/sucursal requieren "Aplicar filtros". Todo debería ser consistente
- 🟡 `POSCustomerSearch.tsx` — errores de red son silenciosos: muestra "No se encontraron clientes" igual que un resultado vacío real. Distinguir los casos con un mensaje de error

### 🟢 Baja

_(todos completados)_

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
