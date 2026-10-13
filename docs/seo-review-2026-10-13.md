# Revisión SEO — 13 de octubre de 2026

## Alcance

Revisión del código y archivos locales. La herramienta web no pudo acceder a https://mateajedrez.uy ni a su sitemap: eso no demuestra que el sitio esté caído. No se verificaron el HTML renderizado en producción, Search Console, posiciones, tráfico ni Core Web Vitals. Las recomendaciones siguientes no están implementadas en esta entrega; el cambio aplicado es el texto solicitado en la sección `#nosotros`.

## Base existente

- Productos y categorías tienen título, descripción y canonical propios mediante Helmet.
- Las fichas incluyen datos estructurados Product/Offer y BreadcrumbList, con precio y disponibilidad calculados.
- Existe Organization con dirección y perfiles sociales en el HTML inicial.
- Hay robots.txt, generador de sitemap y redirección www → dominio principal en nginx.
- Las fotos editoriales usan WebP, variantes de tamaño, texto alternativo y carga diferida; la principal tiene prioridad.

## Hallazgos y acciones por prioridad

| Prioridad | Evidencia local | Acción recomendada |
| --- | --- | --- |
| Alta | `index.html` entrega `#root` vacío y omite description, og:title, og:description y og:image. Se agregan con JavaScript. | Evaluar prerender o SSR para portada, categorías y productos, con contenido y metadatos específicos en el HTML inicial. Google puede renderizar JS; la dependencia agrega complejidad y los lectores de previews sin JS no reciben esos tags. |
| Alta | `public/sitemap.xml` contiene 5 rutas estáticas y 7 categorías, sin fichas de producto. El generador contempla productos, pero permite omitirlos ante errores. | Comparar el sitemap publicado con los productos activos; revisar logs de generación y agregar una comprobación de integridad en el despliegue. No se conoce aún la causa de la ausencia local. Actualizarlo al cambiar el catálogo, no solo al desplegar. |
| Media | `nginx.conf` responde con el HTML de la SPA para rutas desconocidas. `CategoryProducts.tsx` muestra “Categoría no encontrada” sin noindex; la 404 general y los productos inexistentes sí lo agregan. | Unificar el tratamiento de recursos inexistentes y devolver HTTP 404 cuando la arquitectura lo permita. Mientras tanto, usar noindex en categorías inexistentes. |
| Media | Carrito, checkout y confirmación se bloquean en robots.txt pero no tienen noindex propio. | Definir una estrategia de exclusión: robots.txt impide el rastreo, pero no garantiza quitar URLs del índice. Para que Google vea noindex debe poder rastrear la página. |
| Media | La portada usa el título “Mates Ajedrez — MATE, luego existo”. El H1 editorial es “Tu mate, tu momento.”; con carrusel, `heroShowTitle` puede ocultar el único H1. | Proponer un título más descriptivo: “Mates artesanales y personalizados en Uruguay | Mates Ajedrez”. Mantener un H1 descriptivo en ambas variantes de portada. El nuevo título solicitado sigue siendo H2, acorde con la jerarquía. |
| Media | Las páginas legales están fuera del layout que define Helmet y no aportan metadatos propios. | Darles título, descripción y canonical específicos, evitando heredar metadatos generales de la portada. |
| Media | `index.html` define Twitter Cards con título, descripción e imagen fijos; las fichas solo sobreescriben Open Graph. | Generar metadatos sociales específicos por ruta y usar imágenes absolutas. Verificar previews de producto tras disponer de HTML inicial por ruta. |
| A verificar | El fallback de moneda en `useOrgSettings.ts` y en ProductDetail es ARS, aunque la tienda está en Uruguay. | Verificar que la configuración real sea la moneda de venta y que coincida con la visible y con Offer.priceCurrency. No se afirma que producción esté publicando ARS. |

## Texto nuevo y búsqueda local

El texto recibido amplía materiales y estilos de forma natural. “Matesitos” conserva la voz de marca, pero conviene complementarlo en títulos SEO y fichas con descripciones concretas como “mates artesanales” y “mates personalizados”. El reemplazo elimina la mención a Paysandú de esta sección; mantener ubicación y dirección claras en Visitanos y pie de página ayuda al contexto local. No hay razón para convertir el nuevo H2 en otro H1 ni repetir palabras clave de forma artificial.

Como mejora posterior, evaluar LocalBusiness con datos reales y consistentes de dirección, teléfono y horarios. Verificar las fichas Product con Rich Results Test. Los datos estructurados no garantizan resultados enriquecidos.

## Validación pendiente en producción

1. Inspeccionar portada, categoría y producto en Search Console y revisar la URL canónica elegida.
2. Confirmar sitemap publicado, productos incluidos y estado de procesamiento.
3. Comprobar HTTP y metadatos de rutas existentes e inexistentes.
4. Medir LCP, INP y CLS en móvil con PageSpeed Insights y datos de campo, si hay suficientes visitas.
5. Verificar previews al compartir una ficha y validar Product/Offer.

## Referencias oficiales

- [Google: SEO para JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: crear y enviar un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: datos estructurados de productos](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Google: consolidar URLs duplicadas](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
