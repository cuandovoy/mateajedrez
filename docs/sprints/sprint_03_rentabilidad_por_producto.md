# Sprint 3 — Rentabilidad por producto

## Objetivo

Implementar un reporte que responda "¿cuánto gané con cada producto en un período dado?",
con margen bruto ($), margen (%), unidades vendidas y revenue. Incluye el fix de fondo
que lo hace posible: capturar `unit_cost` en `order_items` al momento de la venta.

**Por qué tercero**: es el gap más grande del sistema (4/10). Sin rentabilidad por producto
el gross margin del dashboard es un número vacío. Requiere una migración que conviene hacer
antes de que haya demasiadas órdenes sin costo registrado.

---

## Archivos a crear

- `supabase/migrations/127_unit_cost_on_order_items.sql` — fix de datos + columna
- `supabase/migrations/128_rentabilidad_rpc.sql` — RPC de reporte
- `src/pages/admin/AdminRentabilidad.tsx` — página nueva

## Archivos a modificar

- `src/types/database.types.ts` — agregar `unit_cost` a `order_items` Row/Insert/Update
- `src/lib/posService.ts` — capturar `unit_cost` al crear venta desde POS
- `src/components/admin/ManualSaleForm.tsx` — capturar `unit_cost` al crear venta manual
- `src/App.tsx` — agregar ruta
- `src/components/layout/AdminLayout.tsx` — agregar link en sidebar

---

## Migración 1 — `unit_cost` en `order_items`

```sql
-- 127_unit_cost_on_order_items.sql

-- Agregar columna (nullable para no romper filas existentes)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2) DEFAULT NULL;

-- Backfill: intentar recuperar el costo actual del producto para órdenes existentes.
-- Es una aproximación (el costo pudo haber cambiado); lo mejor disponible sin historial.
UPDATE order_items oi
SET unit_cost = p.cost
FROM products p
WHERE p.id = oi.product_id
  AND oi.unit_cost IS NULL
  AND p.cost IS NOT NULL
  AND p.cost > 0;

COMMENT ON COLUMN order_items.unit_cost IS
  'Costo unitario al momento de la venta. Snapshot del products.cost en el momento del INSERT.';
```

---

## Migración 2 — RPC de rentabilidad

```sql
-- 128_rentabilidad_rpc.sql

CREATE OR REPLACE FUNCTION get_product_profitability(
  p_organization_id UUID,
  p_date_from        TIMESTAMPTZ,
  p_date_to          TIMESTAMPTZ,
  p_branch_id        UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id      UUID,
  product_name    TEXT,
  sku             TEXT,
  category_name   TEXT,
  units_sold      BIGINT,
  revenue         NUMERIC,
  total_cost      NUMERIC,
  gross_margin    NUMERIC,
  margin_pct      NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id                                           AS product_id,
    p.name                                         AS product_name,
    p.sku                                          AS sku,
    c.name                                         AS category_name,
    SUM(oi.quantity)                               AS units_sold,
    SUM(oi.quantity * oi.unit_price)               AS revenue,
    SUM(oi.quantity * COALESCE(oi.unit_cost, 0))   AS total_cost,
    SUM(oi.quantity * oi.unit_price)
      - SUM(oi.quantity * COALESCE(oi.unit_cost, 0)) AS gross_margin,
    CASE
      WHEN SUM(oi.quantity * oi.unit_price) = 0 THEN 0
      ELSE ROUND(
        (SUM(oi.quantity * oi.unit_price) - SUM(oi.quantity * COALESCE(oi.unit_cost, 0)))
        / SUM(oi.quantity * oi.unit_price) * 100,
        1
      )
    END                                            AS margin_pct
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
    AND o.organization_id = p_organization_id
    AND o.status NOT IN ('cancelled')
    AND o.created_at BETWEEN p_date_from AND p_date_to
    AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  JOIN products p ON p.id = oi.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  GROUP BY p.id, p.name, p.sku, c.name
  HAVING SUM(oi.quantity) > 0
  ORDER BY gross_margin DESC;
$$;

GRANT EXECUTE ON FUNCTION get_product_profitability(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID)
  TO authenticated;
```

---

## Capturar `unit_cost` al crear una venta

### ManualSaleForm.tsx

En el objeto de `order_items` que se inserta, agregar:

```typescript
// Al construir los items de la orden:
{
  order_id: orderId,
  product_id: item.product_id,
  variant_id: item.variant_id ?? null,
  quantity: item.quantity,
  unit_price: item.unitPrice,
  unit_cost: item.product.cost ?? null,   // ← agregar esta línea
  discount: item.discount ?? 0,
  subtotal: item.quantity * item.unitPrice,
}
```

`item.product.cost` ya se carga al buscar productos en el formulario. Verificar que el
`select` del producto incluya el campo `cost`.

### posService.ts

Mismo cambio en `createSaleFromCart()`:

```typescript
// En el map de cartItems a order_items:
unit_cost: cartItem.product.cost ?? null,
```

---

## Actualizar tipos — `database.types.ts`

En el bloque `order_items`:
```typescript
// Row
unit_cost: number | null

// Insert
unit_cost?: number | null

// Update
unit_cost?: number | null
```

---

## Implementación — `AdminRentabilidad.tsx`

### Layout de la página

```
Header: "Rentabilidad por producto"

Filtros (barra inline, siempre visible):
  [Desde] [Hasta]  [Sucursal: Todas ▾]  [Categoría: Todas ▾]  [Limpiar]

Resumen (4 cards):
  Revenue total | Costo total | Margen bruto ($) | Margen (%)

Tabla ordenable:
  Producto | SKU | Categoría | Unidades | Revenue | Costo | Margen $ | Margen % | Estado

Footer de tabla:
  Nota: "Los productos sin costo registrado se calculan con costo $0. [Cómo actualizar costos]"
```

### Columna "Estado" de margen

```tsx
function MargenBadge({ pct }: { pct: number }) {
  if (pct < 0)  return <span className="badge-red">Pérdida</span>
  if (pct < 10) return <span className="badge-orange">Margen bajo</span>
  if (pct < 30) return <span className="badge-yellow">Aceptable</span>
  return <span className="badge-green">Saludable</span>
}
```

Umbrales orientativos para retail general. En v2 hacerlos configurables por organización.

### Productos sin costo

Si `unit_cost IS NULL` en `order_items` (órdenes pre-migración), el margen se calcula como
si el costo fuera 0 — lo que infla el margen. Mostrar una advertencia visible:

```tsx
{productosSinCosto > 0 && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
    <strong>{productosSinCosto} producto{productosSinCosto > 1 ? 's' : ''}</strong> tienen
    ventas sin costo registrado (órdenes anteriores a la actualización). Su margen puede
    estar sobreestimado.
  </div>
)}
```

Detectar esto consultando si hay order_items con `unit_cost IS NULL` en el período.

### Ordenamiento de la tabla

Ordenable client-side por: revenue, costo, margen $, margen %, unidades.
Default: margen $ descendente (los productos más rentables primero).

### Exportación CSV

Botón "Exportar CSV" que incluye todas las columnas. Usar el helper de exportación que
ya existe en otros módulos del proyecto.

---

## Ruta y sidebar

**App.tsx:**
```tsx
<Route path="/rentabilidad" element={<AdminRentabilidad />} />
```

**AdminLayout.tsx** — en la sección de Reportes:
```tsx
{ to: '/rentabilidad', icon: TrendingUp, label: 'Rentabilidad' }
```

---

## Criterios de éxito

- [ ] La migración corre sin errores y el backfill actualiza correctamente los registros con costo
- [ ] Las ventas nuevas (post-migración) guardan `unit_cost` correctamente desde ManualSaleForm y POS
- [ ] El reporte muestra datos correctos para un período con órdenes conocidas (verificar manualmente)
- [ ] Los productos con `unit_cost = NULL` muestran la advertencia de margen sobreestimado
- [ ] El ordenamiento por columnas funciona
- [ ] Los filtros de fecha y sucursal funcionan y re-fetchean la RPC
- [ ] El margen negativo muestra badge rojo
- [ ] La exportación CSV incluye todas las columnas
- [ ] La página carga con skeleton mientras espera la RPC

---

## Notas

- El backfill de `unit_cost` con el costo actual del producto es una aproximación. Para
  negocios con costos muy variables esto puede ser inexacto. Advertirlo en el reporte para
  el período histórico (pre-migración).
- En el futuro, cuando se implemente FIFO de costo (migración 124 ya existe:
  `124_costing_method_fifo.sql`), el `unit_cost` podría calcularse dinámicamente.
  Por ahora, el snapshot del `products.cost` al momento de la venta es suficiente.
- Si el campo `cost` está vacío en muchos productos, agregar un CTA en la página de
  rentabilidad que lleve a AdminProducts filtrado por "sin costo" para que el usuario los
  complete.
