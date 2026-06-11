# Changelog — Axiostock

Registro de cambios realizados por Claude Code. Entradas en orden descendente.

---

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
