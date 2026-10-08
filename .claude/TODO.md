# TODO — Axiostock

Archivo mantenido por Claude Code. Se actualiza automáticamente cuando se detecta algo a mejorar.
Prioridades: 🔴 crítico · 🟠 alta · 🟡 media · 🟢 baja

---

## Portada con fotografías (2026-10-08)

- 🟢 Resolver lint preexistente en `src/pages/PublicStore.tsx`: `no-constant-condition` en el recorrido de categorías y dependencias de hooks inestables. El nuevo `HomeEditorial.tsx` pasa lint.

## Visitanos (2026-10-08)

- 🟡 Pedir al cliente el logo en mayor resolución o vectorial (SVG/PDF): el original es 531x601 JPEG, el og-image (1200x630) y los íconos salen con el logo a tamaño nativo — más nitidez para og-image y futura impresión
- 🟢 Borrar assets Ruemia sin uso (cero referencias en código): src/brand/isotipo-cropped.png, isotipo-fondo1.png, logo-principal-fondo1.png, ruemia-logo-horizontal.png, branboard.pdf; public/berlin.regular.ttf, public/Cambria.ttf
- 🟡 Agregar horarios de atención a la página Visitanos (dato aún no confirmado) — src/pages/Visitanos.tsx
- 🟡 Agregar fotos del local a la página Visitanos — src/pages/Visitanos.tsx
- 🟢 Usar el link de la ficha de Google Maps del local para un embed más rico (reseñas, fotos) — src/lib/storeLocation.ts
- 🟢 Agregar JSON-LD LocalBusiness una vez confirmados los horarios — src/pages/Visitanos.tsx

## Rebrand Mates Ajedrez (2026-10-08)

### 🔴 Crítico
- 🔴 Completar placeholders legales: [NOMBRE COMPLETO DEL TITULAR] y [EMAIL DE CONTACTO] en TerminosCondiciones.tsx y PoliticaPrivacidad.tsx; TRANSFER_CONTACT_EMAIL en OrderConfirmation.tsx (era un email de Ruemia, ahora placeholder)

### 🟠 Alta
- 🟠 Configurar env vars de build: VITE_SITE_URL=https://mateajedrez.uy, VITE_SOCIAL_INSTAGRAM=https://www.instagram.com/matesajedrez/, VITE_SOCIAL_WHATSAPP=<número real>, VITE_STORE_SLUG; revisar organization.settings.store_whatsapp_number en DB
- 🟠 Regenerar public/sitemap.xml en el próximo build con el dominio nuevo (si se commitea) y revisar el banner de envío (ShippingNoticeBanner.tsx, plazo 3 a 5 días) con el cliente

### 🟡 Media
- 🟡 Archivos de fuentes obsoletos removibles: public/berlin.regular.ttf y public/Cambria.ttf (ya no se referencian)
- 🟡 Footer solo soporta Instagram/Facebook/WhatsApp; el manual incluye Threads (https://www.threads.net/@matesajedrez) — agregar si el cliente lo pide (requiere cambio de código, fuera del alcance del rebrand)

## Facelift Mates Ajedrez (2026-10-08)
- 🟡 Verificar visualmente ProductCard/ProductDetail/Checkout con datos reales (la DB actual no tiene productos, no se pudo capturar)
- 🟡 Spinners `animate-spin` restantes en Cart, OrderConfirmation, VariantSelector y botones: migrar a skeleton/BrandLoader
- 🟢 `SkeletonFullPage` quedó sin uso tras BrandLoader — eliminar si no se necesita
- 🟢 Contraste de `text-brand-muted` (#6E634F) sobre #FBF9F3 ≈ 5.6:1, OK; revisar sobre `bg-brand-crema` en tablas del checkout

## Rebrand Ruemia (2026-07-19)

### 🟠 Alta

- 🟠 **Contenido legal con placeholders pendientes de completar antes de producción.** `src/pages/PoliticaPrivacidad.tsx` y `src/pages/TerminosCondiciones.tsx` (nueva) fueron reescritas para Ruemia (ver Completado 2026-07-25), pero el usuario confirmó que la tienda **no está registrada ante DGI** (sin RUT/monotributo) — el responsable se identifica por nombre completo + domicilio, no por razón social. Faltan datos reales, marcados `[COMPLETAR ...]` en ambos archivos: nombre completo del titular, domicilio/localidad, email de contacto, plazo y condiciones de cambios/devoluciones, zonas/costo/plazo de envío, y si se emite algún comprobante de venta.

### 🟡 Media

- 🟡 `organization.settings.store_whatsapp_number` sigue en `null` en la base — el número real (`092 391 232`, del brand board) no se cargó a propósito (falta autorización explícita para el `UPDATE`). Mientras tanto el botón "Consultar disponibilidad" de `ProductDetail.tsx` no aparece; cae al fallback de botón deshabilitado.
- 🟡 `supabase/functions/send-notification/email-templates.ts` — el logo de los emails transaccionales ya apunta a `/og-image.png` en el código, pero requiere `supabase functions deploy` manual para tomar efecto en producción.

### ✅ Completado

- ✅ 2026-07-25 — **Política de Privacidad reescrita + Términos y Condiciones creados + links en footer.** `PoliticaPrivacidad.tsx` ya no describe a Axiostock como SaaS (Supabase/Biller/CFE del proveedor) — ahora es el contenido real de Ruemia como tienda. `TerminosCondiciones.tsx` es nuevo (no existía ninguna página de términos), con ruta `/legal/terminos` en `App.tsx`. El footer (`Footer.tsx`) no linkeaba a ninguna página legal — bug ya trackeado más abajo en "Auditoría storefront público" — corregido agregando ambos links en la barra inferior. `Checkout.tsx` ahora referencia ambos documentos en el texto de aceptación (antes solo privacidad). El número de WhatsApp (`+598 98 839 561`) se tomó real de `VITE_WHATSAPP_SALES_NUMBER` en `.env`, no es placeholder. Queda pendiente completar los datos reales del titular — ver 🟠 Alta arriba.
- ✅ 2026-07-19 — `src/components/ui/ActionsMenu.tsx` (huérfano, cero import sites) borrado junto con `Tabs.tsx`/`Dropdown.tsx`/`ProductListItem.tsx`.
- ✅ 2026-07-19 — `public/logo2.png`, `public/logo3.png`, `public/logo.svg` borrados — solo quedaban referenciados en `PWA_SETUP.md` (doc desactualizada), cero uso en código tras el rebrand.

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

## Duplicar producto / Grilla de variantes (2026-07-16)

### 🟡 Media

- 🟡 `useProductVariantGrid.ts` — el batch save de variantes no es una transacción real: el `insert` de filas nuevas es atómico, pero los `update` de filas existentes van en paralelo con `Promise.all`, cada uno con su propio `.update().eq('id', ...)`. Si esto empieza a fallar parcialmente en producción (algunos updates OK, otros no), mover el batch a una Edge Function/RPC para que sea atómico.

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
- ✅ ~~Checkout sin indicador de progreso/stepper~~ → **resuelto 2026-07-25**, ver Completado (lote de 13 mejoras visuales tienda pública).
- ✅ ~~submenú de categorías del header depende solo de `:hover`~~ → **resuelto 2026-07-25**, ver Completado.
- ✅ ~~duplicación de estilo en el CTA del hero de `PublicStore.tsx`~~ → **resuelto 2026-07-23**: el CTA pasó a `variant="outline"` (pedido del usuario) y ya no pisa el `style` de `Button` salvo cuando de verdad necesita un valor distinto (texto/borde blanco sobre foto de portada) — ver Completado.

### 🟢 Baja (queda abierto)

- 🟢 Estado de carrito vacío solo ofrece "Continuar Comprando" genérico a home — sin productos sugeridos ni link directo a `/products`. Es una mejora de contenido/feature, no visual.
- ✅ ~~gap del grid de skeleton en `PublicStore.tsx` no coincide con el grid real~~ → **resuelto 2026-07-25**, ver Completado.

## Auditoría storefront público — ecommerce-analyzer (2026-07-22)

Auditoría en vivo (navegador contra `localhost:5174`) + revisión de código, usando la skill `ecommerce-analyzer` recién creada. No duplica hallazgos ya trackeados en "UX/Diseño — Tienda Pública (2026-07-14)" — donde hay superposición se indica.

### 🟠 Alta

_(todos resueltos 2026-07-22 — ver Completado)_

### Reclasificados como dato, no código (2026-07-22)

- El ítem "producto sin foto real cae a un fallback con logo circular" **no es un bug de imagen rota**: el producto "?" ($890, `dbc5aa18-...`) tiene una URL de imagen válida y que carga (200) — el archivo subido es literalmente el isotipo circular "R." de la marca, no una foto del producto. Es un producto incompleto/borrador publicado por error (mismo patrón que el nombre "?"). Un solo producto afectado (verificado por `image_url` exacta, sin otros usos). Queda fuera del alcance de código, a resolver subiendo la foto real desde el admin.

### 🟡 Media

- 🟡 **El SEO dinámico por página (`<Helmet>`, agregado 2026-07-22) no resuelve el preview de WhatsApp/Twitter/Facebook al compartir un link** — esos crawlers no ejecutan JS, así que solo ven el HTML estático de `index.html` (siempre el mismo, genérico, para cualquier producto/categoría). Para que compartir un producto puntual muestre su foto/nombre real en el preview hace falta SSR o prerendering (ej. `vite-plugin-ssr`, prerender en build, o un proxy que sirva HTML pre-renderizado solo a bots) — es un cambio de arquitectura, no algo para resolver con Helmet solo. Decisión pendiente del usuario sobre si vale la pena para este catálogo.
- ✅ ~~Subcategorías no aparecen como chip de filtro en `/products`~~ → **resuelto 2026-07-25**, ver Completado (home se dejó sin tocar a propósito, solo categorías padre).
- ✅ ~~Grid de "Productos relacionados" no coincide con el estándar~~ → **resuelto 2026-07-25**, ver Completado.
- ✅ ~~Sin JSON-LD `schema.org/Product` por producto (precio, disponibilidad, imagen) — el `ld+json` de `index.html` es solo de organización/sitio.~~ → **resuelto 2026-09-25**, ver Completado (auditoría SEO).
- 🟡 `loading="lazy"` solo presente en `ProductCard.tsx:100` — falta en `CategoryCard.tsx:33,41`, `PublicStore.tsx:403` (imagen "Nosotros"), `ProductDetail.tsx:317,418`, `Cart.tsx:248`, `Checkout.tsx`, `OrderConfirmation.tsx:423`.
- ✅ ~~Sin ruta 404 real: `App.tsx:47` redirige cualquier ruta desconocida a `/`; un `/product/:id` inexistente cae en "Producto no encontrado" sin status semántico.~~ → **resuelto 2026-09-25**: `src/pages/NotFound.tsx` + `noindex`, ver Completado (auditoría SEO). Nota: el caso de `/product/:id` inexistente sigue devolviendo "Producto no encontrado" con `noindex` (ya correcto desde antes, sin status HTTP real posible en un SPA sin SSR).
- 🟡 Link de WhatsApp del footer (`https://wa.me/` sin número) roto — mismo root cause ya trackeado arriba en "Rebrand Ruemia": `store_whatsapp_number` sigue en `null`. Este es un segundo síntoma (footer) además del botón de `ProductDetail.tsx` ya anotado.

### 🟢 Baja

- ✅ ~~Variantes sin stock sin texto/tooltip que lo explique~~ → **resuelto 2026-07-25**, ver Completado.
- ✅ ~~Spinner genérico en vez de `<Skeleton>` en `PublicStoreWrapper.tsx`/`App.tsx`~~ → **resuelto 2026-07-25**, ver Completado.
- ✅ ~~Sin breadcrumbs en `ProductDetail`/`CategoryProducts`~~ → **resuelto 2026-07-25**, ver Completado.
- ✅ ~~Footer sin trust signals (envíos, devoluciones, medios de pago)~~ → **resuelto 2026-07-25**, ver Completado — texto genérico, sin plazos/costos todavía no confirmados.
- 🟢 `src/lib/storage.ts` mencionado en `CLAUDE.md` no existe en el repo actual — discrepancia doc/código, no afecta hoy al storefront público (no sube imágenes) pero relevante para cuando se implemente carga de imágenes en admin.
- 🟢 Cumple bien su propio estándar visual: badge de descuento arriba-izquierda, `aspect-square`, botón flotante en hover, overlay "Sin stock", filtros chip pills siempre visibles, empty state de búsqueda vacía, accesibilidad de `alt`/`aria-label` en imágenes y botones — todo verificado en vivo y en código.

## Auditoría UX general — Tienda Pública (2026-07-24, 4 agentes en paralelo: home/header/footer, listados/cards, PDP, carrito/checkout/confirmación)

Solo se listan hallazgos **nuevos** no trackeados ya más arriba. Los marcados "verificado" fueron confirmados leyendo el código directamente (no solo el reporte del agente) antes de anotarlos acá.

### 🔴 Crítico

_(los 2 hallazgos críticos de esta auditoría fueron corregidos el mismo día — ver Completado)_

### 🟠 Alta

_(5 de los 6 hallazgos de alta prioridad de esta auditoría fueron corregidos el mismo día — ver Completado. Queda abierto el de Mercado Pago, ver abajo, pendiente de decisión del usuario.)_

- 🟠 **Pendiente de decisión — no se tocó código.** La orden y sus `order_items` se insertan en la DB **antes** de pedir la preferencia de Mercado Pago (`Checkout.tsx`, flujo `paymentMethod === 'mercadopago'`). Si `create-mp-preference` falla, la orden queda creada (`status: pending`), el carrito no se limpia, y reintentar puede generar una segunda orden completa para el mismo intento de compra. Investigado: `order_items` sí tiene `ON DELETE CASCADE` desde `orders` (migración `001_initial_schema.sql:72`) y existe un trigger `restore_branch_inventory_on_order_item_delete` (`056_order_edit_rls.sql`, superseded en `094_checkout_manual_stock_allocation_mode.sql`) que restaura el stock al borrar un `order_item` — en teoría borrar la orden fallida sería seguro para el stock. Pero: (1) no se pudo confirmar si la policy RLS de `orders` permite `DELETE` a un usuario anónimo/guest de checkout (podría fallar en silencio y dejar el huérfano igual), y (2) no se pudo verificar en vivo cómo interactúa ese trigger con el costeo FIFO (`124_costing_method_fifo.sql`) para el caso específico de un rollback post-fallo-de-MP. Implementar el rollback automático sin verificar esto en un entorno real es más riesgoso que el bug actual (podría corromper stock/costeo en silencio). Alternativa más simple y sin tocar triggers: no borrar la orden, marcarla con un status tipo `payment_failed`/`cancelled` en vez de dejarla en `pending`, para que no ensucie el panel admin ni bloquee reintentos — requiere agregar ese status al enum/checks de `orders.status` si no existe. **Necesita que el usuario decida el enfoque antes de tocar este flujo.**

### 🟡 Media

_(los 14 hallazgos de media prioridad de esta auditoría fueron corregidos el mismo día — ver Completado. Una sub-parte de uno de ellos quedó abierta a propósito, ver el ítem de zoom más abajo.)_

- ✅ ~~Zoom/lightbox en la galería de `ProductDetail.tsx`~~ → **resuelto 2026-07-25**: modal fullscreen tap-to-zoom, ver Completado.
- 🟡 **Queda abierto (relacionado, no tocado).** `src/pages/Products.tsx:89-92` + `src/lib/stock.ts:sortByStockFirst` — el sort por stock se re-aplica sobre **todo** el array acumulado cada vez que se pide "Cargar más" en `/products`, así que productos sin stock de la página 1 pueden saltar de posición cuando llega la página 2. No estaba en el alcance de esta pasada (que se centró en los hallazgos nuevos de la auditoría UX del 2026-07-24); fix: ordenar solo la página nueva antes de anexarla, no todo el acumulado.

### 🟢 Baja

- ✅ ~~CTA principal del hero sin ícono `ArrowRight`~~ → **resuelto 2026-07-25**, ver Completado.
- ✅ ~~Puntos indicadores del carrusel del hero y del fallback de `CategoryCard` no interactivos~~ → **resuelto 2026-07-25**, ver Completado.
- 🟢 Sección "Productos destacados" del home en realidad es "primer producto con stock por categoría en orden de array", no una selección curada/best-sellers — el nombre puede generar expectativas equivocadas.
- 🟢 Botones +/− de cantidad en `ProductDetail.tsx:497-517` sin `aria-label` (el botón de compartir sí lo tiene). Nota: distinto del ítem de `Cart.tsx` de abajo, ya resuelto — este es en la ficha de producto, no se tocó.
- ✅ ~~Cantidad del carrito no editable~~ → **resuelto 2026-07-25**, ver Completado.
- 🟢 Sin validación de `priceRange.min <= priceRange.max` en los filtros de precio — un rango invertido solo da "Sin resultados" sin explicar por qué.
- 🟢 `src/pages/Products.tsx` (350ms) vs `src/pages/CategoryProducts.tsx` (400ms) — debounce de búsqueda con timing distinto entre dos páginas casi idénticas.

## Auditoría SEO — ruemia.uy (2026-09-25)

Implementación del plan de acción de `seo-audit-ruemia.md` (Tier 1 y Tier 2, ver Completado). Pendiente lo que queda fuera de alcance de esta pasada:

### 🟠 Alta

- 🟠 **Imágenes de producto sin optimizar** (hasta 2.5 MB en JPEG, sin `width`/`height`, `Cache-Control: no-cache`) — Issue #6 del audit. Fuera de alcance de esta pasada a pedido explícito del usuario (revertido antes por él a propósito). Recomendación pendiente: transformaciones de Supabase Storage (`?width=800&quality=75&format=webp`), `width`/`height` explícitos, y `cacheControl` al subir en `src/lib/storage.ts` (o donde viva `uploadProductImage` — no encontrado en este checkout, ver Issue #6 del audit para detalle).
- 🟠 **SSR/prerender para previews sociales** — ya trackeado arriba (2026-07-22) y confirmado de nuevo en el audit (Issue #11): WhatsApp/Twitter/Facebook no ejecutan JS y siempre ven el `index.html` genérico. Decisión de arquitectura pendiente del usuario.

### 🟡 Media

- 🟡 **Paginación "Cargar más" sin URL propia** (`Products.tsx`, `CategoryProducts.tsx`) — Issue #3 del audit. Mitigado por el sitemap (lista cada producto/categoría directo), pero no se cambió el patrón de paginación en sí (fuera de alcance explícito de esta tarea).
- 🟡 **Enviar el sitemap a Google Search Console** una vez deployado — acción manual del usuario, no de código.
- 🟡 **Verificar Rich Results** (`Product`/`BreadcrumbList` recién agregados) con la [Rich Results Test](https://search.google.com/test/rich-results) de Google contra una URL real de producción.

### 🟢 Baja

- 🟢 Alt text de `ProductCard.tsx` sigue siendo `{categoría} {índice}` en vez de describir el producto puntual (Issue #13 del audit) — no tocado, fuera del alcance explícito de esta tarea.
- 🟢 Meta descriptions de producto/categoría por debajo del largo ideal (Issue #12 del audit) — depende de contenido cargado en Supabase, no de código.

## Completado ✅

- ✅ 2026-10-08 — Logo y assets de Mates Ajedrez integrados (header, footer, BrandLoader, favicon, apple-touch-icon, icon-192/512, og-image 1200x630, JSON-LD logo, sw cache v2). Reemplaza los pendientes de assets Ruemia.
- ✅ 2026-09-25 — **Auditoría SEO (Tier 1 + Tier 2 de `seo-audit-ruemia.md`)**:
  1. `public/robots.txt` (nuevo) — `Allow: /`, `Disallow` de `/admin` (no existe en este fork, agregado igual por consistencia con otros forks), `/cart`, `/checkout`, `/order-confirmation`, y `Sitemap: https://ruemia.uy/sitemap.xml`.
  2. `scripts/generate-sitemap.ts` (nuevo, corre en `prebuild` antes de `vite build`) — genera `public/sitemap.xml` con rutas estáticas + categorías + productos activos (`is_active = true`) de la organización resuelta por `VITE_STORE_SLUG` vía `get_org_by_slug`. Fail-soft: sin env o con Supabase caído, igual escribe un sitemap con las rutas estáticas. Lógica pura (XML builder, helper de URL absoluta) en `src/lib/sitemapBuilder.ts` + `src/lib/siteUrl.ts`, con tests.
  3. `nginx.conf` — redirect 301 `www.ruemia.uy` → `https://ruemia.uy$request_uri` (por `Host`, nginx no termina TLS acá); `robots.txt`/`sitemap.xml` servidos como archivos reales con `Content-Type` explícito, antes del fallback SPA.
  4. Canonical y `og:url` absolutos (`src/lib/siteUrl.ts::absoluteUrl`) en `PublicStoreLayout.tsx`, `ProductDetail.tsx`, `CategoryProducts.tsx`, `Products.tsx` — antes eran relativos (`href="/product/{id}"`), ambiguos entre `www` y apex.
  5. `src/pages/NotFound.tsx` (nuevo) — reemplaza el redirect silencioso `<Navigate to="/" />` del catch-all de `App.tsx` (soft-404). `noindex` vía Helmet, mismo patrón que "producto no encontrado" de `ProductDetail.tsx`.
  6. JSON-LD `Product` + `BreadcrumbList` en `ProductDetail.tsx`, `BreadcrumbList` en `CategoryProducts.tsx` (builders puros en `src/lib/jsonLd.ts`, con tests). `index.html` — los dos bloques `Organization` duplicados (con distinto `logo`) se consolidaron en uno solo, con `url` y `sameAs` (Instagram/Facebook).
  7. `Dockerfile` — bug preexistente encontrado: `node:20-alpine` no cumple `engines.node ">=22"` de `package.json` (`yarn install` fallaba). Corregido a `node:22-alpine`. Se agregaron `ARG`/`ENV` para `VITE_STORE_SLUG` y `VITE_SITE_URL` (antes no estaban declarados, así que un `--build-arg` los ignoraba en silencio).
  - **Tradeoff documentado:** el sitemap se genera en build-time (hook `prebuild`), no en request-time — un producto nuevo cargado en Supabase no aparece en el sitemap hasta el próximo build/deploy.
  - Validado end-to-end con `docker build` + `docker run` real (robots.txt/sitemap.xml con Content-Type correcto, redirect www→apex, SPA fallback intacto) — ver CHANGELOG.md para detalle de tests/typecheck/build.

- ✅ 2026-07-25 — **Lote de 13 mejoras visuales/UX en la tienda pública** (a pedido explícito del usuario de agrupar varios ítems del backlog visual en una sola pasada, delegado a un sub-agente y verificado después):
  1. Nuevo `src/components/features/CheckoutSteps.tsx` — stepper "Carrito → Checkout → Confirmación" montado en `Cart.tsx`/`Checkout.tsx`/`OrderConfirmation.tsx`, paso activo con `var(--org-primary-color)`, no clickeable (solo indicador).
  2. `PublicStoreHeader.tsx` — el dropdown de categorías desktop ya tenía click + cierre al click afuera; se le agregó `group-hover` CSS puro (no `onMouseEnter/onMouseLeave`, respeta la regla del proyecto) para que el hover siga funcionando en mouse además del click en táctil.
  3. `ProductDetail.tsx` — grid de "Productos relacionados" ajustado a `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5` (estándar del proyecto).
  4. `Products.tsx` — subcategorías agregadas como chips adicionales (borde/texto más tenue que las categorías padre) después de los chips de categoría padre; reusa `selectCategory` existente, sin cambios de hook (el filtro ya resuelve categoría padre o hija vía junction table). Home sin tocar a propósito.
  5. `ProductDetail.tsx` — lightbox fullscreen al tocar/clickear la imagen principal (patrón modal estándar del proyecto: `fixed inset-0 z-50 bg-black/50`, X para cerrar, click afuera cierra, Escape cierra), reusa los handlers de navegación ya existentes de la galería.
  6. `PublicStore.tsx` — ícono `ArrowRight` agregado al CTA "Ver productos" del hero, igual que los demás CTAs de la home.
  7. `PublicStore.tsx` — puntos del carrusel del hero convertidos a `<button aria-label="Ir a la imagen N">` reales (ya tenían slide-state detrás). `CategoryCard.tsx` — los puntos del fallback también tenían estado real (auto-rotación) detrás, así que se cablearon como botones reales con `stopPropagation`/`preventDefault` (la card entera es un `<Link>`) en vez de sacarles la interactividad.
  8. `Cart.tsx` — nuevo `CartQuantityInput` (input numérico junto a los botones +/-, commitea con `updateQuantity` al perder foco o Enter, clamp a `[1, stock disponible]`).
  9. `VariantSelector.tsx` — `title="Sin stock"` + línea diagonal (`pointer-events-none`, no afecta layout) en swatches de atributo deshabilitados.
  10. Breadcrumb (`Inicio / Categoría / Producto`) agregado en `ProductDetail.tsx` y `CategoryProducts.tsx`, mismo estilo en ambos, sin sacar los botones "Volver" existentes.
  11. `Footer.tsx` — 3 líneas de trust signals (`Truck`/`RotateCcw`/`CreditCard` de Lucide) con texto genérico ("Coordinamos tu envío", "Cambios dentro de los primeros días", "Múltiples medios de pago") — sin plazos/costos concretos todavía no confirmados por el usuario (ver placeholders de `TerminosCondiciones.tsx`).
  12. Nuevo `SkeletonFullPage` en `src/components/ui/Skeleton.tsx` (header + hero + grid placeholder), reemplaza el spinner circular en `PublicStoreWrapper.tsx` y `App.tsx` para el loading de pantalla completa antes de resolver la organización.
  13. `PublicStore.tsx` — gap del grid de skeleton corregido de `gap-4 md:gap-6` a `gap-4 md:gap-5` para igualar el grid real.
  - **Verificado:** `tsc --noEmit` limpio, 86/86 tests (mismo conteo que antes de empezar). `eslint` con los mismos 31 errores/12 warnings preexistentes (ninguno en líneas nuevas de este lote). Revisión manual propia (no solo el reporte del sub-agente) de los 3 cambios con más margen de interpretación — stepper, lightbox, input de cantidad — leyendo el diff real antes de dar el lote por cerrado. **No verificado visualmente en navegador** — recomendado un smoke pass manual (lightbox en mobile real, hover+click del submenú de categorías en un dispositivo híbrido, stepper en las 3 páginas del flujo de compra) antes de confiar en esto para producción.
  - **Hallazgo aparte, no resuelto:** al revisar el diff se notó que dos fixes que el registro de este mismo TODO/CHANGELOG daba como "completados el 2026-07-24" (botón "Volver a productos" → `navigate(-1)` en `ProductDetail.tsx`, y cierre del menú/buscador mobile al tocar afuera del `<header>` en `PublicStoreHeader.tsx`) **no estaban presentes en el código antes de esta pasada** — el sub-agente terminó reimplementándolos de cero como si nunca se hubieran hecho. La rama actual (`restore`) no tiene ningún commit desde 2026-07-23 (`git log -1`: `e6d3974`, "First estilos") — todo el trabajo de las sesiones del 24 y 25 de julio quedó siempre como cambios sin commitear en el working tree. No se pudo determinar la causa exacta (¿un `git checkout` puntual sobre esos archivos en algún momento? ¿el registro del changelog de esa fecha estaba adelantado a un trabajo que después no se guardó?), pero es una señal de que los registros de "Completado" de este archivo pueden no reflejar 100% el estado real del código si no hay commits de por medio. **Recomendado: hacer un commit de checkpoint pronto** (hay ~22 archivos modificados sin commitear acumulados de varias sesiones) para que este tipo de desfasaje no vuelva a pasar desapercibido.

- ✅ 2026-07-24 — **2 bugs críticos de la auditoría UX general corregidos:**
  1. `src/hooks/usePublicProducts.ts` — `fetchFilteredProducts` ahora consulta `product_categories` (junction table) antes de armar el filtro, igual que `fetchCategoryProducts`: si hay productos vinculados a la categoría elegida solo por junction, se agregan al filtro vía `.or('category_id.eq.X,id.in.(...)')` en vez de perderse con el `.eq('category_id', X)` simple de antes. `/products` y `/categories/:slug` ahora dan resultados consistentes para la misma categoría.
  2. `src/pages/ProductDetail.tsx` + `src/components/features/VariantSelector.tsx` — se agregó el callback `onAvailabilityChange` en `VariantSelector`: una vez que termina de traer el stock de todas las variantes, informa al padre si existe al menos una variante activa con stock > 0. `ProductDetail` guarda eso en `allVariantsUnavailable` (reseteado al cambiar de producto) y lo usa para forzar `isOutOfStock = true` cuando el producto tiene variantes pero ninguna es comprable — antes ese caso quedaba trabado para siempre en el botón deshabilitado "Seleccioná una variante", sin mostrar el mensaje de "sin stock" ni el fallback de WhatsApp. De paso, el caso de variante única sin stock (antes solo texto plano sin ninguna indicación) ahora muestra "Sin stock disponible" dentro de su propio box. **Verificado:** `tsc --noEmit` limpio, 86/86 tests. No se pudo verificar visualmente en navegador (no había sesión de Chrome conectada ni datos reales con productos 100% sin stock a mano) — recomendado un smoke test manual con un producto real de variantes agotadas antes de dar por cerrado del todo.

- ✅ 2026-07-24 — **5 de los 6 hallazgos de alta prioridad de la auditoría UX general corregidos** (el 6to, Mercado Pago/orden duplicada, quedó pendiente de decisión del usuario — ver 🟠 Alta más arriba):
  1. `src/store/cartStore.ts` — nueva clase interna `CartToastedError` para marcar errores que ya mostraron su propio toast específico (stock insuficiente, producto inactivo, variante no encontrada). El `catch` de `addToCart` ya no dispara el toast genérico "Error al agregar producto al carrito" cuando el error ya fue mostrado — antes lo tapaba siempre.
  2. `src/store/toastStore.ts` + `src/components/layout/ToastContainer.tsx` — se agregó un `id` incremental al store; `ToastContainer` ahora renderiza `<Toast key={id} .../>` para forzar un remount (y timer de auto-cierre fresco) en cada `show()`, incluso con dos toasts seguidos de texto idéntico.
  3. `src/store/cartStore.ts` — `updateQuantity` y `removeFromCart` ahora muestran un toast de error antes de relanzar la excepción (antes solo `console.error`). `src/pages/Cart.tsx` agregó `.catch(() => {})` en los 3 `onClick` que las invocan (+/−/eliminar) para evitar el unhandled promise rejection ahora que el store ya maneja el feedback.
  4. `src/components/layout/PublicStoreLayout.tsx` — el contenedor raíz pasó de `min-h-screen bg-white` a `min-h-screen flex flex-col bg-white`, para que el `flex-1` del `<main>` (que ya estaba) deje de ser inerte y el footer quede pegado abajo en páginas con poco contenido.
  5. `src/pages/Checkout.tsx` — nuevo `useEffect` que redirige a `/cart` si `items.length === 0` una vez que el carrito terminó de cargar (`cartLoading` del store, para no disparar un falso positivo mientras `PublicStoreHeader` todavía está trayendo el carrito en paralelo).
  - **Verificado:** `tsc --noEmit` limpio, 86/86 tests, `eslint` sin errores nuevos (mismos 15 `any` preexistentes de siempre, confirmado comparando contra el estado sin estos cambios). No verificado visualmente en navegador.

- ✅ 2026-07-24 — **14 de los hallazgos de media prioridad de la auditoría UX general corregidos** (solo quedaron abiertos el zoom/lightbox de la galería y el reorder de `sortByStockFirst` en "Cargar más" de `/products` — ver 🟡 Media más arriba):
  1. `src/hooks/usePublicProducts.ts` + `src/pages/CategoryProducts.tsx` — `fetchCategoryProducts` ahora trae `stockByProduct` en la misma respuesta paginada (igual que `fetchFilteredProducts`), eliminando la tormenta de fetches individuales por `ProductCard` y el reordenamiento visible cuando llegaba el batch tardío.
  2. `src/pages/CategoryProducts.tsx` — agregado el mismo tratamiento `isFiltering` (spinner en el buscador + grilla atenuada al 50%) que ya tenía `Products.tsx`. De paso se encontró y corrigió un bug más severo en el camino: el `useEffect` de reset de filtros vaciaba `products` de forma eager en cada cambio de filtro (mismo bug ya resuelto en `Products.tsx` el 2026-07-23, pero nunca portado acá), causando un flash real de "Sin resultados" — se sacó el vaciado eager para cambios de filtro y se movió a un efecto separado que sí limpia al cambiar de `categorySlug` (cambio de listado real).
  3. `src/components/features/VariantSelector.tsx` — la disponibilidad de un swatch de atributo ahora agrega stock de **todas** las variantes compatibles con ese valor (+ atributos ya seleccionados), no solo la primera que matchea con `.find()`.
  4. `src/components/features/VariantSelector.tsx` + `src/pages/ProductDetail.tsx` — nuevo callback `onVariantStocksChange` que reporta el mapa de stock por variante ya calculado en `VariantSelector`; `ProductDetail` lo consume en vez de pedir por su cuenta el stock de la variante seleccionada, eliminando la segunda llamada descoordinada a `getProductStock` que podía mostrar números distintos por un instante.
  5. `src/pages/ProductDetail.tsx` — el badge de categoría pasó de `<span>` estático a `<Link to="/categories/:slug">`.
  6. `src/pages/ProductDetail.tsx` — swipe táctil agregado a la galería (`onTouchStart`/`onTouchEnd`, umbral 40px) reutilizando `handlePreviousImage`/`handleNextImage` existentes. Zoom/lightbox quedó fuera de esta pasada (ver 🟡 Media).
  7. `src/pages/ProductDetail.tsx` — el botón "Volver a productos" (siempre apuntaba a `/products` sin filtros) pasó a `navigate(-1)` (vuelve al listado exacto de origen, con sus filtros); el estado "Producto no encontrado" mantiene el link fijo a `/products` a propósito (un `-1` no sirve si se llegó por un link roto/compartido).
  8. `src/pages/OrderConfirmation.tsx` — el encabezado ahora reusa la misma `orderRef` (prefiere `order_number`) que ya usaban el link de WhatsApp y el PDF, en vez de `order.id.slice(0,8)`.
  9. `src/pages/Checkout.tsx` — sección "Método de Pago": skeleton mientras `useOrgPaymentMethods` está cargando, mensaje explícito si la org no configuró ninguno.
  10. `src/pages/Checkout.tsx` — nuevo estado `paymentMethodError`: borde/texto rojo bajo la sección de método de pago cuando falla la validación (antes solo un toast de 3s), se limpia al elegir un método.
  11. `src/pages/OrderConfirmation.tsx` — `handleRefreshMpPayment` ahora muestra un toast de error si la edge function responde con error o falla la red (antes no pasaba nada visible).
  12. `src/components/layout/PublicStoreWrapper.tsx` — la pantalla de organización no encontrada/error ya no muestra `err.message` crudo (siempre un mensaje genérico en español) y ahora distingue error de red (con botón "Reintentar" que re-dispara la carga) de "no existe"/"no configurada" (sin botón, no tendría sentido reintentar).
  13. `src/components/layout/PublicStoreHeader.tsx` — `aria-expanded` agregado al botón de menú mobile (ya lo tenía el de categorías desktop).
  14. `src/components/layout/PublicStoreHeader.tsx` — menú y buscador mobile ahora se cierran al tocar afuera del `<header>` (mismo patrón `mousedown` + ref que ya usaba `CategoryMenu` en desktop).
  - **Verificado:** `tsc --noEmit` limpio, 86/86 tests, `eslint` sin errores nuevos en ninguno de los 14 archivos tocados (confirmado que los `any`/warnings restantes son preexistentes). No verificado visualmente en navegador — recomendado un smoke pass manual (swipe en mobile real, click-outside del menú, flujo de checkout con 0 métodos de pago) antes de dar el lote por cerrado del todo.

- ✅ 2026-07-22 — **Revisión adversarial (fresh context, agente `review-risk`) del fix de `organization_id` — 3 hallazgos, los 3 corregidos el mismo día:**
  1. 🔴 **Crítico, preexistente (no introducido por los refactors de hoy)**: `src/hooks/useProductVariants.ts` filtraba `product_variants` solo por `product_id`, sin `organization_id` — y la RLS de esa tabla (`037_update_rls_multi_tenant.sql:553-561`) es pública para cualquier producto `is_active`. Pidiendo `/product/<uuid-de-otra-organización>` se filtraban precio/SKU/atributos de variantes ajenas, aunque la ficha mostrara "Producto no encontrado". Corregido con un `inner join` a `products` (`product:products!inner(organization_id)`) filtrando `.eq('product.organization_id', organizationId)` — `product_variants` no tiene esa columna propia. Actualizados los 2 call sites (`ProductDetail.tsx`, `VariantSelector.tsx`) y `queryKeys.store.productVariants` (ahora incluye `orgId`). Verificado con curl contra la API real: el join con `organization_id` de otra org devuelve `[]`.
  2. 🟠 **Alta, introducido hoy**: `fetchCategoryProducts` (nuevo hook de hoy) armaba el filtro `.or()` de búsqueda por concatenación cruda del input del usuario, sin sanitizar — a diferencia de `fetchFilteredProducts` (mismo archivo, preexistente), que sí limpia `%`/`,` antes de interpolar. Una coma en el buscador podía inyectar condiciones extra en el `OR` de PostgREST (no rompía el aislamiento por organización, que sigue siendo un `AND` aparte, pero sí es manipulación de query). Corregido reusando el mismo patrón de sanitización que la función hermana.
  3. 🟡 **Media, funcional (no es un leak, es lo contrario — sobre-restringe)**: la política RLS de `product_categories` (migración 117) nunca tuvo policy de SELECT público, solo para miembros de la org — así que productos vinculados a una categoría *solo* vía esa tabla de junction (el caso que el refactor de `CategoryProducts.tsx` de hoy justamente intenta soportar) nunca aparecían para usuarios anónimos. Creada migración `supabase/migrations/141_fix_product_categories_public_rls.sql` (mismo patrón que `097_fix_categories_public_rls.sql`) — **pendiente que el usuario la aplique manualmente** (regla del proyecto: las migraciones se crean pero no se ejecutan desde Claude Code).
  - **Verificado:** `tsc --noEmit` limpio, 86/86 tests, y en navegador (Playwright) contra las 4 páginas (home/products/categoría/PDP) — sin regresiones, variantes de "Zuecos" siguen cargando con el join agregado.
- ✅ 2026-07-23 — **Hero del home: CTA outline + altura responsive + fix de UX en `/products`**:
  - CTA "Ver productos" del hero pasó de sólido a `variant="outline"`, con borde/texto blanco cuando hay foto de portada (mismo mecanismo `heroTextColor` que ya usaban título/subtítulo) — de paso resuelve el hallazgo abierto de duplicación de estilo del CTA (ver arriba).
  - `heroHeightClass` (`PublicStore.tsx`) retocado: menos padding en mobile, bastante más en desktop en los 4 presets (`sm`/`md`/`lg`/`xl`) — las fotos de portada son verticales, así que el hero angosto-y-alto de mobile ya recortaba poco, pero el ancho-y-bajo de desktop las recortaba de más. Verificado visualmente (Playwright, 1440px y 390px).
  - `organizations.settings.store_hero_show_cta` cambiado de `false` a `true` en la base para Ruemia (no hay toggle en el panel admin para este campo — el usuario pidió que lo hiciera directamente vía `UPDATE` puntual, con settings releídos en fresco antes de escribir para no pisar cambios concurrentes).
  - `/products`: 2 bugs de UX corregidos. (1) Elegir una categoría ahora limpia el buscador de texto (antes quedaba un término de búsqueda "fantasma" aplicado junto con la categoría). (2) Al tipear en el buscador aparecía "Sin resultados" por ~300-700ms antes de que cargaran los resultados reales — causado por un `useEffect` que vaciaba `allProducts`/`allStock`/`allVariants` apenas cambiaba el filtro, antes de que la respuesta debounced llegara; como `useFilteredProducts` usa `placeholderData`, `isLoading` ya daba `false` en ese momento así que no se veía el skeleton, sino el empty-state real. Se sacó el vaciado eager (el efecto de sync ya reemplaza `allProducts` en cuanto llega la data nueva) y se agregó un estado `isFiltering` (spinner reemplazando el ícono de búsqueda + grilla atenuada al 50% durante el fetch). Verificado con Playwright muestreando cada 60ms durante la ventana de debounce+fetch: los resultados anteriores quedan visibles sin flash, y recién se muestra "Sin resultados" cuando la búsqueda de verdad no tiene matches.
  - **Verificado:** `tsc --noEmit` limpio, 86/86 tests.
- ✅ 2026-07-22 — **`ProductDetail.tsx` migrado a TanStack Query + fix de carrito trabado + SEO por producto**: `fetchProduct` (`supabase.from` directo en `useState`/`useEffect`) reemplazado por `useStoreProduct` (nuevo hook en `usePublicProducts.ts`, mismo patrón que `useFilteredProducts`, key `queryKeys.store.product` que ya existía sin uso). El fallo intermitente `Failed to fetch` al agregar al carrito ya reseteaba el botón en un `finally`, pero el `catch` solo hacía `console.error` sin avisar al usuario — se agregó `show('No se pudo agregar el producto al carrito', 'error')`. SEO: `<Helmet>` con `title`/`description`/`og:*`/`canonical` dinámicos una vez cargado el producto, `noindex` en el estado "no encontrado". **Hallazgo adicional durante el refactor**: la query de producto (y la de relacionados) tampoco filtraban por `organization_id` — no estaba en el alcance original de la auditoría, se corrigió igual (`.eq('organization_id', organizationId)` agregado a ambas). Verificado: `tsc --noEmit` limpio, 86/86 tests, y en navegador (Playwright) simulando una falla de red real en el request de carrito — el toast de error aparece y el botón vuelve a "Agregar al carrito" en vez de quedar trabado.
- ✅ 2026-07-22 — **SEO en `Products.tsx`**: `<Helmet>` con title/description estáticos (no depende de datos de producto) + canonical `/products`.
- ✅ 2026-07-22 — **Bug de `<meta>` duplicados por `<Helmet>` corregido**: al agregar `<Helmet>` por página se detectó que `react-helmet-async` no elimina los tags estáticos preexistentes de `index.html` — solo puede *agregar* vía JS, así que quedaban dos `<meta name="description">` (y dos `og:title`/`og:description`/`canonical`/`og:image`) compitiendo en el DOM. Se agregó un `<Helmet>` base con los defaults del sitio en `PublicStoreLayout.tsx` (para que Home y cualquier página sin override propio sigan mostrando el default) y se sacaron de `index.html` los tags que ahora son dinámicos: `description`, `og:title`, `og:description`, `og:image`, `canonical`. `<title>` se dejó estático a propósito (Helmet lo pisa con `document.title =`, sin duplicar — sirve de fallback real para el instante antes de que cargue el JS). Verificado con Playwright: 1 sola instancia de cada tag en home/`/products`/categoría/PDP, y el valor correcto en cada caso (ej. `og:image` del PDP muestra la foto real del producto, no el default del sitio).
- ✅ 2026-07-22 — **`CategoryProducts.tsx` migrado a TanStack Query + fix `organization_id` + SEO por categoría**: `fetchCategoryAndProducts`/`fetchProductsForCategory` (llamadas directas a `supabase.from` en `useState/useEffect`) reemplazadas por `useCategoryProducts` (nuevo hook en `src/hooks/usePublicProducts.ts`, key `queryKeys.store.categoryProducts`, mismo patrón de `useFilteredProducts`/`Products.tsx`: `placeholderData` + acumulación de "Cargar más" en estado local). La resolución de categoría/padre/subcategorías por slug se rediseñó para derivarse de `usePublicCategories(orgId)` (ya cacheado y ya filtrado por `organization_id`) en vez de hacer 2 queries nuevas (`parent_id` y subcategorías) — esto elimina por construcción el bug de filtro de organización que tenían esas 2 queries, en vez de solo parchearlas. La query restante que sí sigue siendo una query real (`product_categories`, junction table) ganó `.eq('organization_id', organizationId)` explícito; el filtro de organización en la query de productos pasó de condicional (`if (organizationId) query = query.eq(...)`) a incondicional, garantizado estructuralmente por `enabled: !!organizationId` en el hook. SEO: primer uso real de `<Helmet>` en el repo — `title`/`description`/`og:title`/`og:description`/`canonical` dinámicos por categoría (fallback a los defaults estáticos de `index.html` para el resto de tags). Verificado: `tsc --noEmit` limpio, `eslint` limpio, 86/86 tests.
- ✅ 2026-07-22 — **Labels de atributo de variante traducidos ("Size" → "Talle")**: se confirmó por lectura directa de `product_variants.attributes` (188 variantes) que la clave del atributo es dato cargado inconsistente (`Size`/`Color`/`talle`/`color`, más claves rotas como `cristal`/`1 kilo`/`azul bebe` que no se tocan). Solución acordada con el usuario: mapa de traducción solo-display (`translateAttributeLabel()` en `src/lib/utils.ts`, 7 tests nuevos), sin escribir en la DB. Aplicado en `VariantSelector.tsx`. Verificado en navegador (Playwright) contra producto "Zuecos" — muestra "Talle".
- ✅ 2026-07-22 — **Descripción de producto con `\n\n` literal corregida**: se confirmó por lectura directa de `products.description` (read-only vía REST, no era un bug de render) que el problema es sistémico — 18 de 49 productos con descripción tienen el string literal `\n`/`\r\n` cargado como texto en vez de un salto de línea real, no solo "Eleonora". Se optó por normalizar en el frontend en vez de editar 18 filas a mano (cubre también cargas futuras con el mismo error): nueva función `normalizeLineBreaks()` en `src/lib/utils.ts` (7 tests nuevos en `utils.test.ts`) + `whitespace-pre-line` en el párrafo de `ProductDetail.tsx:488-490`. Verificado en navegador real (Playwright) contra el producto "Eleonora" — saltos de línea reales, `tsc --noEmit` limpio, 23/23 tests en `utils.test.ts`.

- ✅ 2026-07-16 — **`VariantGrid.tsx` — imagen por variante restaurada**: columna "Imagen" agregada (thumbnail + input file + "Quitar"). El archivo se sube recién al presionar "Guardar cambios" (no en cada selección), y si reemplaza/quita una imagen existente, el archivo viejo se borra del Storage después de confirmar el guardado exitoso en la base — mismo comportamiento que tenía `VariantForm.tsx` antes de ser reemplazado por la grilla.


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
