# Sprint 1 — Días de stock y stock muerto en AdminInventory

## Estado: COMPLETADO — 2026-05-27

### Qué se implementó

- **Columna "Días de stock"** en la tabla desktop: calcula `floor(stock / (vendido_30d / 30))`.
  Rojo < 7d, amarillo 7-13d, gris ≥ 14d. Muestra "Sin rotación" si no hubo ventas en 30 días.
- **Columna "Última actividad"** en tabla desktop: fecha del último `inventory_movement`.
  Si el producto tiene stock > 0 y lleva > 60 días sin movimiento, muestra badge naranja con
  el ícono Archive y la cantidad de días.
- **Días de stock en mobile**: línea extra en cada card con el valor en color.
- **Toggle "Stock muerto"** en la barra de filtros: filtra productos con stock > 0 y sin
  movimiento hace > 60 días. Badge naranja con el count.
- **Botón Limpiar** actualizado para resetear el nuevo filtro.
- `fetchSalesAndMovements()` se ejecuta con `Promise.all` cada vez que cambia `inventory`
  (al cambiar de página, sucursal o búsqueda).

### Archivos modificados

- `src/pages/admin/AdminInventory.tsx`

---

## Cómo probar

### Columna "Días de stock"

1. Ir a **Inventario** en el panel admin.
2. Seleccionar la vista **Por sucursal** (es la default).
3. Verificar que aparece la columna "Días de stock" entre "Umbral Bajo" y "Acciones".
4. **Caso con ventas recientes**: buscar un producto que se haya vendido en los últimos
   30 días → debe mostrar un número (ej: `14d`). El número debería aproximarse a
   `stock ÷ (unidades_vendidas_30d / 30)`.
5. **Caso sin ventas**: buscar un producto sin ventas en el período → debe mostrar
   "Sin rotación" en gris.
6. **Colores**: un producto con 3 días de stock debe mostrarse en rojo, uno con 10 días
   en amarillo, uno con 20 días en gris.

### Columna "Última actividad"

1. En la misma tabla, verificar la columna "Última actividad" a la derecha de "Días de stock".
2. Un producto con movimientos recientes muestra la fecha formateada (ej: "27 may 2026").
3. Un producto con stock > 0 y cuyo último movimiento fue hace más de 60 días muestra un
   badge naranja con el ícono de archivo y los días (ej: `📦 75d`).
4. Si nunca tuvo movimientos muestra `—`.

### Toggle "Stock muerto"

1. En la barra de filtros, buscar el botón con ícono de archivo y texto "Stock muerto".
2. Si hay productos con stock > 0 y sin actividad > 60 días, el botón muestra un badge
   naranja con el count.
3. Al activarlo, la tabla muestra solo esos productos.
4. Al hacer click en "Limpiar", el toggle se desactiva.

### Mobile

1. En pantalla mobile (< 768px), verificar que cada card muestra la línea de días de stock
   bajo el nombre de la sucursal (ej: "3d de stock" en rojo).
2. Si el producto no tiene ventas, la línea no aparece (no muestra "null de stock").

### Casos edge a verificar

- Producto con `stock = 0`: NO debe aparecer en el filtro "Stock muerto" (el filtro es
  para stock inmovilizado, no para productos agotados).
- Variantes (`product_id = null`): la celda "Días de stock" muestra `—` porque no se
  cruza con `order_items` por `product_id`. Es comportamiento esperado en v1.
- Al cambiar de página en la tabla, las columnas deben actualizarse con los datos correctos
  de los nuevos productos (el fetch se re-ejecuta al cambiar `inventory`).

---

## Objetivo

Agregar dos columnas calculadas en `AdminInventory` que transforman el stock estático en
información accionable: cuántos días le quedan al negocio con el stock actual, y qué
productos tienen stock sin movimiento hace más de 60 días.

**Por qué primero**: no requiere migración, no requiere nuevas tablas. Son dos columnas sobre
datos que ya existen. Cambian completamente cómo el dueño lee el inventario desde el día 1.

---

## Archivos a modificar

- `src/pages/admin/AdminInventory.tsx` — única modificación necesaria

No se requieren migraciones SQL.

---

## Implementación

### 1. Agregar la query de ventas por producto al fetch existente

En el `fetchInventory` de `AdminInventory.tsx`, agregar en paralelo una query que calcule
las unidades vendidas en los últimos 30 días por `product_id`:

```typescript
// Dentro del Promise.all existente, agregar:
supabase
  .from('order_items')
  .select('product_id, quantity')
  .eq('orders.organization_id', organizationId)  // join implícito por RLS
  .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
```

Agrupar el resultado en un `Map<productId, totalVendido30d>` en el componente.

> Alternativa más eficiente si la tabla crece: crear una RPC Postgres que devuelva el
> map directamente. Evaluar según volumen de datos. Empezar con la query cliente.

### 2. Agregar la query de último movimiento por producto

```typescript
supabase
  .from('inventory_movements')
  .select('branch_inventory_id, created_at, branch_inventory!inner(product_id)')
  .eq('branch_inventory.branch_id', selectedBranchId)  // filtrar por sucursal activa
  .order('created_at', { ascending: false })
```

Agrupar en un `Map<productId, lastMovementDate>`.

### 3. Calcular días de stock

```typescript
function calcDiasStock(stockActual: number, vendido30d: number): number | null {
  if (vendido30d === 0) return null  // sin rotación — mostrar diferente
  const ventasDiarias = vendido30d / 30
  return Math.floor(stockActual / ventasDiarias)
}
```

### 4. Agregar columnas en la tabla desktop

Agregar dos columnas nuevas en el header y en cada fila de `AdminInventory`:

**Columna "Días de stock":**
```tsx
// En el header
<th>Días de stock</th>

// En cada fila
const dias = calcDiasStock(item.stock, ventasPorProducto.get(item.product_id) ?? 0)

{dias === null ? (
  <span className="text-xs text-gray-400">Sin rotación</span>
) : (
  <span className={cn(
    'text-sm font-mono font-medium',
    dias < 7  && 'text-red-600',
    dias >= 7  && dias < 14 && 'text-yellow-600',
    dias >= 14 && 'text-gray-700',
  )}>
    {dias}d
  </span>
)}
```

**Columna "Última actividad":**
```tsx
const lastMov = lastMovByProduct.get(item.product_id)
const diasSinMov = lastMov
  ? Math.floor((Date.now() - new Date(lastMov).getTime()) / (1000 * 60 * 60 * 24))
  : null

{diasSinMov !== null && diasSinMov > 60 ? (
  <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
    <AlertTriangle className="h-3 w-3" />
    {diasSinMov}d sin movimiento
  </span>
) : (
  <span className="text-xs text-gray-400">
    {lastMov ? formatDateShort(lastMov) : '—'}
  </span>
)}
```

### 5. Filtro "Stock muerto" en la barra de filtros existente

Agregar un toggle en la barra de filtros inline (siguiendo el patrón del toggle "Stock bajo"
que ya existe):

```tsx
<button
  onClick={() => setFilterStockMuerto(!filterStockMuerto)}
  className={cn(
    'h-9 px-3 flex items-center gap-1.5 rounded-lg border text-sm',
    filterStockMuerto
      ? 'bg-orange-50 border-orange-300 text-orange-800 font-medium'
      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
  )}
>
  <Archive className="h-4 w-4" />
  <span className="hidden sm:inline">Stock muerto</span>
  {deadStockCount > 0 && (
    <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none bg-orange-100 text-orange-700">
      {deadStockCount}
    </span>
  )}
</button>
```

El filtro aplica client-side sobre los datos ya cargados:
```typescript
if (filterStockMuerto) {
  filtered = filtered.filter(item => {
    const dias = diasSinMovByProduct.get(item.product_id)
    return dias !== null && dias > 60 && item.stock > 0
  })
}
```

---

## Estado a agregar al componente

```typescript
const [ventasPorProducto, setVentasPorProducto] = useState<Map<string, number>>(new Map())
const [lastMovByProduct, setLastMovByProduct] = useState<Map<string, string>>(new Map())
const [filterStockMuerto, setFilterStockMuerto] = useState(false)
```

---

## Criterios de éxito

- [ ] La columna "Días de stock" muestra valores correctos para productos con ventas recientes
- [ ] Productos sin ventas en 30 días muestran "Sin rotación" (no un número incorrecto)
- [ ] Stock < 7 días muestra en rojo, 7-14 en amarillo, > 14 en gris
- [ ] El toggle "Stock muerto" filtra correctamente productos con stock > 0 y sin movimiento > 60 días
- [ ] La columna de última actividad muestra el badge naranja para los productos muertos
- [ ] Las dos queries adicionales se ejecutan en el `Promise.all` del fetch, no secuencialmente
- [ ] El loading/skeleton existente cubre las nuevas columnas

---

## Notas

- Si el volumen de `order_items` crece mucho (>50k filas), mover la query de ventas a una
  RPC Postgres que devuelva el map agrupado directamente. Por ahora empezar client-side.
- El filtro "Stock muerto" es client-side sobre los datos ya paginados. Si la paginación es
  activa, solo filtra la página actual. Aceptable para v1; si se pide filtrado global, mover
  a query server-side.
- El icono `Archive` ya está disponible en Lucide React.
