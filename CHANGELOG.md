# Changelog — Axiostock

Registro de cambios realizados por Claude Code. Entradas en orden descendente.

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
