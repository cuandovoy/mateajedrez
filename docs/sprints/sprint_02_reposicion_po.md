# Sprint 2 — Pantalla de reposición con generación de PO

## Estado: COMPLETADO — 2026-05-27

### Qué se implementó

- **RPC `get_reposicion_report`** en `supabase/migrations/127_reposicion_rpc.sql`: devuelve todos los productos bajo umbral con stock actual, umbral, días de stock calculados, ventas 30d y proveedor primario. Aplica solo a `branch_inventory` sin variante (`variant_id IS NULL`).
- **Página `/reposicion`** (`AdminReposicion.tsx`): lista todos esos productos con filtros por búsqueda, sucursal y proveedor. Selección múltiple con checkbox + "seleccionar todos".
- **Modal de creación de PO** (`ReposicionPOModal`, inline en el mismo archivo): agrupa los seleccionados por proveedor, permite editar cantidades a pedir (default: `MAX(threshold * 2 - stock, 1)`), seleccionar sucursal destino, y crea una `purchase_order` por proveedor + sus `purchase_order_items`. Productos sin proveedor muestran advertencia y se omiten.
- **Ruta** `/reposicion` en `App.tsx`.
- **Link en sidebar** (sección Catálogo, después de Inventario) con ícono `RefreshCw`.

### Archivos creados/modificados

- `supabase/migrations/127_reposicion_rpc.sql` — nueva migración (aplicar manualmente)
- `src/pages/admin/AdminReposicion.tsx` — página nueva
- `src/App.tsx` — ruta `/reposicion` agregada
- `src/components/layout/AdminLayout.tsx` — link en sidebar + import `RefreshCw`

---

### Cómo probar

1. Aplicar la migración `127_reposicion_rpc.sql` en Supabase (SQL Editor o CLI).
2. Asegurarse de tener al menos un producto cuyo `stock` sea menor o igual a `low_stock_threshold` en alguna sucursal activa.
3. Ir a **Catálogo → Reposición** en el sidebar.
4. Verificar que aparece la lista de productos bajo umbral con sus columnas (Stock, Umbral, Días de stock, Proveedor).
5. Usar los filtros de búsqueda, sucursal y proveedor — deben funcionar client-side sin reload.
6. Seleccionar uno o más productos → aparece el footer sticky "X productos seleccionados".
7. Hacer click en "Crear orden de compra":
   - El modal debe agrupar los seleccionados por proveedor.
   - Editar las cantidades y verificar que el default es `MAX(umbral * 2 - stock, 1)`.
   - Seleccionar sucursal destino.
   - Confirmar → debe crearse una PO por proveedor en `purchase_orders` + sus ítems en `purchase_order_items`.
   - Aparece toast de éxito.
8. Verificar las POs creadas en **Compras y Egresos** (`/expenses`).
9. Productos sin proveedor asignado deben mostrar advertencia en el modal y no generar PO.

### Casos edge a verificar

- Producto en dos sucursales bajo umbral → aparece una fila por sucursal.
- Todos los seleccionados sin proveedor → el modal muestra advertencia y el botón "Crear" queda deshabilitado.
- Stock = 0 → aparece en la lista (está bajo cualquier umbral > 0), días de stock = "Sin datos".
- Sin productos bajo umbral → muestra EmptyState con ícono de checkmark.

---

## Objetivo

Crear una pantalla `/admin/reposicion` que lista todos los productos bajo su umbral de stock
con contexto suficiente para tomar decisiones (días restantes, proveedor, stock actual) y
permite generar una orden de compra pre-cargada en un click.

**Por qué segundo**: cierra el loop del sistema de alertas que ya existe. Hoy el trigger de
stock bajo notifica; esta pantalla convierte esa notificación en una acción. Todos los datos
necesarios ya están en la DB.

---

## Archivos a crear

- `src/pages/admin/AdminReposicion.tsx` — página nueva
- `supabase/migrations/127_reposicion_rpc.sql` — RPC para query consolidada

## Archivos a modificar

- `src/App.tsx` — agregar ruta `/reposicion`
- `src/components/layout/AdminLayout.tsx` — agregar link en sidebar (sección Inventario)

---

## Migración SQL

```sql
-- 127_reposicion_rpc.sql
CREATE OR REPLACE FUNCTION get_reposicion_report(p_organization_id UUID)
RETURNS TABLE (
  product_id        UUID,
  product_name      TEXT,
  sku               TEXT,
  branch_id         UUID,
  branch_name       TEXT,
  stock_actual      INTEGER,
  low_stock_threshold INTEGER,
  min_stock         INTEGER,
  ventas_30d        NUMERIC,
  dias_stock        NUMERIC,
  supplier_id       UUID,
  supplier_name     TEXT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id                              AS product_id,
    p.name                            AS product_name,
    p.sku                             AS sku,
    b.id                              AS branch_id,
    b.name                            AS branch_name,
    bi.stock                          AS stock_actual,
    bi.low_stock_threshold            AS low_stock_threshold,
    bi.min_stock                      AS min_stock,
    COALESCE(v.ventas_30d, 0)         AS ventas_30d,
    CASE
      WHEN COALESCE(v.ventas_30d, 0) = 0 THEN NULL
      ELSE ROUND(bi.stock / (v.ventas_30d / 30), 1)
    END                               AS dias_stock,
    ps.supplier_id                    AS supplier_id,
    s.name                            AS supplier_name
  FROM branch_inventory bi
  JOIN branches b ON b.id = bi.branch_id AND b.organization_id = p_organization_id AND b.is_active = true
  JOIN products p ON p.id = bi.product_id AND p.organization_id = p_organization_id AND p.is_active = true
  LEFT JOIN (
    SELECT oi.product_id, SUM(oi.quantity) AS ventas_30d
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.organization_id = p_organization_id
    WHERE o.created_at >= NOW() - INTERVAL '30 days'
      AND o.status NOT IN ('cancelled')
    GROUP BY oi.product_id
  ) v ON v.product_id = p.id
  LEFT JOIN product_suppliers ps ON ps.product_id = p.id AND ps.is_primary = true
  LEFT JOIN suppliers s ON s.id = ps.supplier_id
  WHERE bi.variant_id IS NULL
    AND bi.stock <= GREATEST(COALESCE(bi.low_stock_threshold, 5), COALESCE(bi.min_stock, 0))
  ORDER BY dias_stock ASC NULLS LAST, bi.stock ASC;
$$;

GRANT EXECUTE ON FUNCTION get_reposicion_report(UUID) TO authenticated;
```

---

## Implementación — `AdminReposicion.tsx`

### Estructura de la página

```
Header: "Qué reponer hoy" + badge con total de productos
Barra de filtros: búsqueda, filtro por sucursal, filtro por proveedor
Tabla con checkbox de selección múltiple
Footer sticky: X productos seleccionados → [Crear orden de compra]
```

### Estado

```typescript
interface ReposicionItem {
  product_id: string
  product_name: string
  sku: string
  branch_id: string
  branch_name: string
  stock_actual: number
  low_stock_threshold: number
  ventas_30d: number
  dias_stock: number | null
  supplier_id: string | null
  supplier_name: string | null
}

const [items, setItems] = useState<ReposicionItem[]>([])
const [selected, setSelected] = useState<Set<string>>(new Set()) // key: product_id
const [showPOModal, setShowPOModal] = useState(false)
```

### Tabla

Columnas:
| # | Columna | Contenido |
|---|---------|-----------|
| 1 | Checkbox | Selección para PO |
| 2 | Producto | Nombre + SKU monospace |
| 3 | Sucursal | Badge con nombre |
| 4 | Stock actual | Número en rojo |
| 5 | Umbral | `low_stock_threshold` en gris |
| 6 | Días de stock | Rojo si < 7, amarillo si < 14, "Sin datos" si null |
| 7 | Proveedor | Nombre o badge "Sin proveedor" en gris |

### Footer sticky con acción

```tsx
{selected.size > 0 && (
  <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between z-40">
    <span className="text-sm text-gray-600">
      {selected.size} producto{selected.size > 1 ? 's' : ''} seleccionado{selected.size > 1 ? 's' : ''}
    </span>
    <Button onClick={() => setShowPOModal(true)}>
      <ShoppingCart className="h-4 w-4 mr-2" />
      Crear orden de compra
    </Button>
  </div>
)}
```

---

## Modal de creación de PO — `ReposicionPOModal`

Crear dentro del mismo archivo o como componente separado en `src/components/admin/`.

### Flujo

Los productos seleccionados pueden tener distintos proveedores primarios. El modal agrupa
los seleccionados por proveedor y crea una PO por proveedor:

```
Proveedor A (3 productos)   → PO 1
Proveedor B (2 productos)   → PO 2
Sin proveedor (1 producto)  → advertencia, se omite o se pide asignar
```

### UI del modal

```
Título: "Crear órdenes de compra"

Por cada proveedor:
  [Badge proveedor]
  Tabla editable: producto | SKU | stock actual | cantidad a pedir (input numérico, default = umbral - stock)

[Cancelar] [Crear X orden(es) de compra]
```

La cantidad a pedir por defecto: `MAX(low_stock_threshold * 2 - stock_actual, 1)`. El
usuario puede editarla antes de confirmar.

### Lógica de creación

```typescript
async function crearPOs() {
  for (const [supplierId, productosDelProveedor] of agrupadosPorProveedor) {
    // 1. Crear purchase_order
    const { data: po } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: supplierId,
        organization_id: organizationId,
        branch_id: selectedBranchId,  // sucursal destino (selector en modal)
        status: 'pending',
        po_number: await generarNumeroPO(),
      })
      .select('id')
      .single()

    // 2. Crear purchase_order_items
    await supabase.from('purchase_order_items').insert(
      productosDelProveedor.map((p, i) => ({
        purchase_order_id: po.id,
        product_id: p.product_id,
        quantity_ordered: cantidadesPorProducto[p.product_id],
        quantity_received: 0,
        unit_cost: 0,  // se completa al recibir la mercadería
        line_number: i + 1,
      }))
    )
  }
}
```

---

## Ruta y sidebar

**App.tsx** — dentro del bloque de rutas admin:
```tsx
<Route path="/reposicion" element={<AdminReposicion />} />
```

**AdminLayout.tsx** — en la sección de Inventario del sidebar, después del link a Inventario:
```tsx
{
  to: '/reposicion',
  icon: RefreshCw,
  label: 'Reposición',
  badge: lowStockCount > 0 ? lowStockCount : undefined,  // usa el hook useOperationalMetrics que ya existe
}
```

El badge con el count ya está disponible via `useOperationalMetrics().lowStockCount`.

---

## Criterios de éxito

- [ ] La página carga correctamente todos los productos bajo umbral de todas las sucursales
- [ ] La columna "Días de stock" muestra null como "Sin datos" (no divide por cero)
- [ ] El filtro por sucursal y por proveedor funciona client-side
- [ ] La selección múltiple funciona incluyendo "seleccionar todos"
- [ ] El modal agrupa correctamente por proveedor
- [ ] Productos sin proveedor asignado muestran advertencia y se pueden omitir
- [ ] Las POs se crean correctamente en `purchase_orders` + `purchase_order_items`
- [ ] Después de crear las POs aparece toast de éxito con link a AdminExpenses
- [ ] El badge del sidebar muestra el count de productos a reponer
- [ ] El footer sticky no cubre la última fila de la tabla (padding-bottom en el contenedor)

---

## Notas

- El `po_number` puede generarse como `PO-YYYYMMDD-XXX` donde XXX es un correlativo diario.
  Verificar si ya existe un helper para esto en el código o si se genera en la RPC.
- Si un producto está en múltiples sucursales y ambas están bajo umbral, aparece una fila
  por sucursal. El usuario decide desde cuál reponer.
- La sucursal destino de la PO se selecciona una vez en el modal (no por producto). En v1
  es suficiente; en v2 se puede hacer por fila.
