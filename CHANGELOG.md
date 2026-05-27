# Changelog — Axiostock

Registro de cambios realizados por Claude Code. Entradas en orden descendente.

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
