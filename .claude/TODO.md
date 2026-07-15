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

## Bugs detectados

### 🟠 Alta

- 🟠 `src/hooks/useProductDetail.ts` — `useProductPurchaseItems` hace `select` de `order_number` en el join a `purchase_orders`, pero esa columna no existe ahí (es `po_number`; `order_number` pertenece a la tabla `orders`). Probable copy-paste desde `useProductSales`. La query debería fallar en runtime por columna inexistente.

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

## Módulos de organización (toggles branches/transfers)

### 🟢 Baja

- 🟢 Los toggles `branches_enabled`/`transfers_enabled` de `organizations.settings` son enforcement solo de UI (sidebar + route guard), sin RLS/backend gate. Esto es una decisión de diseño intencional (no-goal documentado en el SDD `org-module-toggles`, no una deuda olvidada): un usuario que bypasee el cliente (API directa) igual accede a los datos de sucursales/transferencias. RBAC + RLS siguen siendo la barrera de seguridad real; el toggle es una preferencia de superficie de UI para el operador de plataforma.

## UX/Diseño — Panel Admin (auditoría impeccable, 2026-07-14 — rebrand + limpieza estética completa)

Todo lo marcado ✅ en esta sección fue implementado, verificado (`tsc --noEmit` limpio + 249/249 tests) y pasó una revisión adversarial en contexto fresco antes de cerrarse. Lo que queda abierto es explícitamente **no estético** (arquitectura/funcional) — se dejó fuera de esta pasada a propósito.

### 🟠 Alta (queda abierto — fuera de alcance de "cambios estéticos")

- 🟠 Ningún flujo de eliminación usa el `*DeleteModal.tsx` que manda la convención del proyecto — todos usan `confirm()` nativo (`AdminSuppliers.tsx:195`, `AdminCategories.tsx:202`, `AdminProducts.tsx:1280`, `AdminBranches.tsx:210`, `AdminOrganizations.tsx:86`). Es un cambio de componente/interacción, no puramente visual — pendiente de una pasada dedicada.

### 🟡 Media (queda abierto)

- 🟡 55/61 archivos de `components/admin` + `pages/admin` mezclan clases `admin-*` con colores Tailwind crudos (`blue-`, `green-`, `yellow-`, `purple-`, `orange-`, etc.) para badges no cubiertos por `statusColors.ts` (roles de usuario, deltas financieros). Estos son colores semánticos legítimos por categoría (no deben forzarse al token de marca `admin-*`); lo que falta es decidir un vocabulario de color por categoría (ej. roles en `AdminUsers.tsx`) — es una decisión de producto, no mecánica.
- 🟡 `ROUTE_LABELS` de `AdminBreadcrumbs.tsx` desactualizado — faltan `/expenses`, `/store/stats`, `/planes`, `/reposicion`, `/billing/comprobantes`, caen a un label genérico.
- 🟡 Gating de rutas inconsistente: solo `/reports/*`, `/branches` y `/transfers` tienen guard real a nivel de ruta; el resto de las páginas restringidas solo se ocultan del sidebar, así que una URL directa igual accede (verificar si cada página valida permisos internamente).
- 🟡 Loading mixto en varias páginas: conviven `<Skeleton>` correcto para un estado y `animate-spin` crudo para otro dentro del mismo archivo (`AdminSales.tsx:410` vs `:413-417`, `AdminRolesPermissions.tsx:420`, `AdminUsers.tsx:610`).
- 🟡 `PAGE_SIZE_ADMIN` centralizado solo se usa realmente en 8 páginas; el resto define constantes locales divergentes (`AdminInventory.tsx` define `DEFAULT_PAGE_SIZE=25` y lo ignora para paginación real, `AdminProducts.tsx:44` hardcodea 25, `AdminBillerComprobantes.tsx:45` usa 25, `AdminExpenses.tsx:117` usa 20, `AdminAuditLogs.tsx:98` usa 50, `AdminFinancialReports.tsx:223` usa 5000).
- 🟡 El tab bar mobile de `AdminLayout.tsx:709-714` es un array hardcodeado de 4 items independiente de `navSections` — riesgo de desincronización manual cada vez que cambia el menú.
- 🟡 **Nuevo (hallado en la revisión adversarial post-rebrand, 2026-07-14):** el rebrand de `admin-*` a la escala navy hizo que `admin-400`/`admin-500` sean más "lavados" que el azul anterior — verificar cualquier uso de `text-admin-400`/`text-admin-500` (no `bg-`/`border-`) sobre fondo claro, ej. `OnboardingChecklist.tsx:316`, para confirmar que sigue pasando el piso de contraste 4.5:1 (bg-/border- no aplica, solo texto).

### 🟢 Baja (queda abierto)

- 🟢 `src/pages/admin/AdminNotificationSettings.tsx` es código muerto: no está importada en `App.tsx` ni referenciada en el nav — no tiene ruta.
- 🟢 Doble affordance de "volver" en páginas de detalle: el breadcrumb ya lo resuelve y además hay un botón "Volver a X" redundante (`AdminProductDetail.tsx:254-258`, `AdminOrderDetail.tsx:1106-1107/1230-1231`, `AdminCustomerDetail.tsx:214-215`).
- 🟢 Mezcla español/inglés en rutas y nombres: `/roles-permissions` (kebab) vs resto sin guiones, `/planes`/`/reposicion` en español junto a `/products`/`/orders` en inglés, `AdminDebtors` (inglés) junto a `AdminReposicion`/`AdminBillerComprobantes` (español).
- 🟢 **Nuevo:** el toast de debug en `AdminOrganizations.tsx` (ex-`alert()`) muestra un dump multilínea de diagnóstico RLS; `Toast` renderiza el mensaje en un `<p>` simple, así que los saltos de línea no se ven — es un botón de debug interno, no un flujo de usuario final, pero si se usa seguido conviene un componente de detalle en vez de un toast.

## Infraestructura / Config

- 🟡 Actualizar keys de Twilio en producción para `stale-orders-notifier` — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` deben estar configuradas en los secrets de la Edge Function (`supabase/functions/stale-orders-notifier/index.ts`)
- 🟠 Evaluar si habilitar Supabase MCP (`disabledMcpjsonServers` en settings.local.json) — actualmente deshabilitado, verificar si fue intencional o accidental
- 🟡 Mover archivos de planificación del root a `docs/`: `BARCODE_STRUCTURE.md`, `CUSTOMERS_FEATURE.md`, `GTM_STRATEGY.md`, `IMPLEMENTATION_PLAN.md`, `LOT_TRACKING_PLAN.md`, `MULTI_BRANCH_MIGRATION_SUMMARY.md`, `MULTI_STORE_PLAN.md`, `PROJECT_SUMMARY.md`, `PWA_SETUP.md`, `STOCK_IMPROVEMENTS.md`, `YOUTUBE_SCRIPT.md`, `axios-improvement-plan.md`
- 🟢 Mover `gimnasios_cdmx.xlsx`, `locales_montevideo.xlsx`, `scrape_contacto.py`, `script.py` fuera del root (no pertenecen al proyecto)

## UX/Diseño — Tienda Pública (auditoría impeccable, 2026-07-14 — bug de precio + rebrand de contraste dinámico + limpieza estética)

Todo lo marcado ✅ más abajo fue implementado, verificado (`tsc --noEmit` limpio + 261/261 tests + lint en el mismo baseline) y pasó una revisión adversarial en contexto fresco. **No se pudo verificar visualmente en navegador** — la extensión de Chrome no estaba conectada en la sesión y no había un slug de organización de prueba disponible para levantar Playwright contra un local con datos reales; la verificación fue por lectura de código + sintaxis de clases arbitrarias de Tailwind, no por captura de pantalla real. Recomendado hacer una pasada visual manual con un org real la próxima vez que se abra el proyecto.

### 🟠 Alta (queda abierto — fuera de alcance de "cambios estéticos")

- 🟠 La barra de filtros de `Products.tsx` y `CategoryProducts.tsx` sigue duplicada por copy-paste en vez de reusar los componentes de `src/components/filters/` (`CategoryFilter`, `PriceRangeFilter`, `SearchFilter`, etc.) — esos componentes hoy solo los usa `AdminCashRegister.tsx`. No es un defecto visual (ambas páginas ya se ven bien, iguales entre sí), es deuda de mantenimiento — se dejó fuera de la pasada estética a propósito.

### 🟡 Media (queda abierto)

- 🟡 `CategoryProducts.tsx:14` hardcodea `PAGE_SIZE = 20` (no 24, no importado de `constants.ts`); `src/hooks/usePublicProducts.ts:61` usa 24 pero como constante local duplicada. Es un cambio de comportamiento (cuántos items carga cada página), no estético — se dejó fuera a propósito, igual que se dejó `PAGE_SIZE_ADMIN` sin completar en el panel admin.
- 🟡 Checkout no tiene indicador de progreso/stepper — Carrito → Checkout → Confirmación es un flujo lineal silencioso. Es una adición de feature/UX, no un ajuste visual — backlog.
- 🟡 El submenú de categorías del header desktop depende solo de `:hover`/`group-hover` en CSS — poco confiable en dispositivos híbridos táctiles. Es un problema de interacción, no visual — backlog.
- 🟡 **Nuevo (revisión adversarial):** duplicación de estilo en el CTA del hero de `PublicStore.tsx` — `Button.tsx` ya calcula `backgroundColor`/`color` dinámicos internamente, pero el caller vuelve a especificarlos manualmente porque un `style` prop propio reemplaza (no mergea) el `dynamicStyles` interno de `Button`. Hoy coincide, pero es una trampa de duplicación si `Button` cambia su default — no bloqueante, dejado documentado.

### 🟢 Baja (queda abierto)

- 🟢 Estado de carrito vacío solo ofrece "Continuar Comprando" genérico a home — sin productos sugeridos ni link directo a `/products`. Es una mejora de contenido/feature, no visual.
- 🟢 El gap del grid de skeleton en `PublicStore.tsx` (`gap-4 md:gap-6`) no coincide exactamente con el del grid real (`md:gap-5`) — detectado al arreglar el mismatch de breakpoint del mismo grid; diferencia mínima, no se tocó para no ampliar el diff de esa tarea puntual.

## Completado ✅

- ✅ 2026-07-14 — **Rebrand de paleta admin**: `tailwind.config.js` — escala `admin-*` reemplazada de azul genérico (idéntico al `blue` de Tailwind) por una escala derivada en OKLCH del navy real de marca (`#1c1d33`, `docs/product_marketing.md`); `admin-900` es el hex exacto de marca. Contraste vs. blanco verificado matemáticamente: 600→5.53:1, 700→8.50:1, 800→12.76:1 (todos ≥ AA). Se agregó escala `accent` (derivada del rojo `#fd2525`) para uso puntual, explícitamente separada de la semántica de error/destructivo.
- ✅ 2026-07-14 — **`focus:ring-primary-500` → `focus:ring-admin-500`** en `EditOrganizationModal.tsx` (7 selects de la pestaña "Formato"/checkout/consignación) — escala equivocada, no eran color pickers de storefront.
- ✅ 2026-07-14 — **`src/lib/statusColors.ts`** (nuevo, con 31 tests): fuente única para color de estado de pedido (`getOrderStatusColor`), transferencia (`getTransferStatusColor`) y nivel de stock (`getStockLevelColor`/`getStockLevelFromFlags`/`getStockLevelFromDays`). Migrados a consumirlo: `AdminOrders.tsx`, `AdminOrderDetail.tsx`, `AdminCustomerDetail.tsx`, `CashSessionPayments.tsx`, `AdminTransfers.tsx`, `AdminInventory.tsx`, `AdminReposicion.tsx` — eliminados los 5 mapas locales duplicados. Resuelta la inconsistencia amarillo/rojo para la misma condición `is_low_stock` en `AdminInventory.tsx`.
- ✅ 2026-07-14 — **`alert()` → toast** en las 6 páginas señaladas por la auditoría (`AdminProducts.tsx`, `AdminBranches.tsx`, `AdminSuppliers.tsx`, `AdminOrganizations.tsx`, `AdminCategories.tsx`, `AdminCashRegister.tsx` — 19 call-sites en total). `CLAUDE.md` corregido: documentaba `'warning'` como tipo válido de toast, pero `ToastType` real es `'success'|'error'|'info'` — no existe `'warning'` en el código; se ajustó la doc para reflejar la realidad (agregar el tipo queda en el backlog de Media si se quiere en el futuro).
- ✅ 2026-07-14 — **3 barras de filtro `<Card>` → inline** (`AdminSales.tsx`, `AdminBillerComprobantes.tsx`, `AdminExpenses.tsx`), según la convención obligatoria del proyecto (sin Card, controles `h-9`, "Limpiar" condicional).
- ✅ 2026-07-14 — **Normalización de tamaño de título de página** a `text-2xl sm:text-3xl font-bold`: `AdminOrders.tsx`, `AdminUsers.tsx`, `AdminOrganizations.tsx`, `AdminPlans.tsx`, `AdminLots.tsx`, `AdminBillerComprobantes.tsx` (título de página principal), `AdminStoreStats.tsx`. (El `<h1>` de "Biller no configurado" en `AdminBillerComprobantes.tsx:171` se dejó sin tocar a propósito — es un título de empty-state dentro de una card centrada, no un page-header; agrandarlo lo haría ver fuera de lugar.)
- ✅ 2026-07-14 — **AdminProducts.tsx**: 6 `alert()` migrados a `useToastStore` (:790,795,894,898,988,1292), empty state de la pestaña Descuentos migrado a `<EmptyState>` (antes hardcodeado en `:266-268`), `aria-label="Cerrar"` agregado al × del modal de descuentos. `<h1>` duplicado reportado por la auditoría inicial revisado y descartado: la línea 1417 pertenece al documento HTML separado de `exportProductsPdf` (ventana de impresión), no es JSX duplicado.
- ✅ 2026-07-14 — **`aria-label` en botones de limpiar búsqueda**: `AdminOrders.tsx:325`, `AdminInventory.tsx:1255`, `AdminSuppliers.tsx:279` (más el × del modal de descuentos en `AdminProducts.tsx`).
- ✅ 2026-07-14 — **Wording de "Exportar" estandarizado a "Exportar CSV"** en `AdminSales.tsx` y `AdminInventory.tsx` (verificado contra el handler real: ambos generan `.csv`, no Excel).
- ✅ 2026-07-14 — **AdminStoreStats.tsx**: colores hardcodeados del gráfico Recharts (`#8F5F2C`, `#10b981`, `#9ca3af`, `#e5d1bc`, etc.) reemplazados por `src/lib/chartColors.ts` (nuevo, `CHART_COLORS`/`CHART_TOOLTIP_SHADOW`) mapeados a `admin-600`/`admin-700`. El rojo de acento (`accent`) se dejó deliberadamente fuera de las series del gráfico para no confundir "color de marca" con "dato negativo".
- ✅ 2026-07-14 — Navy de marca (`#1c1d33`/`#12192C`) reemplazado por `bg-admin-900`/`text-admin-900` en `AdminLayout.tsx` (:284,450,675,707), `WelcomeModal.tsx` (:51), `OnboardingChecklist.tsx` (:239), `InstallBanner.tsx` (:11); `ShareStoreModal.tsx` (:20) queda como literal hex `#1c1d33` (config de `QRCode.toCanvas`, no acepta clases Tailwind) pero ya alineado al valor exacto de `admin-900`. Quedan literales sin tocar en `Landing.tsx`, `LandingFacturacion.tsx` (landings públicas) y `POSHome.tsx`/`POSHeader.tsx` (fuera del alcance de esta tarea, que era solo chrome del panel admin).
- ✅ 2026-07-14 — **Fix post-revisión adversarial**: `AdminReposicion.tsx` — la migración inicial a `statusColors.ts` forzaba `isLowStock: true` en `getStockLevelFromFlags`, lo que convertía en amarillo el número de `stock_actual` para cualquier fila con stock > 0 (antes siempre rojo, correcto para esta página — cada fila listada ya necesita reposición). Revertido a `text-red-600` fijo para `stock_actual`; se mantiene la migración de `dias_stock` a `getStockLevelFromDays` (esa sí era una mejora real, sin regresión).
- ✅ 2026-07-14 — **Bug de precio real corregido**: `ProductDetail.tsx` y `VariantSelector.tsx` usaban `selectedVariant.price ?? product.price` (mostraba precio sin descuento cuando la variante no tenía precio propio); cambiado a `getEffectivePrice(product)`, igual que `Cart.tsx`/`Checkout.tsx`. De paso, `VariantSelector.tsx` tenía sus propios colores hardcodeados en azul estático (chips de atributo, item de variante, precio, spinner) — migrados a `var(--org-primary-color)`.
- ✅ 2026-07-14 — **`src/lib/colorContrast.ts`** (nuevo, 12 tests, matemática WCAG verificada a mano): `getReadableTextColor(bgHex)` calcula si texto blanco o tinta oscura (`#111827`) da mejor contraste contra un color de fondo dado. Conectado en `PublicStoreLayout.tsx`, que ahora inyecta `--org-primary-ink`/`--org-secondary-ink`/`--org-accent-ink` junto a los `--org-*-color` existentes — resuelve que una organización con color de marca claro/pastel tuviera texto blanco invisible en sus CTAs. Wireado en: `Button.tsx` (variantes primary/secondary), `ProductCard.tsx` (botón flotante), `Products.tsx`/`CategoryProducts.tsx` (chips activos), `PublicStore.tsx` (CTA del hero), `Footer.tsx` (avatar del logo), y — en un fix post-revisión — **`PublicStoreHeader.tsx` completo** (~30 ocurrencias de `text-white`/`text-white/NN`: nav de categorías, logo, buscador desktop/mobile, botones de carrito/menú, panel de búsqueda mobile, menú mobile), que la primera pasada había dejado afuera por error de alcance mío (asumí que el header "frosted glass" quedaba exento, cuando en realidad el fondo semitransparente ES el color de marca).
- ✅ 2026-07-14 — **`Checkout.tsx` usa color dinámico de marca**: precio del resumen y método de pago seleccionado migrados de `primary-*` (azul estático) a `var(--org-primary-color)` / patrón de chip seleccionado con tinte claro (igual que `VariantSelector.tsx`).
- ✅ 2026-07-14 — **`Cart.tsx`**: clases `primary-*` muertas/engañosas eliminadas de los botones (ya se veían bien por el `style` inline de `Button`, pero el className mentía); spinner de carga migrado a color dinámico; `aria-label` agregado a decrementar/incrementar/eliminar ítem.
- ✅ 2026-07-14 — **`Products.tsx`**: agregado el `<h1>` de página que faltaba ("Todos los productos").
- ✅ 2026-07-14 — **`CategoryProducts.tsx`**: ancho de inputs de precio corregido de `w-24` a `w-28` (igual que `Products.tsx`).
- ✅ 2026-07-14 — **`PublicStore.tsx`**: grid de skeleton corregido para incluir `xl:grid-cols-5` (coincide con el grid real).
- ✅ 2026-07-14 — **`ProductDetail.tsx`**: agregado overlay "Sin stock" sobre la imagen (antes solo lo tenía `ProductCard.tsx` en la grilla); heading de "Productos relacionados" normalizado a `text-xl md:text-2xl` (coincide con el patrón de Home); pequeño rename de variable (`currentStock` sombreaba una constante del mismo nombre en el scope del componente).
- ✅ 2026-07-14 — **`PublicStoreHeader.tsx` y `Footer.tsx`**: agregada validación defensiva de formato hex antes de concatenar el sufijo de alpha (`${color}ee`, etc.) — hoy es un no-op visual (el valor siempre es hex válido) pero evita que un valor mal formado produzca un color CSS inválido en silencio.
- ✅ 2026-07-14 — **Escala Tailwind `warm-*` eliminada** de `tailwind.config.js` — cero usos confirmados en todo `src/`.
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
