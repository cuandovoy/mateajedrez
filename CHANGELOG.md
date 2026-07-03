# Changelog — Axiostock

Registro de cambios realizados por Claude Code. Entradas en orden descendente.

---

## 2026-06-26 — Quick access bar global sticky en AdminLayout

- **Archivos modificados:** `src/components/admin/QuickAccess.tsx`, `src/components/layout/AdminLayout.tsx`, `src/pages/admin/AdminDashboard.tsx`
- **Qué cambió:** Agrega prop `compact?: boolean` a `QuickAccess` que reduce padding (`p-3`), ícono (`h-5 w-5`) y label (`text-xs`) para uso en espacios reducidos. Inserta una barra sticky `top-[52px]` con `<QuickAccess compact />` como primer hijo de `<main>` en `AdminLayout`, visible solo en desktop (`hidden lg:block`). Elimina `<QuickAccess />` y su wrapper `<div className="mb-6" />` de `AdminDashboard` para evitar duplicado.

## 2026-06-26 — Quick access panel en el dashboard admin y simplificación de métricas

- **Archivos modificados:** `src/components/admin/QuickAccess.tsx` (nuevo), `src/components/admin/DashboardMetrics.tsx`, `src/pages/admin/AdminDashboard.tsx`
- **Qué cambió:** Crea el componente `QuickAccess` con 6 botones de acceso rápido en grilla responsive (2/3/6 columnas). Elimina `TrendsSection` (bar chart de recharts) de `DashboardMetrics` y extrae el top-5 de productos como componente standalone `TopProductsCard`. Agrega `<QuickAccess />` como primer elemento del dashboard, antes de los modales de bienvenida.

## 2026-06-25 — Infraestructura legal: Política de Privacidad, Términos y Condiciones y consentimiento

- **Archivos modificados:** `src/pages/PoliticaPrivacidad.tsx` (nuevo), `src/pages/TerminosCondiciones.tsx` (nuevo), `src/pages/Register.tsx`, `src/pages/Checkout.tsx`, `src/App.tsx`
- **Qué cambió:** Crea dos nuevas páginas legales públicas (`/legal/privacidad` y `/legal/terminos`) con contenido específico para Uruguay (Ley 18.331, Decreto 414/009, derechos ARCO, Biller v2 como subprocesador, jurisdicción Montevideo). Agrega checkbox de consentimiento obligatorio en el formulario de registro (`z.literal(true)` en el schema Zod). Agrega aviso de privacidad junto al botón de confirmación en Checkout. Registra ambas rutas como públicas en `App.tsx`, fuera de todos los layouts protegidos.

---

## 2026-06-24 — Guards de permisos completos en todo el panel admin

- **Archivos modificados:** `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminNotificationSettings.tsx`, `src/pages/admin/AdminBranches.tsx`, `src/pages/admin/AdminTransfers.tsx`, `src/pages/admin/AdminLots.tsx`, `src/pages/admin/AdminCategories.tsx`, `src/pages/admin/AdminSuppliers.tsx`, `src/components/admin/BranchTable.tsx`, `src/components/admin/CategoryTable.tsx`, `src/components/admin/SupplierTable.tsx`, `src/components/admin/LotDetailPanel.tsx`, `src/components/layout/AdminLayout.tsx`
- **Qué cambió:** Agrega guards `usePermission` a todas las páginas admin restantes. Cada página muestra skeleton mientras cargan los permisos, retorna `null` sin acceso `ver`, y oculta acciones de mutación sin `gestionar`. Los table components (`BranchTable`, `CategoryTable`, `SupplierTable`, `LotDetailPanel`) tienen sus props de mutación ahora opcionales, ocultando el ActionsMenu cuando no se pasa el handler. Fix: nav de `/branches` corregido de `inventario:ver` a `configuracion:ver`.

## 2026-06-24 — Guards de permisos en 5 páginas del panel admin

- **Archivos modificados:** `src/pages/admin/AdminExpenses.tsx`, `src/pages/admin/AdminCashRegister.tsx`, `src/pages/admin/AdminInventory.tsx`, `src/pages/admin/AdminProducts.tsx`, `src/pages/admin/AdminReposicion.tsx`, `src/components/admin/ProductTable.tsx`
- **Qué cambió:** Agrega guards de permisos de módulo (`usePermission`) en 5 páginas admin. Cada página muestra `SkeletonTable` mientras cargan los permisos, retorna `null` si el usuario no tiene permiso `ver`, y oculta botones/acciones de mutación si no tiene permiso `gestionar`. `ProductTable` recibe prop `canManage` para controlar visibilidad de Editar/Eliminar en ambas vistas (mobile y desktop).

---

## 2026-06-24 — Trigger para seed automático de roles en nuevas organizaciones

- **Archivos modificados:** `supabase/migrations/139_seed_system_roles_trigger.sql`, `src/components/admin/CreateOrganizationModal.tsx`
- **Qué cambió:** Agrega un trigger `AFTER INSERT ON organizations` que llama a `seed_org_system_roles()` y crea automáticamente los 4 roles del sistema (admin, manager, viewer, user) con sus 16 permisos de módulo para cada org nueva. Backfill incluido para orgs creadas entre la migración 089 y esta. `CreateOrganizationModal` actualizado para vincular al miembro fundador con `organization_role_id` desde el momento de creación. Migration 139 la aplica el usuario manualmente.

---

## 2026-06-24 — Permisos de módulo unificados a roles de organización

- **Archivos modificados:** `supabase/migrations/138_module_permissions_seed.sql`, `src/lib/permissions.ts`, `src/lib/queryKeys.ts`, `src/store/organizationStore.ts`, `src/store/authStore.ts`, `src/hooks/usePermission.ts`, `src/hooks/useOrganization.ts`, `src/components/features/ProtectedRoute.tsx`, `src/components/layout/AdminLayout.tsx`, `src/pages/admin/AdminUsers.tsx`, `src/pages/admin/AdminRolesPermissions.tsx`, `src/types/index.ts`, `src/lib/permissions.test.ts`
- **Qué cambió:** Reemplaza el sistema dual (user_profiles.role + matriz TS de 28 claves hardcodeadas) por el modelo org-scoped existente (migration 089). 16 claves de módulo (8 módulos × {ver, gestionar}) pasan a ser la única autoridad de permisos en el frontend. `usePermission`, `authStore.isAdmin`, `useOrganization.isAdmin/isManager` derivan ahora de `organization_role_id` → `organization_role_permissions`. Se corrige bug de rules-of-hooks en `ProtectedRoute`. UI de Usuarios migrada a TanStack Query con `useMutation` para cambio de rol. UI de Roles reescrita con tabla de 8 módulos × Ver/Gestionar; guarda con delete-all + re-insert. Migration 138 siembra las 16 claves y backfilla los 4 roles sistema (admin, manager, viewer, user). El usuario aplica la migration manualmente.

---

## 2026-06-23 — Limpieza UX panel de clientes + consistencia de órdenes

- **Archivos modificados:** `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerReports.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`
- **Qué cambió:** (1) `AdminCustomers` ahora excluye órdenes canceladas del conteo usando `ACTIVE_ORDER_STATUSES`, alineándose con las otras páginas. (2) `AdminCustomerReports` reemplazó arrays inline de status por la constante compartida. (3) `AdminCustomerDetail` limita la carga del historial a 100 órdenes con aviso + link al historial completo, evitando fetches masivos en clientes con muchas órdenes.

---

## 2026-06-23 — Product Detail View — PR 3: Helpers + Tests

- **Archivos nuevos:** `src/lib/productDetailHelpers.ts`, `src/lib/productDetailHelpers.test.ts`
- **Qué cambió:** Phase 5 del SDD product-detail-view. Extracción de la lógica de derivación de `useProductHeader` en dos helpers puros: `calcWeightedAvgCost` (promedio ponderado de costo por sucursal, retorna null cuando el stock total es 0) y `calcMargin` (margen porcentual con clasificación green/yellow/red, guarda división por cero y costo null). 17 tests unitarios cubren happy path, edge cases de límite (exactamente 40%, 20%, 19.9%), margen negativo, costo null/undefined/0, stock null/undefined/0, y array vacío. Todos los tests pasan (194 en total), TypeScript sin errores.

---

## 2026-06-23 — Product Detail View — PR 2: Page + Wiring

- **Archivos nuevos:** `src/pages/admin/AdminProductDetail.tsx`
- **Archivos modificados:** `src/App.tsx`, `src/components/admin/ProductTable.tsx`, `src/pages/admin/AdminExpenses.tsx`
- **Qué cambió:** Phase 3+4 del SDD product-detail-view. Nueva página `/products/:id` con header de producto (nombre, SKU, badge activo/inactivo, precio con descuento, 3 stat cards: stock total, costo promedio ponderado, margen), barra de tabs con estado en URL (`?tab=`), y 6 paneles de contenido (stock por sucursal, movimientos con filtro y paginación servidor, transferencias, órdenes de compra, ventas con paginación servidor, proveedores con star icon para proveedor principal). Modo degradado para movimientos si el RPC aún no está aplicado. Wiring: nueva ruta en App.tsx, acción "Ver detalle" (Eye) en ProductTable como primer ítem del menú de acciones, y link en nombres de producto en líneas de PO en AdminExpenses.

---

## 2026-06-23 — Product Detail View — PR 1: Foundation + Hooks

- **Archivos nuevos:** `src/hooks/useProductDetail.ts`, `supabase/migrations/137_get_product_movements_rpc.sql`
- **Archivos modificados:** `src/types/index.ts`, `src/lib/queryKeys.ts`
- **Qué cambió:** Phase 1+2 del SDD product-detail-view. Se agregaron los tipos `ProductMovementRow` y `PurchaseOrderItemRow`, 7 sub-keys nuevas bajo `products` en queryKeys, la migración SQL del RPC `get_product_movements` (aplicar manualmente), y el módulo `useProductDetail.ts` con los 7 hooks de data layer (header, stockByBranch, movements con modo degradado, transfers, purchaseItems, sales, suppliers).

---

## 2026-06-19 — Item 06: inventory-drift-auditor (cron diario 3am)

- **Archivos nuevos:** `supabase/functions/inventory-drift-auditor/index.ts`, `supabase/migrations/136_pg_cron_inventory_drift_auditor.sql`
- **Archivos modificados:** `supabase/config.toml`, `.claude/payment-integrity-plan.md`, `.claude/TODO.md`
- **Qué cambió:** Edge Function de auditoría de inventario (READ-ONLY). Compara `branch_inventory.stock` vs `new_stock` del último `inventory_movements` para cada entrada vía LATERAL join. Registra discrepancias en `inventory_drift_log` con stock actual, esperado, drift y referencia al último movimiento. Ignora entradas sin movimientos (sin baseline). Agrega TODO para actualizar keys de Twilio en producción.

---

## 2026-06-19 — Item 05: stale-orders-notifier (cron cada 1 h)

- **Archivos nuevos:** `supabase/functions/stale-orders-notifier/index.ts`, `supabase/migrations/135_pg_cron_stale_orders_notifier.sql`
- **Archivos modificados:** `supabase/config.toml`, `.claude/payment-integrity-plan.md`
- **Qué cambió:** Edge Function que detecta órdenes stuck por tipo y notifica al merchant vía Twilio (misma infraestructura que daily-sales-summary). Deduplicación vía tabla `stale_order_notification_logs` — máximo una notificación por org cada 6h. La función SQL `get_stale_orders_summary()` agrega los conteos por org y solo devuelve orgs con Twilio configurado.

---

## 2026-06-19 — Item 04: order_payments.updated_at

- **Archivos nuevos:** `supabase/migrations/134_order_payments_updated_at.sql`
- **Qué cambió:** Agrega `updated_at TIMESTAMPTZ` a `order_payments` con trigger de auto-update (`set_updated_at()`). Filas existentes se inicializan con su `created_at`. La función `set_updated_at()` es genérica y reutilizable en otras tablas.

---

## 2026-06-19 — Item 03: abandoned-cart-cleanup (cron cada 6 h)

- **Archivos nuevos:** `supabase/functions/abandoned-cart-cleanup/index.ts`, `supabase/migrations/133_pg_cron_abandoned_cart_cleanup.sql`
- **Archivos modificados:** `supabase/config.toml`, `.claude/payment-integrity-plan.md`
- **Qué cambió:** Edge Function que cancela órdenes MP en `pending` con +24h sin pago activo. Consulta MP por `external_reference`; si encuentra pago `approved` lo recupera, si está `in_process`/`pending` lo saltea, si no hay nada o está rechazado cancela la orden (el trigger existente `restore_branch_inventory_on_order_cancellation` restaura el stock automáticamente). La migración 133 crea `get_abandoned_mp_orders()` y el cron `0 */6 * * *`.

---

## 2026-06-19 — Item 02: webhook-secret-enforcement

- **Archivos modificados:** `supabase/functions/mp-webhook/index.ts`
- **Qué cambió:** Si una org no tiene `webhook_secret` configurado, el webhook ahora rechaza con 401 en lugar de procesar igual. Antes: `console.warn` + continuar (cualquiera con la URL podía forjar aprobaciones). Ahora: 401 + log de error con el org_id para facilitar el diagnóstico.

---

## 2026-06-19 — Item 01: mp-payment-reconciler (cron cada 15 min)

- **Archivos nuevos:** `supabase/functions/mp-payment-reconciler/index.ts`, `supabase/migrations/132_pg_cron_mp_payment_reconciler.sql`
- **Archivos modificados:** `supabase/config.toml`, `.claude/payment-integrity-plan.md`
- **Qué cambió:** Edge Function que detecta órdenes MP stuck en `pending` con placeholder de pago sin `mp_payment_id` (IPN no llegó). Consulta MP API por `external_reference`, aplica el mismo status map que `mp-webhook`, y llena el placeholder. La migración 132 crea la función auxiliar `get_stuck_mp_orders()` y registra el cron en pg_cron. Ventana: órdenes entre 10 min y 24 h de antigüedad.

---

## 2026-06-19 — Fix: duplicate key en customers del checkout + policy ampliada

- **Archivos modificados:** `src/pages/Checkout.tsx`, `supabase/migrations/131_public_storefront_guest_checkout_policies.sql`
- **Qué cambió:** (1) El código de checkout ahora captura el error `23505` (duplicate key en `idx_customers_org_phone`) y reintenta el SELECT por teléfono — cubre el caso donde la migration 131 no fue aplicada aún o el cliente tiene `user_id IS NOT NULL`. (2) La policy de customers en migration 131 se amplió de `user_id IS NULL` a `is_active = true` para cubrir también clientes registrados que compraron previamente como guest.

---

## 2026-06-19 — Fix: Checkout sin feedback + guests bloqueados por RLS

- **Archivos modificados:** `src/components/layout/PublicStoreLayout.tsx`, `supabase/migrations/131_public_storefront_guest_checkout_policies.sql` (nuevo)
- **Qué cambió:** (1) `ToastContainer` faltaba en `PublicStoreLayout` — todos los toasts eran invisibles en la tienda pública. Fix: importar y renderizar `<ToastContainer />` en el layout. (2) Guests no podían leer `branches`, `branch_inventory` ni `customers` por falta de políticas RLS públicas — el checkout fallaba silenciosamente. Fix: migración 131 agrega SELECT público para esas tres tablas (branches activas, inventario de branches activas, clientes del storefront).

---

## 2026-06-19 — Fix: métodos de pago desaparecen al cerrar sesión (policy 130)

- **Archivos modificados:** `supabase/migrations/130_fix_public_payment_methods_policy.sql` (nuevo)
- **Qué cambió:** La policy pública de la migración 129 tenía una subquery a `organizations`, tabla con RLS restrictiva para usuarios anónimos. La subquery devolvía vacío para guests, haciendo que la condición USING siempre fallara. Fix: `USING (is_active = true)` sin subquery. El filtro de `organization_id` ya lo aplica PostgREST desde la query de la app.

---

## 2026-06-19 — Fix: PGRST116 en queries de sucursal e inventario (single → maybeSingle)

- **Archivos modificados:** `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`
- **Qué cambió:** Todos los lookups que podían devolver 0 filas usaban `.single()` que lanza error 406 PGRST116. Reemplazados por `.maybeSingle()` en: branch lookup (MAIN y fallback en Cart y Checkout), inventario por variante y por producto en Cart, inventario de variante en validateStockForBranch de Checkout, y cash session lookup. Se mantiene `.single()` solo en los 3 casos posteriores a `.insert().select()` o `.update().select()` donde la fila está garantizada.

---

## 2026-06-19 — Fix: métodos de pago no visibles en checkout + useOrgSettings en tienda pública

- **Archivos modificados:** `supabase/migrations/129_public_storefront_payment_methods_select.sql` (nuevo), `src/hooks/useOrgSettings.ts`, `src/pages/Checkout.tsx`
- **Qué cambió:** La RLS SELECT de `organization_payment_methods` requería ser miembro de la org, bloqueando a compradores guest. Se agrega migración 129 con policy pública para orgs activas. `useOrgSettings` ahora lee del `PublicStoreContext` cuando está disponible (evita usar defaults de admin store en la tienda pública, afectando formateo de precios y configuración de checkout). Se eliminó el `debugger` hardcodeado en `handleSubmit`.

---

## 2026-06-19 — Fix: UX del carrito (precio duplicado, botón menos)

- **Archivos modificados:** `src/pages/Cart.tsx`
- **Qué cambió:** El precio unitario bajo el nombre del producto ahora solo aparece cuando la cantidad es mayor a 1 (con etiqueta "c/u"), evitando que el mismo número se muestre dos veces cuando hay 1 unidad. El botón "-" se deshabilita cuando la cantidad es 1 — para eliminar el item hay que usar la papelera.

---

## 2026-06-19 — Fix: org ID incorrecto en carrito y checkout de tienda pública

- **Archivos modificados:** `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`, `src/store/cartStore.ts`
- **Qué cambió:** `useOrganizationStore` (store del panel admin) se estaba usando en la tienda pública para obtener `organizationId`, donde siempre retorna `null`. Consecuencias: carrito vacío al navegar a `/cart`, checkout sin org (todos los DB writes fallaban), usuarios logueados sin poder agregar al carrito, y `syncLocalCart` nunca migraba los items guest a la DB tras el login. Fix: `Cart.tsx` y `Checkout.tsx` usan `usePublicStore()` del `PublicStoreContext`; `addToCart` en cartStore deriva el org ID del propio producto fetched; `syncLocalCart` escanea localStorage por todas las claves `local_cart_*` en vez de depender del store admin; se eliminó el import de `useOrganizationStore` de cartStore.

- **Archivos modificados:** `src/pages/Cart.tsx`
- **Qué cambió:** `fetchCart()` se llamaba sin `organizationId`, por lo que el store buscaba la org en el store admin (`useOrganizationStore`) que siempre es `null` en la tienda pública. El cart de usuarios guest se guardaba bajo `local_cart_{orgId}` pero se buscaba bajo `local_cart` (sin sufijo). Fix: se obtiene `organization.id` de `PublicStoreContext` y se pasa a `fetchCart`.

---

## 2026-06-15 — Página de deudores y saldo pendiente en detalle de cliente

- **Archivos modificados:** `src/pages/admin/AdminDebtors.tsx` (nuevo), `src/pages/admin/AdminCustomerDetail.tsx`, `src/App.tsx`, `src/components/layout/AdminLayout.tsx`
- **Qué cambió:** Nueva página `/customers/deudores` que lista clientes con saldo pendiente en órdenes activas, con exportación CSV. En el detalle de cliente: la query de órdenes ahora incluye `order_payments`, se computa el pendiente por orden, se agrega KPI "Saldo pendiente" (solo cuando > 0) y columna "Pendiente" en la tabla de historial. Sidebar actualizado con subItems para Clientes (Todos / Deudores).

---

## 2026-06-15 — Guardia de cliente requerido en ventas a crédito

- **Archivos modificados:** `src/components/pos/POSCheckout.tsx`, `src/components/admin/ManualSaleForm.tsx`
- **Qué cambió:** Ventas a crédito sin cliente registrado generaban deuda fantasma (órdenes con `customer_id = null` y sin pago registrado, imposibles de cobrar). Ahora: (1) POS — el botón "Confirmar" se deshabilita cuando la condición es crédito y no hay cliente seleccionado; el campo de cliente cambia a ámbar con texto "Cliente requerido para venta a crédito". (2) Venta manual admin — el submit se deshabilita si `sale_condition === 'credito'` y no hay cliente vinculado ni nombre/teléfono ingresados manualmente; aparece mensaje de alerta en la sección de cliente.

## 2026-06-14 — Fix UX baja prioridad en panel de clientes

- **Archivos modificados:** `src/components/pos/POSCustomerSearch.tsx`, `src/pages/admin/AdminCustomerReports.tsx`
- **Qué cambió:** (1) `POSCustomerSearch`: navegación por teclado completa — ArrowUp/Down mueve el foco entre resultados (con scroll automático), Enter selecciona, Escape cierra. Los clientes recientes (guardados en localStorage por org) se muestran en el estado vacío inicial en lugar de solo texto de ayuda. (2) `AdminCustomerReports`: tabla "Base de clientes" reemplaza el cap fijo de 200 filas por paginación progresiva — 100 filas iniciales, botón "Mostrar más (N restantes)" que añade 100 por click; se reinicia automáticamente cuando cambian filtros o datos.

## 2026-06-14 — Fix UX media prioridad en panel de clientes

- **Archivos modificados:** `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminCustomerReports.tsx`, `src/components/pos/POSCustomerSearch.tsx`
- **Qué cambió:** (1) `AdminCustomers`: sorting por columna en Nombre (server-side) y Pedidos (client-side en la página), con indicador ChevronUp/Down; acción "Ver ficha" agregada como primer ítem en ambos ActionsMenu (mobile y desktop). (2) `AdminCustomerDetail`: teléfono y email son links `tel:` y `mailto:`; badge "Inactivo" en el header cuando corresponde; historial de órdenes muestra 20 a la vez con botón "Mostrar más". (3) `AdminCustomerReports`: gráfico de barras recharts para evolución mensual; botón "Limpiar" en filtros de fecha/sucursal. (4) `POSCustomerSearch`: error de red distinguido del resultado vacío, con botón "Reintentar".

## 2026-06-14 — Fix UX alta prioridad en panel de clientes

- **Archivos modificados:** `src/lib/constants.ts`, `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminCustomerReports.tsx`
- **Qué cambió:** (1) `constants.ts`: agregado `ACTIVE_ORDER_STATUSES` como fuente única de verdad para estados activos de órdenes. (2) `AdminCustomerDetail`: usa la constante compartida; KPI "Órdenes totales" y "Total gastado" ahora excluyen canceladas y son consistentes entre sí y con Reports. (3) `AdminCustomers`: reemplazado `window.confirm` por modal de confirmación con badge de advertencia cuando el cliente tiene órdenes asociadas. (4) `AdminCustomerReports`: primera carga muestra skeleton layout en lugar de spinner; recargas por filtro usan overlay semitransparente + badge "Actualizando..." sin desaparecer el contenido; nombres de clientes en las tres tablas son links clickeables a su ficha.

## 2026-06-14 — Fix UX críticos en panel de clientes

- **Archivos modificados:** `src/pages/admin/AdminCustomerReports.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/components/pos/POSCustomerSearch.tsx`
- **Qué cambió:** (1) `AdminCustomerReports`: reemplazado fetch masivo de todas las órdenes con filtrado client-side por dos queries server-side: una con rango de fecha para el período y otra mínima (solo `customer_id, created_at`) para el histórico de primera/última compra por cliente. (2) `AdminCustomerDetail`: agregado modal de edición con campos full_name, email, phone, rut, notas; botón "Editar" en el header; `navigate(-1)` reemplaza `navigate('/customers')` para preservar el estado del listado. (3) `POSCustomerSearch`: cuando la búsqueda no da resultados se muestra "Crear {query}" que abre un mini-form inline para dar de alta el cliente sin salir del POS.

## 2026-06-12 — Mejora visual de la home de la tienda pública (PublicStore)

- **Archivos modificados:** `src/pages/PublicStore.tsx`
- **Qué cambió:** Sección de categorías rediseñada: se eliminó la lógica de widths condicionales (400-500px para pocas categorías) y se unificó en un grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` consistente. Se agregó el link "Ver todo" al header de la sección de categorías. Sección de productos: renombrada a "Productos destacados", headers más compactos (`text-xl` en lugar de `text-2xl md:text-3xl`), espaciado reducido de `py-12 md:py-16` a `py-10 md:py-14` para mayor densidad visual. El threshold de "Ver todos" subió a >10 productos (antes >8).

## 2026-06-12 — Footer profesional con categorías en la tienda pública

- **Archivos modificados:** `src/components/layout/Footer.tsx`, `src/components/layout/PublicStoreLayout.tsx`
- **Qué cambió:** Se reescribió `Footer.tsx` como `PublicStoreFooter` que usa el contexto de la tienda (`usePublicStore`) y el hook `usePublicCategoriesForMenu` (caché compartido con el header, sin query extra). Muestra: logo + nombre de la org, links rápidos (Ver todos / Carrito), árbol de categorías con subcategorías anidadas bajo una línea izquierda del color primario, y barra de copyright. El `PublicStoreLayout` reemplaza su footer inline por este componente. El color de fondo, bordes y acentos usan el `primaryColor` de la organización con opacidades bajas.

## 2026-06-12 — Fix: filtro de subcategoría mostraba todos los productos del padre

- **Archivos modificados:** `src/pages/CategoryProducts.tsx`
- **Qué cambió:** Bug de semántica en la lógica de filtrado por subcategoría. La condición `effectiveSelected.length === subcats.length` se disparaba cuando había UNA sola subcategoría y estaba seleccionada (1 === 1), cayendo en la rama "mostrar todo incluyendo padre". Fix: se rediseñó la semántica a `[] = sin filtro, mostrar todo` vs `[ids...] = filtrar a esas subcategorías`. Cambios: (1) `fetchProductsForCategory` solo usa el branch "mostrar todo" cuando `effectiveSelected.length === 0`; (2) al navegar al padre se inicializa con `[]`, al navegar a una subcategoría con `[subcatId]`; (3) "Todas" button siempre pone `[]`; (4) `clearFilters` pone `[]`; (5) `hasActiveFilters` es true cuando `selectedSubcategories.length > 0`; (6) chips UI usan `length === 0` para "Todas" activo.

## 2026-06-12 — Fix: productos de subcategoría no aparecían (product_categories)

- **Archivos modificados:** `src/pages/CategoryProducts.tsx`
- **Qué cambió:** El filtro de productos solo miraba `products.category_id`, pero los productos pueden tener `category_id` apuntando al padre aunque su subcategoría esté registrada únicamente en `product_categories`. Se refactorizó `fetchProductsForCategory` para: (1) consultar primero la junction table `product_categories` para obtener los IDs de productos en las categorías filtradas, y (2) usar un OR (`category_id.in.(...)` + `id.in.(...)`) para unir ambas fuentes. Si `product_categories` no tiene entradas se usa directamente el filtro por `category_id` como fallback.

## 2026-06-12 — Fix: subcategorías no mostraban productos propios

- **Archivos modificados:** `src/pages/CategoryProducts.tsx`
- **Qué cambió:** Bug de stale closure en `fetchCategoryAndProducts`. `setParentCategory` se llamaba antes del await de subcategorías, disparando el useEffect de productos con `selectedSubcategories = []` (closure viejo), lo que hacía que la query filtrara por todos los IDs o por el padre en vez de la subcategoría seleccionada. Fix: (1) todos los setters de estado (`setCurrentCategory`, `setParentCategory`, `setSubcategories`, `setSelectedSubcategories`) se agruparon en un solo batch después del último await; (2) se agregó parámetro `overrideSelectedIds` a `fetchProductsForCategory` para pasarle los IDs correctos en la llamada directa inicial, independientemente del estado del closure.

## 2026-06-12 — Rediseño del header de la tienda pública

- **Archivos modificados:** `src/components/layout/PublicStoreHeader.tsx`
- **Qué cambió:** Rediseño completo del header público. Se eliminó el componente `Dropdown` genérico para categorías (parecía un `<select>`) y la barra de búsqueda siempre visible. Nuevo diseño: (1) Categorías como nav links en el centro con underline animado en hover; las que tienen subcategorías muestran un flyout dropdown con CSS `group-hover:` (sin JS de mouse). (2) Búsqueda expandible: ícono que al hacer click transiciona de `w-9` circular a `w-52` pill con input interno. (3) Mobile menu como accordion — toggle expand/collapse por categoría con subcategorías. (4) Se extrajeron `CategoryNavItem` y `MobileCategoryItem` como subcomponentes. Se eliminaron las dependencias de `Button` y `Dropdown`.

## 2026-06-11 — Refinamiento visual de la tienda pública

- **Archivos modificados:** `src/index.css`, `src/components/ui/Skeleton.tsx`, `src/components/features/ProductCard.tsx`, `src/components/features/CategoryCard.tsx`, `src/components/layout/PublicStoreHeader.tsx`, `src/pages/PublicStore.tsx`, `src/pages/Products.tsx`, `src/pages/CategoryProducts.tsx`, `src/pages/ProductDetail.tsx`
- **Qué cambió:** Renovación completa del look & feel de la tienda pública: (1) `ProductCard` con imagen cuadrada (1:1), botón flotante de carrito que aparece al hover en desktop / siempre visible en mobile, sin hover JS. (2) `CategoryCard` con overlay de gradiente sobre la imagen en vez de texto debajo — look editorial. (3) Header con `backdrop-blur` y fondo semi-transparente (frosted glass). (4) Filtros de productos y categorías reemplazados por chip pills horizontales (se eliminó el sidebar y el panel mobile colapsable). (5) Vista de lista desktop (`ProductListItem`) reemplazada por grid uniforme en todos los breakpoints. (6) `Skeleton` de loading en lugar de spinners en todas las páginas públicas, más `SkeletonProductCard` nuevo. (7) `ProductDetail` sin `<Card>` pesada — selector de cantidad como botones circulares con `border-t` como separador. (8) Animación de entrada `fadeInUp` escalonada para cards. (9) Sección "Cargar más" con botón pill redondeado.

## 2026-06-11 — Fix orden MP marcada como Cobrada antes de pago y estado de pago en confirmación

- **Archivos modificados:** `supabase/functions/create-mp-preference/index.ts`, `src/pages/OrderConfirmation.tsx`, `src/lib/paymentMethodConfig.ts`, `src/components/admin/PaymentMethodConfigModal.tsx`
- **Qué cambió:** (1) El placeholder de `order_payment` para MP se insertaba con `amount = total`, haciendo que admin mostrara "Cobrada" inmediatamente. Ahora se inserta con `amount = 0`; el webhook actualiza el monto real al confirmar. (2) La página de confirmación no tenía banner de éxito para MP: ahora muestra verde cuando `order.status === 'processing'` y amarillo con botón "Verificar" cuando `order.status === 'pending'`. (3) Se agrega schema `transfer` en `paymentMethodConfig` con campo `textarea` para instrucciones bancarias, y soporte de `textarea` en el modal de config.

---

## 2026-06-11 — Fix RLS de organization_payment_methods bloquea UPDATE silenciosamente

- **Archivos modificados:** `supabase/migrations/128_fix_payment_methods_rls.sql`, `src/components/admin/PaymentMethodConfigModal.tsx`
- **Qué cambió:** La política FOR ALL usaba `is_org_admin()` (solo role='admin') mientras el resto del proyecto usa `is_org_admin_or_manager()`. El UPDATE devolvía 0 filas sin error. Se reemplaza la política y se agrega `.select('id')` al update para detectar fallos silenciosos.

## 2026-06-11 — Fix configuración de métodos de pago no persiste al reabrir

- **Archivos modificados:** `src/components/admin/PaymentMethodConfigModal.tsx`, `src/hooks/useOrgPaymentMethods.ts`
- **Qué cambió:** `handleSubmit` no awaiteaba `onSaved()` antes de cerrar el modal. `invalidateQueries` dispara un refetch async; si el usuario reabrıa el modal antes de que terminara, `configMethod` aún tenía el objeto stale (config vacío). Se agrega `await` y se actualiza el tipo de retorno de `refetch` a `Promise<void>`.

---

## 2026-06-11 — Fix: aislamiento del carrito por organización en tienda pública

- **Archivos modificados:** `src/store/cartStore.ts`, `src/components/layout/PublicStoreHeader.tsx`
- **Qué cambió:** `fetchCart` usaba el org ID del panel admin (`useOrganizationStore`) en lugar del de la tienda visitada, mostrando ítems de otra org. Se agregó parámetro `organizationId` a `fetchCart` y `loadLocalCart`, se limpia el estado al cambiar de org, y el localStorage queda aislado por clave `local_cart_${orgId}`

---

## 2026-06-11 — Mercado Pago: integración completa (webhook robusto + refresh manual + manejo de redirect)

- **Archivos modificados:** `supabase/functions/create-mp-preference/index.ts`, `supabase/functions/mp-webhook/index.ts`, `src/pages/OrderConfirmation.tsx`
- **Archivos creados:** `supabase/functions/mp-refresh-payment/index.ts`
- **Qué cambió:** (1) **Bug crítico resuelto en `create-mp-preference`**: `currencyId` se usaba antes de ser declarado con `const` (TDZ) — movido el fetch de `orgRow` arriba del `mpItems.map()`. Se agrega también un placeholder row en `order_payments` con `mp_payment_id = NULL` cuando se crea la preferencia; (2) **`mp-webhook` reescrito**: reemplaza el `upsert({ onConflict: 'order_id,payment_method' })` roto (no existía esa constraint UNIQUE) con lógica robusta: busca por `mp_payment_id` → si no, busca placeholder `IS NULL` → si no, inserta. Agrega `pending_allocation` a la lista de estados inmutables; (3) **Nueva edge function `mp-refresh-payment`**: permite al admin re-sincronizar manualmente el estado de un pago MP buscando por `mp_payment_id` o por `order_id` (search en MP API); (4) **`OrderConfirmation.tsx`**: lee `?mp_status=` del redirect de MP, muestra banner rojo para `failure` y banner amarillo para `pending` con botón "Verificar estado ahora" que invoca `mp-refresh-payment`. Fix del label de método de pago (antes mostraba "Mercado Pago" para cualquier método no-transfer).

## 2026-06-11 — AdminCustomers: features de comercio + React Query

- **Archivos modificados:** `src/pages/admin/AdminCustomers.tsx`, `src/lib/queryKeys.ts`
- **Qué cambió:** Migración a React Query (useQuery con keepPreviousData) + 4 features nuevas para el panel de clientes: (1) **Estadísticas en el header** — 3 chips de COUNT paralelos (Total / Activos / Nuevos este mes) sin leer filas; (2) **Filtro "Solo activos"** en barra de filtros, con botón Limpiar condicional; (3) **Toggle is_active** desde ActionsMenu — activa/desactiva sin eliminar el cliente, refleja el estado en la fila con opacidad; (4) **Exportar CSV** — descarga todos los clientes con los filtros actuales aplicados, con BOM UTF-8 para Excel; (5) **Columna "Pedidos"** — el queryFn principal hace un segundo fetch de `orders.customer_id` para la página actual y muestra el conteo en tabla y mobile cards. `queryKeys.customers` extendido con `list` y `stats`. Sin cambios en DB.

## 2026-06-11 — Migración a React Query: AdminInventory (Fase 4 continúa)

- **Archivos modificados:** `src/pages/admin/AdminInventory.tsx`
- **Qué cambió:** Migración completa de AdminInventory (2070 líneas). Se eliminó el patrón `requestSequenceRef` (`fetchInventoryRequestId = useRef(0)`) reemplazando `fetchInventory` por `useQuery` con `placeholderData: keepPreviousData`. La clave del cambio: `fetchSalesAndMovements` (que dependía de `inventory` como estado y se ejecutaba en un segundo paso vía `useEffect`) fue fusionado dentro del `queryFn` de inventario, evitando el doble fetch y la dependencia en estado local. Se reemplazaron `fetchBranches` por `useAdminBranches`, y `checkUnsyncedItems`/`checkMissingProducts`/`fetchCrossView` por `useQuery` condicionales. `invalidateInventory()` usando prefix matching `queryKeys.inventory.all(orgId)` cubre todos los sub-queries (branch, cross-view, unsynced count, missing count) en una sola llamada.

## 2026-06-11 — Migración a React Query: Fase 4 (páginas admin complejas con mutaciones)

- **Archivos modificados:** `src/hooks/useAdminBranches.ts`, `src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminReposicion.tsx`, `src/pages/admin/AdminCashRegister.tsx`, `src/pages/admin/AdminOrderDetail.tsx`, `src/pages/admin/AdminProducts.tsx`
- **Qué cambió:** Migración de 5 páginas admin complejas con mutaciones. `AdminOrders` elimina `fetchOrdersRef` y convierte el handler Realtime a `queryClient.invalidateQueries`. `AdminReposicion` convierte `assignSupplier` a `useMutation`. `AdminCashRegister` elimina `fetchSessions` y usa `invalidateSessions()` en todos los handlers. `AdminOrderDetail` migra el fetch principal con 6 queries paralelas, descarta todos los `setOrder` optimistas y limpia 8 llamadas a `fetchOrder()`. `AdminProducts` es la migración más crítica: invalida simultáneamente `['admin', orgId, 'products']`, `['store', orgId, 'products']` y `config.planLimits` en create/edit/delete — resolviendo el bug estructural donde cambios en admin no se reflejaban en la tienda pública sin F5. `useAdminBranches` actualizado para seleccionar `'*'` y exponer `is_isolated_warehouse`.

## 2026-06-11 — Migración a React Query: Fase 3 (páginas admin, eliminación de requestSequenceRef)

- **Archivos modificados:** `src/lib/queryKeys.ts`, `src/hooks/useAdminBranches.ts` (nuevo), `src/pages/admin/AdminStoreStats.tsx`, `src/pages/admin/AdminInventoryReports.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminTransfers.tsx`, `src/pages/admin/AdminOrganizations.tsx`, `src/pages/admin/AdminAuditLogs.tsx`, `src/pages/admin/AdminSales.tsx`, `src/pages/admin/AdminFinancialReports.tsx`
- **Qué cambió:** Migración de 8 páginas admin a React Query. Se eliminó el patrón manual `requestSequenceRef` de `AdminSales` y `AdminFinancialReports` (race conditions ahora manejadas nativamente por React Query). Se creó `useAdminBranches` hook compartido. `AdminFinancialReports.refreshAggregates` migrado a `useMutation`. `AdminTransfers` corregido bug de seguridad: query sin `organization_id` filter. `AdminOrganizations` agrega `queryKeys.myOrganizations` al factory. Los modales de org ahora invalidan la query en lugar de llamar `fetchAllOrgs`.

## 2026-06-11 — Migración a React Query: Fases 0, 1 y 2

- **Archivos modificados:** `src/lib/queryKeys.ts` (nuevo), `src/hooks/usePublicProducts.ts`, `src/hooks/usePublicCategories.ts`, `src/hooks/useProductVariants.ts` (nuevo), `src/components/features/VariantSelector.tsx`, `src/pages/ProductDetail.tsx`, `src/hooks/useMoneyMetrics.ts`, `src/hooks/useOperationalMetrics.ts`, `src/hooks/useTrendsMetrics.ts`, `src/hooks/useLowStockProducts.ts`, `src/hooks/useBillerConfig.ts`, `src/hooks/useOrgPaymentMethods.ts`, `src/hooks/usePlanLimits.ts`, `src/hooks/useLots.ts`
- **Qué cambió:** Se creó la factory de query keys (`queryKeys`) en `src/lib/queryKeys.ts` como base de toda la migración. Los 2 hooks ya migrados se actualizaron para usar la nueva factory. Se creó `useProductVariants` con React Query para deduplicar el fetch de variantes entre `ProductDetail` y `VariantSelector` (de 3 requests a 1 por producto). Se migraron 9 hooks custom del dominio admin: los 3 de métricas del dashboard, `useLowStockProducts`, `useBillerConfig`, `useOrgPaymentMethods`, `usePlanLimits` y `useLots` (con sus mutaciones). Interfaz pública de todos los hooks preservada sin breaking changes.

## 2026-06-11 — Actualización de tests y CLAUDE.md por nuevo límite de productos (2000)

- **Archivos modificados:** `src/lib/planLimits.test.ts`, `CLAUDE.md`
- **Qué cambió:** Los tests y la documentación se actualizaron para reflejar el nuevo límite de productos de 2000 para ambos planes (starter y profesional); el plan profesional mantiene sucursales ilimitadas.

---

## 2026-06-11 — Límites de plan simplificados, fix skeleton en filtros y corrección modal productos

- **Archivos modificados:**
  - `src/lib/planLimits.ts`
  - `src/hooks/usePlanLimits.ts`
  - `src/pages/admin/AdminProducts.tsx`
  - `src/pages/admin/AdminOrders.tsx`
  - `src/pages/admin/AdminCustomers.tsx`
- **Qué cambió:**
  - Límite de productos unificado en 2000 para todos los planes (starter y profesional)
  - `usePlanLimits` ahora expone `refreshCounts` para forzar reconteo después de crear productos; elimina bypass especial para plan profesional
  - Corregido bug en `AdminProducts`: filtros ya no muestran skeleton completo cuando hay productos cargados (solo en carga inicial); mismo fix en `AdminOrders` y `AdminCustomers`
  - `reset()` del formulario ahora se llama antes de cerrar el modal para evitar datos residuales al reabrir
  - Mensaje de límite alcanzado ahora usa el valor real del plan en vez del hardcodeado "200 productos"
  - Contador de productos visible para todos los planes en la cabecera de la página

---

## 2026-06-11 — Homogenización del panel admin: skeletons, EmptyState, filtros y performance

- **Archivos modificados:**
  - `src/pages/admin/AdminCategories.tsx`
  - `src/pages/admin/AdminSuppliers.tsx`
  - `src/pages/admin/AdminBranches.tsx`
  - `src/pages/admin/AdminOrders.tsx`
  - `src/pages/admin/AdminUsers.tsx`
  - `src/pages/admin/AdminTransfers.tsx`
  - `src/pages/admin/AdminCustomers.tsx`
  - `src/pages/admin/AdminProducts.tsx`
- **Qué cambió:**
  - Reemplazados todos los spinners (`animate-spin`) por `<SkeletonTable>` para mantener el layout durante la carga
  - Reemplazados mensajes de texto vacíos por el componente `<EmptyState>` en todas las páginas que lo usaban incorrectamente
  - Eliminado el filtro colapsable en AdminCustomers (violaba convención de CLAUDE.md); reemplazado por barra de filtros inline siempre visible
  - AdminCustomers refactorizado a paginación server-side con debounce de 400ms (antes cargaba todos los clientes en memoria)
  - AdminOrders y AdminUsers: `ITEMS_PER_PAGE` hardcodeado migrado a `PAGE_SIZE_ADMIN` importado de `@/lib/constants`
  - AdminProducts: `fetchCategories`, `fetchSuppliers`, `fetchBranches` envueltos en `useCallback` para evitar re-renders innecesarios

---

## 2026-06-01 — Checkout: imágenes, sin envío, íconos de pago y reCAPTCHA v3

- **Archivos modificados:** `src/pages/Checkout.tsx`, `src/components/admin/PaymentMethodsManager.tsx`
- **Archivos creados:** `supabase/functions/validate-recaptcha/index.ts`
- **Qué cambió:** (1) Las imágenes de productos en el resumen del checkout ahora usan `getProductImageUrl()` con soporte para `product_images` en lugar del campo legacy `image_url`. (2) Se eliminó la sección de datos de envío (dirección, ciudad, provincia, código postal, país) — el formulario queda solo con nombre, email y teléfono bajo el título "Datos de Contacto". (3) Los métodos de pago ahora muestran un ícono (Banknote para efectivo, Landmark para transferencia, CreditCard como fallback). El admin puede configurar una URL de logo personalizado por método desde PaymentMethodsManager. (4) reCAPTCHA v3 invisible integrado: la confirmación de orden ejecuta el captcha automáticamente y valida el token via la Edge Function `validate-recaptcha` antes de crear la orden. La Edge Function requiere deploy manual y configuración del secret `RECAPTCHA_SECRET_KEY` + la env var `VITE_RECAPTCHA_SITE_KEY` en el frontend.

---

## 2026-06-01 — Fix: formulario de producto no limpia estado entre creaciones

- **Archivos modificados:** `src/pages/admin/AdminProducts.tsx`
- **Qué cambió:** Dos bugs relacionados. (1) `useForm` no tenía `defaultValues`, por lo que `reset()` sin argumentos usaba los últimos valores cargados por `handleEdit` — mostrando datos del producto anterior al abrir "Nuevo Producto". (2) Ese mismo comportamiento causaba que el 4to producto fallara con error de SKU duplicado (ya que el form se pre-cargaba con el SKU de un producto editado). Fix: se agregaron `defaultValues` vacíos a `useForm` para que `reset()` siempre vuelva al formulario en blanco. Además: se limpian `selectedCategoryIds` e `initialBranchId` en `onSubmit` tras guardar, y el error handler ahora muestra el mensaje real de Supabase vía toast en lugar de un `alert()` genérico.

---

## 2026-05-27 — Reposición: asignación rápida de proveedor inline

- **Archivos modificados:** `src/pages/admin/AdminReposicion.tsx`
- **Qué cambió:** Los productos sin proveedor asignado ahora muestran un select desplegable directamente en la columna Proveedor (desktop y mobile). Al elegir un proveedor se hace upsert en `product_suppliers` como proveedor primario y se actualiza el estado local inmediatamente. El click en el select no activa el toggle de selección de fila (`stopPropagation`). Si la org no tiene ningún proveedor cargado, muestra el texto "Sin proveedor" como antes.

---

## 2026-05-27 — Sprint 2: pantalla de reposición con generación de órdenes de compra

- **Archivos creados:** `supabase/migrations/127_reposicion_rpc.sql`, `src/pages/admin/AdminReposicion.tsx`
- **Archivos modificados:** `src/App.tsx`, `src/components/layout/AdminLayout.tsx`
- **Qué cambió:** Nueva pantalla `/reposicion` en la sección Catálogo del sidebar. Lista todos los productos bajo su umbral de stock (via RPC `get_reposicion_report`) con días de stock, proveedor y filtros por búsqueda/sucursal/proveedor. Permite seleccionar múltiples productos y generar órdenes de compra agrupadas por proveedor en un modal editable — crea una `purchase_order` por proveedor y sus `purchase_order_items` con cantidades editables (default: `MAX(umbral * 2 - stock, 1)`). La migración `127_reposicion_rpc.sql` debe aplicarse manualmente en Supabase.

---

## 2026-05-27 — Sprint 1: días de stock y stock muerto en AdminInventory

- **Archivos modificados:** `src/pages/admin/AdminInventory.tsx`
- **Qué cambió:** Dos columnas nuevas en la tabla de inventario (vista por sucursal). "Días de stock": calcula cuántos días le quedan al negocio con el stock actual basándose en las ventas de los últimos 30 días — rojo < 7d, amarillo < 14d, gris el resto. "Última actividad": fecha del último movement registrado; si el producto lleva > 60 días sin movimiento y tiene stock > 0, muestra badge naranja. Toggle "Stock muerto" en la barra de filtros para aislar esos productos. En mobile se muestra la métrica de días de stock en cada card. Los datos de ventas y movimientos se cargan en paralelo con `Promise.all` después de cada carga de inventario.

---

## 2026-05-27 — Fix: stock incorrecto y en múltiples sucursales en importación masiva

- **Archivos modificados:** `src/components/admin/ProductImportModal.tsx`
- **Qué cambió:** El INSERT de productos usaba `stock: row.stockInicial`, lo que hacía que el trigger `create_inventory_for_product` creara filas en `branch_inventory` para **cada sucursal activa** con ese stock — en vez de solo la seleccionada. Además, el código posterior intentaba sumar encima del valor ya puesto por el trigger, duplicando el total. Fix: insertar productos con `stock: 0` (el trigger crea los branch_inventory en 0 para todas las sucursales), y luego hacer un batch fetch + UPDATE directo al valor correcto solo en la sucursal seleccionada. Los `inventory_movements` se insertan en un solo batch al final.

---

## 2026-05-27 — Importación masiva de productos vía CSV

- **Archivos creados:** `src/components/admin/ProductImportModal.tsx`
- **Archivos modificados:** `src/pages/admin/AdminProducts.tsx`
- **Qué cambió:** Nueva funcionalidad de carga masiva de productos desde CSV/Excel, accesible desde el botón "Importar" en la barra de acciones de AdminProducts. El modal tiene 4 pasos: (1) subida con drag-and-drop y descarga de plantilla, (2) preview con tabla de filas válidas/inválidas y selector de sucursal para stock inicial, (3) progreso de importación, (4) resultado. El parser CSV es propio (sin dependencias externas) y soporta BOM, CRLF, campos con comillas y comas. Validaciones: nombre y SKU requeridos, precio válido ≥ 0, SKU único dentro del archivo y contra la DB. Categorías nuevas se crean automáticamente. Stock inicial se carga en `branch_inventory` + `inventory_movements` por sucursal seleccionada.

---

## 2026-05-27 — Tabla de órdenes: limpieza visual y optimización de carga

- **Archivos modificados:** `src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminOrderDetail.tsx`
- **Qué cambió:**
  - **AdminOrders.tsx** — tabla desktop reducida de 8 a 6 columnas: se eliminó la columna "Descuento" (ahora aparece como badge inline en la columna Orden), la columna "Cliente" muestra solo el nombre (sin email/teléfono/RUT/vinculado), y las columnas "Estado" y "Cobro" se fusionaron en una sola celda con dos badges compactos. Se eliminó el ID hexadecimal de la celda Orden. En mobile se agregó el badge de descuento al número de orden. Corrección de búsqueda: cuando hay `searchTerm`, se omite el `range()` de paginación y se busca sobre hasta 500 registros client-side (evita el bug de paginación que mostraba resultados vacíos si el match estaba en otra página). La paginación se oculta mientras hay búsqueda activa.
  - **AdminOrderDetail.tsx** — los 7 fetches secuenciales de `fetchOrder` (payments, user_profile, customer, manual_items, biller_comprobante, biller_config) se paralelizaron con `Promise.all` (reducción teórica de latencia de ~6× waterfall a 1 roundtrip en paralelo). La carga de productos en modo edición pasó de N+1 queries (una por producto para obtener su variante) a 2 queries batch: una para todos los productos, otra `.in('product_id', [...])` para todas las variantes; se aplica la misma lógica de preferencia por variante `-DEFAULT`.

---

## 2026-05-26 — POS móvil: ruta `/pos` con layout sin sidebar

- **Archivos creados:** `src/lib/posService.ts`, `src/hooks/usePOSCart.ts`, `src/components/layout/POSLayout.tsx`, `src/components/pos/POSHeader.tsx`, `src/components/pos/POSProductSearch.tsx`, `src/components/pos/POSBarcodeScanner.tsx`, `src/components/pos/POSCart.tsx`, `src/components/pos/POSCartItem.tsx`, `src/components/pos/POSCheckout.tsx`, `src/components/pos/POSCustomerSearch.tsx`, `src/pages/pos/POSHome.tsx`, `src/pages/pos/POSSale.tsx`
- **Archivos modificados:** `src/App.tsx`, `src/components/layout/AdminLayout.tsx`
- **Qué cambió:** Nueva ruta `/pos` optimizada para celular con layout propio (sin sidebar). Incluye: selector de sucursal en `/pos`, pantalla de venta en `/pos/sale/:branchId` con tabs Productos/Carrito, búsqueda por nombre/SKU, escáner de código de barras via `BarcodeDetector` API (con fallback a input manual), carrito táctil con controles +/−, panel de cobro slide-up con métodos de pago, descuento manual, vinculación de cliente y emisión de CFE. La lógica de creación de ventas fue extraída de `ManualSaleForm` a `posService.ts` (`createSaleFromCart()`) para reutilización. Sesión de caja no requerida; si existe una abierta se asocia automáticamente. El bottom nav mobile en AdminLayout ahora apunta a `/pos`.

---

## 2026-05-26 — Onboarding: 8 pasos reales alineados al flujo operativo

- **Archivos modificados:** `src/components/admin/OnboardingChecklist.tsx`, `src/components/admin/WelcomeModal.tsx`
- **Qué cambió:** Reemplazados los 6 pasos originales del checklist por 8 pasos que reflejan el flujo real de configuración y operación: (1) personalizar tienda, (2) completar datos de sucursal —cambiado de "crear" a "completar" porque la sucursal Principal se auto-crea—, (3) invitar equipo con roles, (4) categorías, (5) productos, (6) primera caja, (7) primera venta, (8) primer proveedor. Agregadas queries para `cash_sessions` (con `organization_id`), `orders` y `organization_members`. El paso de "sucursal" ahora verifica `address IS NOT NULL` en vez de count. El WelcomeModal actualizado con 5 highlights precisos, eliminado el checkbox "No mostrar más" y la navegación automática a `/branches`; al cerrar simplemente deja el checklist visible para guiar al usuario. Cambiada la storage key a `v2` para que los usuarios existentes vean el nuevo onboarding.

## 2026-05-20 — Admin panel: mejoras UX en tablas, modales y formulario de venta

- **Archivos modificados:** `src/components/admin/CategoryTable.tsx`, `src/components/admin/BranchTable.tsx`, `src/components/admin/CashSessionTable.tsx`, `src/components/admin/ProductTable.tsx`, `src/components/admin/InventoryAdjustmentModal.tsx`, `src/components/admin/InventoryMovementsModal.tsx`, `src/components/admin/LotReceptionModal.tsx`, `src/components/admin/ManualSaleForm.tsx`
- **Qué cambió:** `CategoryTable`: corregido el key de React Fragment que causaba advertencias de reconciliación; reemplazados emojis por íconos Lucide en el menú de acciones. `BranchTable`: reemplazado div vacío por `<EmptyState>`. `CashSessionTable`: reemplazado div vacío por `<EmptyState>`, agregada columna de duración de sesión con helper `sessionDuration()`, separada la acción "Cerrar caja" como botón inline para sesiones abiertas (evita confusión con "Ver detalles"). `ProductTable`: stock visible en la tarjeta mobile con código de color por nivel. `InventoryAdjustmentModal`: textarea libre reemplazada por select de motivos predefinidos + campo libre para "Otro". `InventoryMovementsModal`: lista compactada a filas divididas por separador, paginación "Cargar más" en modo append. `LotReceptionModal`: selector de sucursal movido al paso 1 (antes de buscar producto), nuevo estado `success` con botón "Agregar otro producto a esta remesa". `ManualSaleForm`: búsqueda de producto incluye SKU, Enter en el buscador agrega el primer resultado, reemplazado `window.confirm` por banner inline para confirmar cambio de sucursal.

---

## 2026-05-20 — Landing: rewrite de copy + video del dolor en el hero

- **Archivos modificados:** `src/pages/Landing.tsx`
- **Qué cambió:** Headline reescrito de genérico ("Tu negocio completo, en un solo lugar") a orientado al dolor ("Cerrá la caja sin diferencias. Controlá el stock sin llamar a la sucursal."). Subheadline cambiado de lista de features a resultado concreto. CTA principal unificado en uno solo ("Quiero una demo") con trust line debajo. Eliminado el segundo botón "Agendar demo" que duplicaba el CTA con flujo distinto. Stats bar actualizada a métricas de outcome en vez de stats de producto. Agregado componente `HeroVideo` que reemplaza el carousel de screenshots — muestra un play button sobre `/heroVideo.mp4` (archivo a agregar) con fallback en poster. Eliminado el link "Testimonios" del nav (apuntaba a sección comentada).

---

## 2026-05-13 — UX/UI: reemplazar window.prompt/confirm por modales propios en AdminOrderDetail

- **Archivos modificados:** `src/pages/admin/AdminOrderDetail.tsx`
- **Qué cambió:** Se eliminaron todos los `window.prompt()` y `window.confirm()` de flujos críticos (anulación de orden, devolución parcial, descuentos de orden e ítem, anulación de CFE). Cada flujo tiene ahora su propio modal dentro del design system. Los botones de estado de la orden se reemplazaron por un `<select>` para reducir ruido visual.

## 2026-05-13 — Fix: entorno de tests cambiado de jsdom a node

- **Archivos modificados:** `vitest.config.ts`
- **Qué cambió:** El entorno `jsdom` transitivamente requería `html-encoding-sniffer`, que falla al hacer `require()` del paquete ESM `@exodus/bytes/encoding-lite.js`. Como todos los tests están en `src/lib/` (lógica pura, sin DOM), se cambió el entorno a `node`. 172 tests pasan correctamente.

---

## 2026-05-13 — Tests automáticos en cada deploy via nixpacks

- **Archivos modificados:** `nixpacks.toml`
- **Qué cambió:** Se agregó la fase `build` con `yarn test` antes de `yarn build`. Si algún test falla, el build se interrumpe y el deploy no se realiza.

---

## 2026-05-13 — Tests de productSchema corregidos y regla de calidad en CLAUDE.md

- **Archivos modificados:** `src/lib/schemas.test.ts`, `CLAUDE.md`
- **Qué cambió:** Se reemplazó el test `rechaza category_id vacío` (desactualizado desde que se implementó multi-categoría via `selectedCategoryIds`) por tests que reflejan el comportamiento real del schema: `category_id` es opcional, `null` es rechazado (vs `undefined`), y la validación de "al menos una categoría" ocurre fuera del schema en `onSubmit`. Se agregaron tests de boundary values para `discount_percentage` (0, 100, -1, 101) y casos null/undefined para `discount_expires_at`. Se agregó la sección "Tests efectivos — reglas de calidad" en CLAUDE.md con guías sobre boundary values, null vs undefined, proporción de tests negativos y documentación de decisiones de diseño en nombres de tests.

---

## 2026-05-13 — Agregar reglas y tests de cobertura faltantes

- **Archivos creados:** `src/lib/dateUtils.test.ts`, `src/lib/stock.test.ts`, `src/lib/constants.ts`
- **Archivos modificados:** `CLAUDE.md`
- **Qué cambió:** Se agregó la sección `## Testing` a CLAUDE.md con convenciones obligatorias (qué testear, estructura, mock de Supabase). Se crearon tests para `dateUtils.ts` (15 casos: toOrgDateKey, orgTzOffset, buildDateRange) y `stock.ts` (17 casos: getProductStock con retry, getProductsStock con dedup, getMainBranchId con cache). Se creó `constants.ts` con PAGE_SIZE_STORE, PAGE_SIZE_ADMIN y PAGE_SIZE_OPTIONS centralizados.

## 2026-05-13 — Agregar 9 secciones de reglas faltantes a CLAUDE.md

- **Archivos modificados:** `CLAUDE.md`
- **Qué cambió:** Se agregaron las secciones: Errores/loading/skeletons, Empty states, Modales, Navegación, Fechas y timezone, Paginación, Storage (imágenes), Supabase Realtime. También se expandió la sección "Lo que NO hacer" con las restricciones correspondientes. Todas las reglas estaban implícitas en el código pero no documentadas.

## 2026-05-13 — Agregar regla de changelog a CLAUDE.md

- **Archivos modificados:** `CLAUDE.md`, `CHANGELOG.md` (nuevo)
- **Qué cambió:** Se agregó la sección `## Changelog` a `CLAUDE.md` con la regla de que Claude Code debe actualizar este archivo al finalizar cada tarea que modifique código. Se creó `CHANGELOG.md` como archivo inicial.
