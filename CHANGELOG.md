# Changelog — Axiostock

Registro de cambios realizados por Claude Code. Entradas en orden descendente.

---

## 2026-09-25 — Auditoría SEO: robots.txt, sitemap.xml, canonicals absolutos, 404 real, JSON-LD

- **Archivos modificados:** `public/robots.txt` (nuevo), `scripts/generate-sitemap.ts` (nuevo), `src/lib/siteUrl.ts` (nuevo) + `siteUrl.test.ts` + `siteUrl.env.test.ts`, `src/lib/sitemapBuilder.ts` (nuevo) + `sitemapBuilder.test.ts`, `src/lib/jsonLd.ts` (nuevo) + `jsonLd.test.ts`, `src/pages/NotFound.tsx` (nuevo), `package.json`, `.gitignore`, `nginx.conf`, `Dockerfile`, `index.html`, `src/App.tsx`, `src/vite-env.d.ts`, `src/pages/ProductDetail.tsx`, `src/pages/CategoryProducts.tsx`, `src/pages/Products.tsx`, `src/components/layout/PublicStoreLayout.tsx`, `.claude/TODO.md`
- **Qué cambió:** implementación del plan Tier 1 + Tier 2 de la auditoría SEO (`seo-audit-ruemia.md`, 62/100 → objetivo ~88/100):
  1. `robots.txt` real (antes devolvía el shell HTML de la SPA, 200 OK) con `Disallow` de `/cart`, `/checkout`, `/order-confirmation`, `/admin` (no existe en este fork) y `Sitemap:` declarado.
  2. `sitemap.xml` generado en build-time (`prebuild` → `scripts/generate-sitemap.ts`, corre antes de `tsc && vite build`) con rutas estáticas + categorías + productos activos de la organización (`get_org_by_slug` + `is_active = true`, mismo filtro que `usePublicProducts.ts`). Fail-soft: sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_STORE_SLUG` o con Supabase caído, igual escribe un sitemap válido solo con rutas estáticas — nunca rompe el build (verificado con y sin `.env`, y dentro de un build Docker real con credenciales dummy).
  3. `nginx.conf` — redirect 301 `www.ruemia.uy` → `https://ruemia.uy$request_uri` (por header `Host`: este nginx no termina TLS, solo escucha `:80`); `robots.txt`/`sitemap.xml` servidos como archivos reales (`Content-Type: text/plain` / `application/xml`) antes del fallback SPA, sin romper `try_files` para el resto de las rutas.
  4. Canonical y `og:url` absolutos vía `absoluteUrl()` (`src/lib/siteUrl.ts`, base `VITE_SITE_URL` con fallback `https://ruemia.uy`) en `PublicStoreLayout.tsx`, `ProductDetail.tsx`, `CategoryProducts.tsx`, `Products.tsx` — antes eran relativos, ambiguos entre `www` y apex sin el redirect de infraestructura.
  5. `src/pages/NotFound.tsx` (nuevo) reemplaza `<Route path="*" element={<Navigate to="/" replace />} />` (soft-404 silencioso) — página real con `noindex`, `EmptyState` y link a inicio, montada dentro de `PublicStoreWrapper` para conservar header/footer.
  6. JSON-LD `Product` (nombre, imágenes, sku, `offers` con `getEffectivePrice`, `priceCurrency` de `useOrgSettings().currency`, disponibilidad real de stock) + `BreadcrumbList` en `ProductDetail.tsx`; `BreadcrumbList` en `CategoryProducts.tsx`. Builders puros en `src/lib/jsonLd.ts`. `index.html` — los dos bloques `Organization` duplicados (distinto `logo`, sin `url`/`sameAs`) se consolidaron en uno solo.
  7. **Bug preexistente encontrado y corregido en `Dockerfile`:** `FROM node:20-alpine` no cumplía `engines.node ">=22"` de `package.json` — `yarn install` fallaba con "The engine node is incompatible" en cualquier build Docker, no solo en este cambio. Corregido a `node:22-alpine` (además requerido por `scripts/generate-sitemap.ts`, que corre TypeScript nativo vía Node ≥22.6). Se agregaron `ARG`/`ENV VITE_STORE_SLUG` y `VITE_SITE_URL` — antes no estaban declarados, así que un `--build-arg VITE_STORE_SLUG=...` se ignoraba en silencio.
- **Tradeoff documentado:** el sitemap se genera en build-time, no en request-time — un producto nuevo cargado en Supabase no aparece en `sitemap.xml` hasta el próximo build/deploy. Guardado en engram (`project: ruemia`, tipo `decision`).
- **Fuera de alcance (a pedido explícito):** optimización/transformación de imágenes, SSR/prerender, cambios en las URLs de paginación. Quedan trackeados como pendientes en `.claude/TODO.md`.
- **Verificación:** `npx vitest run` 127/127 tests OK (9 archivos, incluye los 4 nuevos con 51 tests). `npx tsc --noEmit` limpio. `yarn build` (local, con Supabase real) y `docker build`+`docker run` (con credenciales dummy, para probar el camino fail-soft) verificados end-to-end: `dist/robots.txt` y `dist/sitemap.xml` presentes con el contenido correcto, un único bloque `Organization` en `dist/index.html`, nginx sirviendo `Content-Type` correcto para ambos archivos, redirect 301 `www→apex` funcionando, y el fallback SPA intacto para el resto de las rutas. `eslint` tiene 31 errores/11 warnings preexistentes (no introducidos por este cambio, verificado que ninguno cae en un archivo tocado aquí) — no bloquean `yarn build` porque no corre como parte de él.
- **Pendiente manual del usuario (post-deploy):** enviar `https://ruemia.uy/sitemap.xml` a Google Search Console; correr Rich Results Test sobre una URL de producto real; confirmar que la plataforma de deploy pasa `VITE_STORE_SLUG`/`VITE_SITE_URL` como build args si efectivamente usa este `Dockerfile` (ver nota en el reporte de la tarea sobre `nixpacks.toml` como posible ruta de deploy alternativa, no verificada).

## 2026-08-03 — Reactivación de reCAPTCHA v3 en Checkout

- **Archivos modificados:** `src/pages/Checkout.tsx`, `.env`, `package.json`, `yarn.lock`
- **Qué cambió:** se restauró la integración de reCAPTCHA v3 invisible en el checkout, que había sido implementada el 2026-06-01 (`17f620c`) y deshabilitada 11 días después junto a un commit de fixes de estilos, sin justificación registrada — incluyendo la desinstalación del paquete `react-google-recaptcha-v3` y la remoción de `VITE_RECAPTCHA_SITE_KEY` del `.env` activo. Se reinstaló el paquete, se restauró la site key (reutilizando el par existente, ya que el dominio no cambió) y se descomentó el flujo: `GoogleReCaptchaProvider` envolviendo el checkout, `executeRecaptcha('checkout')` antes de crear la orden, validación server-side contra la Edge Function `validate-recaptcha` (ya deployada y con `RECAPTCHA_SECRET_KEY` configurado en Supabase — no requirió cambios). Un score menor a 0.5 bloquea la creación de la orden.
- **Verificación:** `tsc --noEmit` limpio, 94/94 tests. No se pudo verificar visualmente en navegador (extensión de Chrome no conectada en esta sesión) — pendiente prueba manual del flujo de checkout end-to-end.

## 2026-07-25 — Lote de 13 mejoras visuales/UX en la tienda pública

- **Archivos modificados:** `src/components/features/CheckoutSteps.tsx` (nuevo), `src/components/layout/PublicStoreHeader.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/Products.tsx`, `src/pages/PublicStore.tsx`, `src/components/features/CategoryCard.tsx`, `src/pages/Cart.tsx`, `src/components/features/VariantSelector.tsx`, `src/pages/CategoryProducts.tsx`, `src/components/layout/Footer.tsx`, `src/components/ui/Skeleton.tsx`, `src/components/layout/PublicStoreWrapper.tsx`, `src/App.tsx`, `src/pages/Checkout.tsx`, `src/pages/OrderConfirmation.tsx`, `.claude/TODO.md`
- **Qué cambió:** a pedido del usuario ("tomemos varias cosas a la vez para no ir parando"), se agrupó todo el backlog puramente visual/UX de la tienda pública en un solo lote: stepper de progreso en Carrito/Checkout/Confirmación, submenú de categorías con hover + click, grid de "relacionados" alineado al estándar, subcategorías como chip de filtro en `/products`, lightbox en la galería de producto, ícono en el CTA del hero, puntos de carrusel convertidos en botones reales, cantidad del carrito editable por teclado, tooltip en variantes sin stock, breadcrumbs en `ProductDetail`/`CategoryProducts`, trust signals en el footer, skeleton de página completa (reemplaza el spinner) y gap de skeleton corregido. Detalle completo de cada ítem en `.claude/TODO.md` (Completado, 2026-07-25).
- **Verificación:** `tsc --noEmit` limpio, 86/86 tests (mismo conteo). No verificado visualmente en navegador.
- **Nota:** se detectó que dos fixes previamente registrados como "completados el 2026-07-24" no estaban presentes en el código antes de esta pasada (ver detalle en `.claude/TODO.md`) — la rama `restore` no tiene commits desde el 2026-07-23, todo sigue sin commitear. Recomendado un commit de checkpoint pronto.

## 2026-07-25 — Política de Privacidad real + Términos y Condiciones + links en el footer

- **Archivos modificados:** `src/pages/PoliticaPrivacidad.tsx`, `src/pages/TerminosCondiciones.tsx` (nuevo), `src/App.tsx`, `src/components/layout/Footer.tsx`, `src/pages/Checkout.tsx`, `.claude/TODO.md`
- **Qué cambió:** `PoliticaPrivacidad.tsx` estaba redactada para Axiostock como SaaS (Supabase/Biller/CFE del proveedor) en vez de para Ruemia como tienda — se reescribió con el contenido real de una tienda online, ajustado a que Ruemia **no está registrada ante DGI** (identifica al responsable por nombre completo, no por razón social/RUT). Se creó `TerminosCondiciones.tsx` (no existía ninguna página de términos) con ruta `/legal/terminos`. El footer no linkeaba a ninguna página legal — se agregaron ambos links en la barra inferior, visibles en toda la tienda. El texto de aceptación del checkout ahora referencia ambos documentos.
- **Pendiente:** ambos archivos tienen placeholders `[COMPLETAR ...]` para datos reales que el usuario todavía no confirmó (nombre del titular, domicilio, email de contacto, política de cambios/envíos) — ver `.claude/TODO.md`.

## 2026-07-23 — Sacado el overlay blanco de "Sin stock" sobre la foto de producto

- **Archivos modificados:** `src/components/features/ProductCard.tsx`, `src/pages/ProductDetail.tsx`, `CLAUDE.md`
- **Qué cambió:** a pedido del usuario, se sacó el overlay `bg-white/70` + pill centrada "Sin stock" que tapaba la foto del producto (documentado hasta ahora como regla en `CLAUDE.md`) — el usuario lo describió como que "nublaba" la foto. Ahora la imagen se ve normal tanto en la grilla como en la ficha de producto; el único indicador de falta de stock es el badge rojo junto al precio en la grilla (agregado en la entrada anterior) y el texto "Este producto no tiene stock disponible." ya existente debajo del precio en la ficha. `CLAUDE.md` actualizado para reflejar la nueva convención.
- **Verificación:** `tsc --noEmit` limpio, 86/86 tests, y en navegador (Playwright) contra "Eleonora" (sin stock) en grilla y ficha — foto limpia en ambos casos.

## 2026-07-23 — Header más grande, logo recortado y badge "Sin stock" en la grilla

- **Archivos modificados:** `src/components/layout/PublicStoreHeader.tsx`, `src/components/features/ProductCard.tsx`
- **Archivo nuevo:** `src/brand/isotipo-cropped.png` (recorte del isotipo original, ver nota)
- **Qué cambió:**
  1. Header: texto de nav (`Inicio`/`Categorías`/`Nosotros`) de `text-sm` a `text-base`; alto de header de `h-16`/`h-14` a `h-20`/`h-16` (desktop/mobile); logo de `h-14`/`h-10` a `h-16`/`h-12`.
  2. **El logo seguía viéndose chico incluso agrandado** porque `isotipo-fondo1.png` (1083×1081px) tiene el glifo "R." ocupando solo ~23% del canvas — el resto es relleno de fondo. Se generó `isotipo-cropped.png` (recorte 400×400 centrado en el glifo, vía Pillow, bounding box calculado por diferencia de color contra el fondo) y se apuntaron ambos usos del logo (desktop/mobile) a ese archivo nuevo. El original queda intacto en `src/brand/` (no se borró — puede servir de master para futuros recortes).
  3. `ProductCard.tsx`: el badge de stock junto al precio solo se renderizaba cuando había stock ("En stock", verde) — sin stock quedaba un espacio en blanco. Ahora siempre se muestra el badge, alternando "En stock" (verde) / "Sin stock" (rojo).
- **Verificación:** `tsc --noEmit` limpio, 86/86 tests, y en navegador (Playwright): header en 1440px/390px, y card de un producto sin stock ("Eleonora") mostrando el badge rojo.

## 2026-07-23 — Hero outline CTA + altura responsive + fix de UX en filtros/búsqueda de /products

- **Archivos modificados:** `src/pages/PublicStore.tsx`, `src/pages/Products.tsx`
- **Dato modificado (producción, a pedido del usuario):** `organizations.settings.store_hero_show_cta` de `false` a `true` para Ruemia, vía `UPDATE` puntual con service role — no hay toggle en el panel admin para este campo.
- **Qué cambió:**
  1. El CTA "Ver productos" del hero pasó de botón sólido a `variant="outline"` (blanco sobre la foto de portada, color de marca si no hay foto) — pedido explícito del usuario. De paso, ya no duplica el cálculo de estilo que `Button.tsx` hace internamente (solo se pasa `style` cuando el valor es distinto al default, no siempre).
  2. Alturas del hero (`heroHeightClass`) retocadas: menos padding en mobile, bastante más en desktop — las fotos de portada son verticales y el hero ancho-y-bajo de desktop las recortaba de más que el angosto-y-alto de mobile.
  3. `/products`: el `useEffect` que vaciaba `allProducts`/`allStock`/`allVariants` en cada cambio de filtro causaba un flash de "Sin resultados" falso mientras el buscador esperaba el debounce + la respuesta real (porque `placeholderData` hace que `isLoading` ya sea `false` en ese momento). Se sacó el vaciado eager y se agregó un estado `isFiltering` (spinner en el ícono de búsqueda + grilla atenuada) para comunicar la carga sin ocultar los resultados anteriores. Además, elegir una categoría ahora limpia el término de búsqueda de texto (antes quedaba aplicado un filtro "fantasma").
- **Verificación:** `tsc --noEmit` limpio, 86/86 tests, y en navegador (Playwright): hero en 1440px/390px, y muestreo cada 60ms del estado de `/products` durante una búsqueda — sin flash de empty-state.

## 2026-07-22 — Revisión adversarial de seguridad (fresh context) del fix de organization_id

- **Archivos modificados:** `src/hooks/useProductVariants.ts`, `src/hooks/usePublicProducts.ts`, `src/lib/queryKeys.ts`, `src/pages/ProductDetail.tsx`, `src/components/features/VariantSelector.tsx`, `supabase/migrations/141_fix_product_categories_public_rls.sql` (nuevo)
- **Qué cambió:** un agente `review-risk` en contexto fresco auditó los cambios de `organization_id` del día y encontró 3 problemas:
  1. **Crítico, preexistente**: `useProductVariants` no filtraba `product_variants` por organización (esa tabla no tiene columna `organization_id` propia, y su RLS es pública para cualquier producto activo) — pidiendo la ficha de un producto de otra organización se filtraban sus variantes (precio, SKU, atributos) aunque la página mostrara "no encontrado". Corregido con `product:products!inner(organization_id)` + `.eq('product.organization_id', organizationId)`.
  2. **Alta, introducido hoy**: el nuevo `fetchCategoryProducts` armaba el filtro de búsqueda por concatenación sin sanitizar (a diferencia de su función hermana preexistente) — una coma podía inyectar condiciones extra en el `.or()` de PostgREST. Corregido reusando el sanitizado ya existente.
  3. **Media, funcional**: RLS de `product_categories` sin policy pública de SELECT — productos vinculados solo vía esa tabla de junction no aparecían para usuarios anónimos. Migración nueva creada, **pendiente de aplicación manual por el usuario**.
- **Verificación:** `tsc --noEmit` limpio, 86/86 tests, regresión completa en navegador (Playwright) sobre las 4 páginas del storefront.

## 2026-07-22 — Fixes de seguimiento: organization_id, SEO de Products.tsx, duplicado de Helmet

- **Archivos modificados:** `src/hooks/usePublicProducts.ts`, `src/pages/Products.tsx`, `src/components/layout/PublicStoreLayout.tsx`, `index.html`
- **Qué cambió:**
  1. `fetchStoreProduct` (usada por `ProductDetail.tsx`, agregada en la entrada anterior) no filtraba por `organization_id` ni en el producto principal ni en los relacionados — se agregó `.eq('organization_id', organizationId)` a ambas queries.
  2. SEO en `Products.tsx`: `<Helmet>` con title/description estáticos + canonical `/products` (esta página no depende de datos async para su meta, a diferencia de producto/categoría).
  3. **Bug encontrado al verificar visualmente el SEO de las 2 entradas anteriores**: `react-helmet-async` solo puede agregar tags vía JS, no eliminar los que ya estaban hardcodeados en `index.html` — el resultado eran 2 `<meta name="description">` (y og:title/og:description/canonical/og:image) compitiendo en el DOM. Se agregó un `<Helmet>` base con los defaults del sitio en `PublicStoreLayout.tsx` (cubre Home y cualquier página sin `<Helmet>` propio) y se sacaron de `index.html` los tags que ahora son 100% dinámicos: `description`, `og:title`, `og:description`, `og:image`, `canonical`. `<title>` se dejó estático a propósito — Helmet lo pisa con `document.title =` (asignación directa, no duplica), así que sigue sirviendo de fallback real para el instante antes de que cargue el JS.
- **Limitación conocida, documentada en `.claude/TODO.md`:** el SEO dinámico vía Helmet no mejora el preview de WhatsApp/Twitter/Facebook al compartir un link — esos crawlers no ejecutan JS y solo ven el HTML estático. Requeriría SSR/prerendering, fuera del alcance de este fix (decisión de arquitectura pendiente, confirmada con el usuario).
- **Verificación:** `tsc --noEmit` limpio, 86/86 tests, y en navegador (Playwright): 1 sola instancia de cada meta tag en home/`/products`/categoría/PDP con el valor correcto en cada caso (`og:image` del PDP muestra la foto real del producto). También se simuló una falla de red real en "agregar al carrito" desde `ProductDetail.tsx` — el toast de error aparece y el botón se resetea en vez de quedar trabado.

## 2026-07-22 — ProductDetail.tsx: TanStack Query, fix de carrito trabado y SEO por producto

- **Archivos modificados:** `src/pages/ProductDetail.tsx`, `src/hooks/usePublicProducts.ts`
- **Qué cambió:**
  1. `fetchProduct` (fetch manual con `supabase.from(...)` + `useState`/`useEffect`) reemplazado por un hook `useStoreProduct(organizationId, productId)` en `usePublicProducts.ts` (patrón TanStack Query igual al resto del archivo, `queryKeys.store.product` que ya existía sin uso). Mismo query shape exacto (producto + `category` + `product_images`, más productos relacionados por `category_id`) — refactor mecánico, no cambia qué se trae ni cómo se renderiza.
  2. `handleAddToCart` — el fallo intermitente `TypeError: Failed to fetch` dejaba el botón trabado en "Cargando..." sin toast. El `finally` ya reseteaba `isAdding`, pero el `catch` no mostraba error; se agregó `show('No se pudo agregar el producto al carrito', 'error')`.
  3. Meta tags por producto vía `react-helmet-async` (`<Helmet>` no tenía ningún uso real en el proyecto pese a estar instalado): `title`, `description`, `og:title`, `og:description`, `og:image`, `canonical` una vez cargado el producto; `noindex` en el estado "Producto no encontrado". Descripción truncada a 155 caracteres con saltos de línea colapsados a espacio; fallback a la descripción/imagen default de `index.html` cuando el producto no tiene descripción o imagen.
- **Nota:** la query de producto no filtraba por `organization_id` (comportamiento pre-existente) — corregido en la entrada siguiente, ya no es un pendiente.

## 2026-07-22 — CategoryProducts.tsx: TanStack Query, fix de aislamiento multi-tenant y SEO por categoría

- **Archivos modificados:** `src/pages/CategoryProducts.tsx`, `src/hooks/usePublicProducts.ts`
- **Qué cambió:** las llamadas directas a `supabase.from(...)` dentro de `useState`/`useEffect` se reemplazaron por el nuevo hook `useCategoryProducts` (TanStack Query), siguiendo el mismo patrón de `useFilteredProducts`/`Products.tsx` (paginación "Cargar más" con acumulación en estado local + `placeholderData` para evitar parpadeo). La resolución de categoría/categoría padre/subcategorías a partir del slug de la URL se derivó de `usePublicCategories(orgId)` (que ya filtra por `organization_id` y ya está cacheado) en vez de 2 queries adicionales sin ese filtro — elimina el hallazgo de la auditoría por construcción en vez de parchearlo. La query restante a `product_categories` (junction table) ganó `.eq('organization_id', organizationId)` explícito, y el filtro de organización en la query de productos pasó de condicional a incondicional, garantizado por `enabled: !!organizationId` en el hook. Se agregó SEO dinámico por categoría con `react-helmet-async` (`title`, `description`, `og:title`, `og:description`, `canonical`) — junto con la entrada anterior, primer uso real de `<Helmet>` en el repo (ya estaba instalado y wireado en `main.tsx` pero sin consumir).
- **Verificación:** `tsc --noEmit` limpio, `eslint` limpio, 86/86 tests (`npx vitest run`).

## 2026-07-22 — Descripción de producto con `\n` literal y labels de variante en inglés

- **Archivos modificados:** `src/lib/utils.ts`, `src/lib/utils.test.ts`, `src/pages/ProductDetail.tsx`, `src/components/features/VariantSelector.tsx`
- **Qué cambió:** auditoría de la tienda pública (skill `ecommerce-analyzer`) detectó `\n\n` literal mostrándose en pantalla en la descripción de producto. Se confirmó por lectura directa de `products.description` (read-only vía REST) que es sistémico — 18 de 49 productos con descripción tienen el string `\n`/`\r\n` cargado como texto en vez de un salto de línea real, no un caso aislado. Se agregó `normalizeLineBreaks()` (nueva, 7 tests) + `whitespace-pre-line` en el párrafo de descripción, en vez de editar 18 filas a mano — cubre también cargas futuras con el mismo error. También se encontró que el selector de variante mostraba "Size" en vez de "Talle": la clave del atributo es dato cargado inconsistente en `product_variants.attributes` (`Size`/`Color`/`talle`/`color`, más claves rotas como `cristal`/`1 kilo` que no se tocan), no texto hardcodeado. Con aprobación del usuario, se agregó `translateAttributeLabel()` (nueva, 7 tests) — mapa de traducción solo-display para claves reconocidas, sin escribir en la DB.
- **Verificación:** `tsc --noEmit` limpio, 30/30 tests, y en navegador (Playwright) contra productos reales ("Eleonora" para la descripción, "Zuecos" para el label de talle).

---

## 2026-07-20 — Tipografías de marca según manual: Berlin, Cambria y Arial

- **Archivos modificados:** `src/index.css`, `src/pages/ProductDetail.tsx`, `public/berlin.regular.ttf` (nuevo, provisto por el usuario), `public/Cambria.ttf` (nuevo, provisto por el usuario)
- **Qué cambió:** se reemplazó Bodoni Moda (Google Fonts, no estaba en el manual de marca) por **Berlin** como fuente de headings/logotipo, vía `@font-face` self-hosteado desde `public/berlin.regular.ttf` — Berlin Sans FB (la fuente comercial homónima de Font Bureau) no está disponible en Google Fonts ni tiene licencia libre, por lo que se usó el archivo TTF que aportó el usuario en lugar de bajarlo de sitios de dudosa licencia. **Cambria** también se self-hosteó desde `public/Cambria.ttf` — dependía de que el sistema operativo la tuviera instalada (viene con MS Office/Windows), así que en la mayoría de navegadores caía al fallback Georgia; ahora carga siempre. Ambos `@font-face` usan `font-weight: 100 900` (declaran cubrir todo el rango aunque el archivo sea una sola variante) para que las clases `font-bold`/`font-semibold` de Tailwind no disparen el bold sintético del navegador — eso era la causa de que el texto en Berlin se viera con las letras muy pegadas/solapadas. Cambria Italic no requiere setup adicional (`font-style: italic` sobre el mismo stack, sin archivo dedicado). Se agregó el token `--org-font-technical: Arial, Helvetica, sans-serif` y se aplicó al único dato técnico identificado en la tienda pública (SKU en `ProductDetail.tsx`).
- **Pendiente del usuario:** si aparecen otros campos de "información técnica" (medidas, materiales, etc.) más adelante, aplicarles `var(--org-font-technical)` siguiendo el mismo patrón. Si más adelante se necesita Cambria Italic real (no oblicua sintética), habría que sumar el archivo de esa variante.
- **Ajuste posterior:** el fix del bold sintético no alcanzó — el TTF de Berlin trae side-bearings/kerning nativamente muy cerrados. Se agregó `letterSpacing` junto a cada uso de `--org-font-heading` (12 lugares: `Products.tsx`, `CategoryProducts.tsx`, `ProductDetail.tsx`, `CategoryCard.tsx`, `Footer.tsx` x3, `PublicStore.tsx` x5) para abrir el tracking sin tocar el archivo de fuente — subido de `0.03em` a `0.05em` a pedido del usuario. Se verificó además que navbar y footer sí están tomando Cambria correctamente (`getComputedStyle` confirmó `Cambria, Georgia, "Times New Roman", serif` con status `loaded` en los links de nav y en el texto del footer que no usa `--org-font-heading`) — no había ningún bug ahí, era una duda a confirmar.
- **Cambio de cuerpo de texto — Cambria → Fraunces → Lora (dos iteraciones, se sale del manual de marca):** el usuario reportó que Cambria no combinaba con Berlin. Primera iteración: se probaron en vivo (inyectando fuentes por JS sobre el sitio real, sin tocar código) Fraunces, Lora y Source Serif 4; el usuario eligió Fraunces por su calidez. Al revisar la elección, se verificó contra la teoría de pairing tipográfico real (fuentes con mucho carácter necesitan un partner calmo/neutro, no otro con carácter — Fraunces se recomienda universalmente junto a sans neutras como Inter/Manrope/Outfit, nunca junto a otra fuente "loud"). Berlin es una sans con mucho carácter propio, así que Fraunces + Berlin eran dos fuentes compitiendo — la recomendación original estuvo mal. Corregido con **Lora** (serif calmo y neutro) como partner de Berlin. `--org-font-family` y el `font-family` del `body` en `src/index.css` quedaron en `'Lora', 'Cambria', Georgia, 'Times New Roman', serif` (Lora via Google Fonts, licencia libre). Cambria se mantiene como fallback secundario, ya self-hosteada.

## 2026-07-20 — Navbar unificado a marrón sólido + isotipo en desktop

- **Archivos modificados:** `src/components/layout/PublicStoreHeader.tsx`, `src/components/layout/ShippingNoticeBanner.tsx`
- **Qué cambió:** el header dejó de usar el wordmark completo en desktop — ahora usa el mismo isotipo "R." que mobile, agrandado (`h-14 w-14`) para mantener jerarquía visual. El header pasó de un marrón semitransparente con blur (`${primaryColor}ee` + `backdrop-filter`) a un marrón sólido plano (`#46362B`), sin borde. El banner de aviso de envío (`ShippingNoticeBanner`) pasó a un marrón más claro fijo (`#6b5544`) en vez de heredar el mismo `--org-primary-color` que el navbar, para diferenciarlos visualmente.

## 2026-07-20 — Redes sociales en el footer (configurables por env)

- **Archivos modificados:** `src/vite-env.d.ts`, `src/components/layout/Footer.tsx`
- **Qué cambió:** se agregaron los íconos de Instagram, Facebook y WhatsApp a la columna 3 del footer (antes un placeholder vacío), leyendo las URLs/número desde las nuevas variables de entorno `VITE_SOCIAL_INSTAGRAM` / `VITE_SOCIAL_FACEBOOK` (URL completa del perfil/página) y `VITE_SOCIAL_WHATSAPP` (número de teléfono, mismo formato que `organization.settings.store_whatsapp_number`, se arma el link `wa.me` en código). Si una variable viene vacía, ese ícono no se renderiza; si ninguna está configurada, la columna vuelve al placeholder oculto original.
- **Pendiente del usuario:** cargar los valores reales de `VITE_SOCIAL_INSTAGRAM` / `VITE_SOCIAL_FACEBOOK` / `VITE_SOCIAL_WHATSAPP` en el entorno de build/hosting (ej. Vercel) — no se inventaron URLs ni números, quedan vacíos hasta que se configuren.

## 2026-07-20 — Aviso de demora de entrega, scroll a confirmación de orden, orden y badge de stock

- **Archivos modificados:** `src/components/layout/ShippingNoticeBanner.tsx` (nuevo), `src/components/layout/PublicStoreLayout.tsx`, `src/pages/Checkout.tsx`, `src/pages/OrderConfirmation.tsx`, `src/lib/stock.ts`, `src/pages/Products.tsx`, `src/pages/CategoryProducts.tsx`, `src/components/features/ProductCard.tsx`
- **Qué cambió:** se agregó un banner fijo arriba de toda la tienda (`ShippingNoticeBanner`, montado en `PublicStoreLayout`) avisando la demora de entrega de 3 a 5 días hábiles, con el mismo aviso repetido explícitamente en el checkout. En `OrderConfirmation` se agregó scroll automático al tope de la página al entrar, para que el ícono de éxito/fallido del pago siempre sea visible sin depender del scroll heredado de la página anterior. En `Products.tsx` y `CategoryProducts.tsx` se agregó `sortByStockFirst` (`src/lib/stock.ts`) para que los productos con stock aparezcan siempre antes que los sin stock dentro de cada tanda cargada (decisión del usuario: reordenar por tanda, no globalmente, para no hacer más lento el catálogo grande). En `ProductCard.tsx` se agregó el overlay "Sin stock" (`bg-white/70` + pill `bg-gray-800/90`) sobre la imagen para productos sin stock, siguiendo la convención ya documentada en `CLAUDE.md`; el overlay usa `pointer-events-none` para no bloquear el click al detalle del producto (el usuario puede seguir viéndolo).
- **Nota de alcance:** la sección "Productos destacados" del home (`PublicStore.tsx`) no recibió el mismo reordenamiento — no fetchea stock para esos productos y se decidió no tocarla por no ser una vista de catálogo/filtrado.

## 2026-07-19 — Rebrand real de Ruemia: paleta, tipografía, logo y metadata hardcodeados

- **Contexto:** con el panel admin ya eliminado (ver entrada anterior), la organización real (`slug: ruemia`) tenía todos los campos de branding (`primary_color`, `secondary_color`, `logo_url`, `font_family`) en `NULL` en la base — la tienda en vivo renderizaba con el fallback genérico `#6366f1` (indigo) en vez de la marca real. Se decidió hardcodear la marca en código en vez de depender de la DB, ya que este fork es de un solo cliente para siempre.
- **Paleta real** (extraída del brand board del cliente): `#46362B` (ink/marrón oscuro, primario), `#A78B6C` (camel, secundario), `#B29E88` (taupe, muted), `#EAE2D6` (cream, texto sobre fondo oscuro / bg claro).
- **Tipografía:** body → `Cambria` (system serif, tal cual nombrada en el brand board); headings/wordmark → `Bodoni Moda` (Google Fonts, serif de alto contraste equivalente al look del logo — no se tienen los archivos reales de la fuente del board, sustituto verificado como opción abierta).
- **Theming dinámico → estático:** `src/lib/colorContrast.ts` (+ test) eliminado; `PublicStoreLayout.tsx` sin el `useEffect` que inyectaba `--org-*-color` desde `organization.*`; tokens fijos ahora en `src/index.css` `:root`. Fallbacks `#6366f1`/`#8b5cf6`/`#ec4899` corregidos a los hex reales en 15 archivos (`Products.tsx`, `ProductDetail.tsx`, `VariantSelector.tsx`, `Checkout.tsx`, `PublicStore.tsx`, `ProductCard.tsx`, `OrderConfirmation.tsx`, `CategoryProducts.tsx`, `CategoryCard.tsx`, `Cart.tsx`, `Button.tsx`, `PublicStoreHeader.tsx`, `Footer.tsx`, `PublicStoreWrapper.tsx`, `PublicStoreLayout.tsx`).
- **Logo real:** `PublicStoreHeader.tsx`/`Footer.tsx` importan directamente `src/brand/logo-principal-fondo1.png`/`isotipo-fondo1.png` en vez de leer `organization.logo_url`. Generados también `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `og-image.png` a partir de esos assets (vía `sips`).
- **`tailwind.config.js`:** escala `primary` reemplazada (derivada en OKLCH de `#46362B`, mismo método documentado que ya se usaba para la escala `admin`); escalas `admin`/`accent` (Axiostock SaaS) eliminadas — cero uso confirmado; tokens `brand.*` agregados; `fontFamily.sans` → Cambria, nuevo `fontFamily.heading` → Bodoni Moda.
- **`index.html` reescrito completo:** metadata (`title`/`description`/`keywords`/OG/Twitter) de "Axios - Panel de Administración" a Ruemia (mates artesanales), favicon/apple-touch-icon/OG image apuntando a los assets nuevos, JSON-LD `SoftwareApplication` (incorrecto para un storefront) reemplazado por `Organization`, `theme-color` a `#46362B`. Eliminados los `msapplication-task` que apuntaban a `/admin`/`/store` (rutas ya no existen), y eliminados los scripts de Microsoft Clarity y Meta Pixel (confirmado: pertenecían a Axiostock, no al cliente).
- **`public/manifest.webmanifest` y `sw.js`:** nombre/descripción/colores a Ruemia, íconos a los nuevos assets, `shortcuts` (`/admin`, `/store`) y `share_target` (`/share`, ruta inexistente) eliminados por completo.
- **Limpieza de código muerto asociada:** `Tabs.tsx`, `Dropdown.tsx`, `ProductListItem.tsx`, `ActionsMenu.tsx` eliminados (cero import sites, dependían de la rama `admin-theme` ya inalcanzable); `Button.tsx` sin la rama muerta `isAdminContext`.
- **~32.6 MB liberados en `public/`:** 19 assets huérfanos de las landings de marketing de Axiostock ya eliminadas (`banner1.png`, `inventoryLanding.mp4`, `comparativaDolor.png`, capturas de pantalla del admin, íconos `undraw*`, etc.), más `logo1.png`/`logo2.png`/`logo3.png`/`logo4.png`/`logo.svg` (sin referencias en código, solo en `PWA_SETUP.md`, doc desactualizada).
- **`supabase/functions/send-notification/email-templates.ts`:** logo de emails transaccionales actualizado a `/og-image.png` — requiere `supabase functions deploy` manual del usuario para tomar efecto en producción, no se despliega solo.
- **Decisión de footer:** "Powered by Axiostock" → "Powered by Ciceridev" (mismo link a `ciceridev.vercel.app` que ya existía) — "Axiostock" no puede aparecer en texto de cara al cliente; confirmado con el usuario mantener la atribución en vez de sacarla.
- **Contraste WCAG:** `--org-secondary-ink`/`--org-accent-ink` (texto oscuro sobre camel/taupe) no llegan al AA estricto (3.6–4.47:1 vs 4.5:1) — es la mejor opción disponible dentro de la paleta real de marca (la alternativa clara da peor contraste, 2.0–2.5:1). Confirmado con el usuario dejarlo así — son acentos puntuales, no texto de párrafo.
- **Pendiente (no bloqueante, ver `.claude/TODO.md`):** texto real de política de privacidad de Ruemia (`PoliticaPrivacidad.tsx` sigue con el mailto del developer); `organizations.settings.store_whatsapp_number` sigue en `NULL` (número real ya confirmado: `092 391 232`, falta el `UPDATE` en Supabase — sin autorización explícita todavía).
- **Verificación:** `npm run type-check`, `npm run build` y `npm test` (72 tests) pasan limpio.

## 2026-07-18 — Fork de un único cliente: elimina admin y POS, tienda pública single-tenant

- **Archivos eliminados:** todo `src/pages/admin/**` (29), `src/components/admin/**` (32), `src/components/filters/**` (7), `src/pages/pos/**`, `src/components/pos/**`; `AdminLayout.tsx`, `Sidebar.tsx`, `Header.tsx`, `POSLayout.tsx`, `ShopLayout.tsx` (orphan roto tras borrar `Header.tsx`); `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `Register.tsx` (orphan), `Home.tsx` (orphan), `Landing.tsx`, `LandingFacturacion.tsx`, `TerminosCondiciones.tsx` (sin referencias en la tienda); `OrgAccessGate.tsx`, `PermissionGate.tsx`, `PlanGate.tsx`, `ProtectedRoute.tsx` (orphan); `adminStore.ts`; hooks admin/RBAC/PWA (`useAdminBranches`, `useBillerConfig` — sin uso en Checkout, `useInstallPrompt`, `useLots`, `useLowStockProducts`, `useMoneyMetrics`, `useNotifications`, `useOperationalMetrics`, `useOrgAccess`, `useOrgFeature`, `useOrganization`, `usePermission`, `usePlanLimits`, `useProductDetail`, `useProductVariantGrid`, `useTrendsMetrics`, `useUserManagement`, `usePOSCart`); lib admin/POS (`audit.ts`, `barcode.ts`, `chartColors.ts`, `duplicateSku.ts`, `notification-types.ts`, `orgAccess.ts`, `organization.ts` (orphan), `paymentMethodConfig.ts`, `planLimits.ts`, `productDetailHelpers.ts` (orphan), `schemas.ts`, `statusColors.ts`, `storage.ts`, `uruguay-validators.ts`, `variantGrid.ts`, `posService.ts`, y `permissions.ts` una vez que `organizationStore` dejó de necesitarlo) con sus `*.test.ts`.
- **Archivos modificados:** `src/App.tsx` (rutas sin prefijo `:slug`, monta en `/`, solo tienda pública + `/legal/privacidad`), `src/components/layout/PublicStoreWrapper.tsx` (resuelve la organización desde `VITE_STORE_SLUG` en vez de `useParams`), `PublicStoreLayout.tsx`, `PublicStoreHeader.tsx`, `Footer.tsx` (quitan el prefijo `/${slug}` de todos los `Link`/`navigate`, ya no reciben `slug` como prop de routing), `ProductCard.tsx`/`CategoryCard.tsx` (quitan prop `basePath`, ahora usan rutas fijas), `Products.tsx`, `PublicStore.tsx`, `CategoryProducts.tsx`, `ProductDetail.tsx`, `Cart.tsx`, `Checkout.tsx` (incluye fix: el navigate a orden confirmada apuntaba a `/orders/:id`, ruta admin ya eliminada, ahora usa `/order-confirmation/:orderId`), `OrderConfirmation.tsx`; `src/store/organizationStore.ts` (simplificado a `currentOrganization` + `fetchOrgBySlug`, sin membership/RBAC ni `persist`), `src/store/authStore.ts` (quita `isAdmin`/`canAccessAdminPanel` y la llamada a `fetchOrganizations`), `src/hooks/useCurrentOrganization.ts` (envuelve `usePublicStore` directo, sin fallback admin), `src/lib/queryKeys.ts` (solo quedan `store` y `config.paymentMethods`), `src/types/index.ts` (quita `OrgRoleResolved` y el import de `Permission`), `package.json` (quita `recharts`, `qrcode`, `@types/qrcode`, `jsbarcode`, `react-google-recaptcha-v3` — sin imports reales tras la poda).
- **Archivo modificado:** `env.example` con `VITE_STORE_SLUG` documentado (reemplaza el `:slug` de la URL); `src/hooks/usePageViewTracker.ts` (dejó de hacer `pathname.replace('/'+slug, '')`, un residuo del prefijo de URL eliminado que podía corromper `page_path` si el slug coincidía con un segmento de ruta real).
- **Qué cambió:** este fork sirve una única tienda para un solo cliente — se elimina el panel admin y el POS interno completos; la organización de la tienda pública se resuelve una sola vez desde la env var `VITE_STORE_SLUG` en vez de la URL. `npm run type-check`, `npm run build` y `npm test` (84 tests) pasan limpio tras la poda.
- **Nota:** `VITE_STORE_SLUG=ruemia` ya cargado en el `.env` local de desarrollo.

## 2026-07-16 — Fix: stock duplicado por sucursal al crear un producto

- **Archivo nuevo:** `supabase/migrations/140_fix_create_inventory_for_product_stock.sql`
- **Qué cambió:** El trigger `create_inventory_for_product` (redefinido en la migración 101) insertaba `NEW.stock` en la fila de `branch_inventory` de **cada** sucursal activa de la organización, en vez de `0` como hacen sus funciones hermanas (`create_inventory_for_variant`, `handle_product_activation`, `handle_variant_activation`). Al crear un producto con stock inicial, esto disparaba además `sync_product_stock_from_inventory` (migración 099), que recalcula `products.stock` como la suma de `branch_inventory` — resultando en `stock inicial × cantidad de sucursales activas`. El código de `AdminProducts.tsx` (y `ProductImportModal.tsx`, que ya documentaba el supuesto correcto) solo carga el stock inicial en la sucursal seleccionada; con el trigger corregido a `0`, ese código ya funciona bien sin cambios adicionales.
- **Nota:** la migración solo corrige el trigger para altas nuevas. Los productos ya creados con sucursales múltiples pueden tener `branch_inventory`/`products.stock` con el valor duplicado — requiere una corrección de datos aparte si aplica, que no se hizo automáticamente por tratarse de inventario real.

## 2026-07-16 — Duplicar producto + grilla editable de variantes (carga masiva de catálogo)

- **Archivos modificados:** `src/pages/admin/AdminProducts.tsx`, `src/components/admin/ProductTable.tsx`, `src/components/admin/VariantManager.tsx`, `src/lib/storage.ts`
- **Archivos nuevos:** `src/lib/duplicateSku.ts` (+ test), `src/lib/variantGrid.ts` (+ test), `src/hooks/useProductVariantGrid.ts`, `src/components/admin/VariantGrid.tsx`
- **Archivo eliminado:** `src/components/admin/VariantForm.tsx`
- **Qué cambió:** Carga de catálogo uno-a-uno reemplazada en dos frentes, a pedido del usuario (cargar productos/variantes en un modal por vez es más lento que Excel).
  1. **Duplicar producto**: nueva acción "Duplicar" por fila en `ProductTable` (grid y lista). Abre el modal de creación pre-cargado con los datos del producto original (nombre con sufijo " (copia)", precio, categorías, imágenes, variantes) — no inserta nada hasta que el usuario confirma. SKU sugerido vía `generateDuplicateSku` (sufijo `-copia`, `-copia-2`... evitando colisión), porque el SKU es único por organización y nunca se puede copiar tal cual. Las imágenes del duplicado apuntan a la **misma `image_url`** del original (no se re-sube el archivo) — decisión explícita del usuario para no duplicar espacio de Storage. Por eso se agregó `deleteProductImageIfUnused` en `storage.ts`: antes de borrar un archivo físico al reemplazar/quitar una imagen de producto, chequea si otro `product_images` (de cualquier producto) todavía referencia esa URL; si sí, solo borra la fila de la DB y deja el archivo intacto. `branch_inventory` no se copia — el trigger de DB ya crea stock en 0 por sucursal al insertar.
  2. **Grilla editable de variantes**: `VariantManager` ya no abre un formulario modal por variante (`VariantForm`, eliminado) — ahora renderiza `VariantGrid`, una tabla con todas las variantes editables inline (SKU, nombre, atributos, precio, stock, unidad, umbrales, activo) y un solo botón "Guardar cambios" que hace un batch (`insert` de filas nuevas + `update` de las modificadas) contra `product_variants`, en vez de un save por fila.
- **Imagen por variante restaurada en la grilla:** la primera versión de `VariantGrid` había salido sin columna de imagen (regresión respecto de `VariantForm`, que sí permitía una foto por variante). Se agregó de vuelta: thumbnail + selector de archivo + "Quitar" por fila. El archivo se sube a Storage recién al presionar "Guardar cambios" (no en cada selección, para no dejar archivos huérfanos si el usuario nunca guarda), y si se reemplaza o quita una imagen existente, el archivo viejo se borra del Storage solo después de confirmar el guardado exitoso en la base.
- **Batch sin transacción real:** el guardado de variantes hace el `insert` en una sola llamada (atómico) pero los `update` van en paralelo, cada uno independiente — no hay RPC. Documentado como candidato a Edge Function si falla seguido en producción (regla del proyecto sobre operaciones con múltiples writes en cascada).
- **Incidente durante la implementación:** dos agentes delegados se colgaron a mitad de camino (timeout de 600s del watchdog) trabajando sobre `AdminProducts.tsx`; el trabajo parcial y correcto que dejaron (`duplicateSku.ts`, `deleteProductImageIfUnused`) se conservó y se completó el cableado manualmente en vez de descartarlo.

## 2026-07-14 — Botón "Consultar disponibilidad" por WhatsApp en productos sin stock

- **Archivos modificados:** `src/pages/ProductDetail.tsx`, `src/hooks/useOrgSettings.ts`, `src/components/admin/EditOrganizationModal.tsx`, `src/types/database.types.ts`
- **Qué cambió:** Los productos sin stock ya se podían abrir en la tienda (`ProductCard` nunca bloqueó la navegación, el overlay "Sin stock" es solo visual). Lo nuevo es en `ProductDetail.tsx`: cuando el producto (o la variante seleccionada) no tiene stock, se oculta el selector de cantidad y el botón "Agregar al carrito" se reemplaza por "Consultar disponibilidad", que abre WhatsApp (`wa.me`) con un mensaje prellenado que incluye el nombre del producto y el link a la ficha. El número de WhatsApp es configurable por organización — nuevo campo `store_whatsapp_number` en `organizations.settings` (jsonb, sin migración), editable desde `/organizations` → pestaña "Vitrina" → sección "Contacto". Si la organización no configuró el número, se mantiene el comportamiento anterior (botón "Agregar al carrito" deshabilitado) en vez de mostrar un botón que no lleva a ningún lado.
## 2026-07-14 — Bug de precio en tienda pública + contraste dinámico de marca + limpieza estética del storefront

- **Archivos modificados:** `src/pages/ProductDetail.tsx`, `src/components/features/VariantSelector.tsx`, `src/lib/colorContrast.ts` (nuevo), `src/lib/colorContrast.test.ts` (nuevo), `src/components/layout/PublicStoreLayout.tsx`, `src/components/layout/PublicStoreHeader.tsx`, `src/components/layout/Footer.tsx`, `src/components/ui/Button.tsx`, `src/components/features/ProductCard.tsx`, `src/pages/Products.tsx`, `src/pages/CategoryProducts.tsx`, `src/pages/PublicStore.tsx`, `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`, `tailwind.config.js`, `.claude/TODO.md`
- **Qué cambió:** Corrige un bug de precio real (no cosmético): `ProductDetail.tsx` y `VariantSelector.tsx` mostraban el precio sin descuento de una variante cuando esta no tenía precio propio, en vez de `getEffectivePrice(product)`. Agrega `src/lib/colorContrast.ts` (WCAG, testeado) y lo conecta en `PublicStoreLayout.tsx`, que ahora inyecta `--org-primary-ink`/`--org-secondary-ink`/`--org-accent-ink` junto a los colores de marca existentes, resolviendo que una organización con color de marca claro/pastel tuviera texto blanco invisible en sus botones y CTAs — wireado en `Button`, `ProductCard`, `Products`, `CategoryProducts`, `PublicStore`, `Footer` y el header completo (~30 ocurrencias de texto blanco fijo). Migra `Checkout.tsx`, `Cart.tsx` y `VariantSelector.tsx` de la escala estática `primary-*` (azul) al color dinámico de marca. Fixes menores: `<h1>` faltante en `Products.tsx`, overlay "Sin stock" agregado a `ProductDetail.tsx` (ya existía en `ProductCard.tsx`), `aria-label` en botones de cantidad/eliminar del carrito, ancho de inputs de precio unificado, mismatch de breakpoint en el skeleton del home, escala Tailwind `warm-*` muerta eliminada.
- **Revisión adversarial post-cambio:** encontró que la primera pasada había dejado `PublicStoreHeader.tsx` (la superficie más visible de toda la tienda) sin el fix de contraste, por un error de alcance propio al asumir que el efecto "frosted glass" quedaba exento — el fondo semitransparente del header ES el color de marca, así que sí necesitaba el mismo tratamiento. Corregido. También encontró y corrigió un spinner de `VariantSelector.tsx` que había quedado en azul estático.
- **Sin verificación visual en navegador**: la extensión de Chrome no estaba disponible y no había credenciales/slug de organización de prueba para levantar Playwright con datos reales. La verificación fue por lectura de código, sintaxis de clases Tailwind arbitrarias, y consistencia con patrones ya probados en producción en este mismo código (ej. `color-mix()` inline ya usado en `ProductDetail.tsx` antes de este cambio). Recomendado hacer una pasada visual manual con una organización real.
- **Fuera de alcance, a propósito:** deduplicación de la barra de filtros entre `Products.tsx`/`CategoryProducts.tsx` reusando `src/components/filters/*`, `PAGE_SIZE` de `CategoryProducts.tsx` no centralizado, stepper de progreso en checkout — quedan en `.claude/TODO.md` por no ser cambios estéticos.

## 2026-07-14 — Rebrand de color admin + cierre de la limpieza estética del panel (Órdenes/Ventas/Transferencias + resto de páginas)

- **Archivos modificados:** `tailwind.config.js`, `src/components/admin/EditOrganizationModal.tsx`, `src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminOrderDetail.tsx`, `src/components/admin/CashSessionPayments.tsx`, `src/pages/admin/AdminTransfers.tsx`, `src/pages/admin/AdminSales.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminBillerComprobantes.tsx`, `src/pages/admin/AdminExpenses.tsx`, `src/pages/admin/AdminUsers.tsx`, `src/pages/admin/AdminOrganizations.tsx`, `src/pages/admin/AdminPlans.tsx`, `src/pages/admin/AdminLots.tsx`, `src/pages/admin/AdminSuppliers.tsx`, `src/pages/admin/AdminBranches.tsx`, `src/pages/admin/AdminCategories.tsx`, `src/pages/admin/AdminCashRegister.tsx`, `src/pages/admin/AdminReposicion.tsx` (fix post-revisión), `CLAUDE.md`, `.claude/TODO.md`
- **Qué cambió:** Cierra la auditoría UX/diseño del panel admin iniciada el mismo día. `tailwind.config.js`: la escala `admin-*` (antes azul genérico idéntico al `blue` de Tailwind) se rehízo en OKLCH a partir del navy real de marca (`#1c1d33`), con contraste vs. blanco verificado matemáticamente (600→5.53:1, 700→8.50:1, 800→12.76:1); se agregó una escala `accent` (del rojo de marca `#fd2525`) reservada para uso puntual, nunca para botones/focus-rings generales ni para nada con semántica de error. Se corrigieron 7 usos de `focus:ring-primary-500` (escala equivocada) a `focus:ring-admin-500` en `EditOrganizationModal.tsx`. Se migraron a `src/lib/statusColors.ts` los 5 archivos que reimplementaban el mapa de color de estado de pedido/transferencia (`AdminOrders`, `AdminOrderDetail`, `AdminCustomerDetail`, `CashSessionPayments`, `AdminTransfers`), eliminando esos mapas locales. Se corrigieron 3 barras de filtro envueltas en `<Card>` (`AdminSales`, `AdminBillerComprobantes`, `AdminExpenses`) a la barra inline siempre visible que manda `CLAUDE.md`. Se reemplazaron 19 `alert()` nativos por `useToastStore` en 6 páginas (violaban la regla explícita del proyecto). Se normalizó el tamaño de `<h1>` de página a `text-2xl sm:text-3xl font-bold` en 7 páginas que usaban tamaños distintos para el mismo rol. Se agregaron `aria-label` faltantes en botones de limpiar-búsqueda, y se estandarizó el wording de exportación a "Exportar CSV" donde correspondía.
- **Revisión adversarial post-cambio:** se corrió una revisión en contexto fresco sobre el diff completo (no confiar en el reporte de los propios agentes que hicieron los cambios). Encontró y se corrigió una regresión real: la migración de `AdminReposicion.tsx` a `statusColors.ts` forzaba `isLowStock: true`, lo que pintaba de amarillo (antes siempre rojo) el stock de filas con stock > 0 — esa página lista específicamente ítems que necesitan reposición urgente, así que el número debía seguir siendo rojo fijo. Revertido; se mantiene la migración de `dias_stock` (esa sí era una mejora real).
- **Fuera de alcance, a propósito:** ítems no-estéticos de la misma auditoría (modales de confirmación de borrado vs. `confirm()` nativo, `PAGE_SIZE_ADMIN` no centralizado en todas las páginas, gating de rutas por URL directa, breadcrumbs desactualizados) quedan documentados en `.claude/TODO.md` para una tarea aparte.

## 2026-07-14 — Fixes visuales/consistencia en Productos, Inventario, Reposición y Estadísticas de tienda

- **Archivos modificados:** `src/pages/admin/AdminProducts.tsx`, `src/pages/admin/AdminInventory.tsx`, `src/pages/admin/AdminReposicion.tsx`, `src/pages/admin/AdminStoreStats.tsx`, `src/lib/chartColors.ts` (nuevo)
- **Qué cambió:** En `AdminProducts.tsx` se reemplazaron los 6 `alert()` nativos por `useToastStore` (mismo mensaje, tipo `error` salvo el caso de éxito parcial al crear producto que también quedó en `error` porque `ToastType` no incluye `'warning'` — ver hallazgo abajo), se agregó `aria-label="Cerrar"` al botón × del modal de descuentos, y el empty-state de la pestaña de descuentos ahora usa `<EmptyState>` en vez de un div a mano. En `AdminInventory.tsx` y `AdminReposicion.tsx` se conectó el módulo `src/lib/statusColors.ts` (creado en la entrada anterior pero sin consumidores todavía): ambos archivos ahora comparten `getStockLevelColor`/`getStockLevelFromFlags`/`getStockLevelFromDays`, corrigiendo la inconsistencia real donde la misma condición `is_low_stock` se pintaba amarilla en una fila y roja en una celda de la misma tabla (`AdminInventory`), y unificando el esquema rojo/amarillo/gris de `dias_stock` entre ambos archivos. Se agregó `aria-label="Limpiar búsqueda"` al botón × de búsqueda de `AdminInventory` y se corrigió el label del botón de exportación de "Exportar (Excel)" a "Exportar CSV" (el archivo generado siempre fue `.csv`, el label estaba mal). En `AdminStoreStats.tsx` se creó `src/lib/chartColors.ts` con los hex literales que exige Recharts en sus props SVG, mapeados a los tokens de marca (`admin-600`/`admin-700` para las series del gráfico de visitas, sin usar el rojo de acento porque ninguna serie del gráfico es un "highlight" claro y el acento podría confundirse con un indicador de error), y se normalizó el `<h1>` de la página a `text-2xl sm:text-3xl font-bold` (antes `text-xl font-semibold`, único outlier del panel).
- **Qué se dejó igual, a propósito:** el `<h1>` dentro del HTML generado para exportar el PDF de productos (usa Arial, no clases Tailwind) — es el título de un documento de impresión aparte, no un duplicado del título de la página. El chip de resumen "N stock bajo" y el toggle de filtro "Stock bajo" en `AdminInventory` — ya usan amarillo de forma consistente y el toggle sigue la convención de filtros de `CLAUDE.md`, no son parte de la inconsistencia reportada.
- **Hallazgo para `.claude/TODO.md`:** `CLAUDE.md` documenta `show(message, 'success' | 'error' | 'warning' | 'info')`, pero `ToastType` (`src/components/ui/Toast.tsx`) solo define `'success' | 'error' | 'info'` — no existe `'warning'` en el código real.

## 2026-07-14 — Navy de marca en tokens Tailwind + módulo centralizado de colores de estado

- **Archivos modificados:** `src/components/layout/AdminLayout.tsx`, `src/components/admin/WelcomeModal.tsx`, `src/components/admin/OnboardingChecklist.tsx`, `src/components/admin/InstallBanner.tsx`, `src/components/admin/ShareStoreModal.tsx`, `src/lib/statusColors.ts` (nuevo), `src/lib/statusColors.test.ts` (nuevo), `.claude/TODO.md`
- **Qué cambió:** Reemplaza el literal hex hardcodeado del navy de marca (`#1c1d33`/`#12192C`) por el nuevo token `bg-admin-900`/`text-admin-900` de `tailwind.config.js` (escala `admin-*` ya alineada a la marca real) en 4 componentes de chrome del panel admin. `ShareStoreModal.tsx` mantiene el hex literal porque es config de la librería `qrcode` (no acepta clases Tailwind), pero corregido al valor exacto de `admin-900`. Además se crea `src/lib/statusColors.ts` con `getOrderStatusColor`, `getTransferStatusColor`, `getStockLevelColor` (+ `getStockLevelFromFlags`/`getStockLevelFromDays`) como fuente única para el mapeo estado→color que hoy reimplementan por separado `AdminOrders`, `AdminOrderDetail`, `AdminCustomerDetail`, `CashSessionPayments`, `AdminTransfers`, `AdminInventory` y `AdminReposicion`. Este cambio **no** conecta el módulo nuevo en esos 7 archivos todavía — queda para una tarea de migración separada (evita conflictos de archivo entre agentes).

## 2026-07-14 — Instalación de skill Impeccable + auditoría UX/diseño del panel admin

- **Archivos modificados:** `.claude/skills/impeccable/**` (nuevo, instalado vía `npx impeccable install`), `.claude/TODO.md`
- **Qué cambió:** Se instaló la skill `impeccable` (github.com/pbakaus/impeccable) para Claude Code, scope de proyecto. Se corrió una auditoría de UX/diseño de todo el panel admin (estructura/IA, tokens de color, consistencia de componentes) delegada en 3 sub-agentes de exploración en paralelo. Los hallazgos (paleta `admin-*` sin relación con la marca real, colores de estado duplicados/inconsistentes, `alert()` nativo en 6 páginas violando la convención del proyecto, filtros envueltos en `<Card>` en 3 páginas, falta de `<EmptyState>` en `AdminProducts`, entre otros) se registraron en `.claude/TODO.md` bajo "UX/Diseño — Panel Admin". No se aplicó ningún fix en este paso — es solo diagnóstico.

## 2026-07-13 — Toggles de módulos por organización (Sucursales / Transferencias)

- **Archivos modificados:** `src/lib/orgModules.ts` (nuevo), `src/lib/orgModules.test.ts` (nuevo), `src/types/database.types.ts`, `src/hooks/useOrgSettings.ts`, `src/App.tsx`, `src/components/layout/AdminLayout.tsx`, `src/components/admin/EditOrganizationModal.tsx`, `.claude/TODO.md`
- **Qué cambió:** Agrega dos toggles booleanos opt-out (`branches_enabled`, `transfers_enabled`) en `organizations.settings` jsonb, editables solo por el operador de plataforma (`profile.role === 'admin'`) desde el modal de edición en `/organizations` (nueva pestaña "Módulos"). Transferencias hereda una cascada de lectura: si Sucursales está deshabilitado, Transferencias queda efectivamente deshabilitado sin importar su propio valor almacenado. La lógica de resolución (default-true + cascada) vive en un módulo puro y testeado (`src/lib/orgModules.ts`, 20 tests TDD). El sidebar oculta los ítems "Sucursales"/"Transferencias" cuando el módulo está deshabilitado (gate aditivo, nunca revela algo ya bloqueado por permisos/plan), y un nuevo `OrgFeatureRouteGuard` en `App.tsx` bloquea la navegación directa a `/branches` y `/transfers`, redirigiendo a `/` (no es una situación de upsell de plan). La pestaña "Módulos" está excluida del panel rápido de "Configuraciones" en `AdminLayout` vía `hiddenTabs`. Sin migración SQL (reutiliza el jsonb existente). Enforcement es solo de UI, sin RLS/backend — decisión intencional documentada en `.claude/TODO.md`.

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
