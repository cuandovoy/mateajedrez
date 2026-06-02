# Sprint 5 — Vista simplificada de stock móvil

## Objetivo

Crear una ruta `/stock` sin sidebar, optimizada para celular, donde cualquier usuario
autorizado puede buscar un producto y ver su stock en cada sucursal en tiempo real.

**Por qué quinto**: habilita el caso de uso más frecuente del dueño fuera del local.
Reutiliza infraestructura ya existente (`POSLayout`, queries de `branch_inventory`).
No requiere migración.

---

## Archivos a crear

- `src/pages/stock/StockConsulta.tsx` — pantalla de consulta
- `src/pages/stock/StockHome.tsx` — selector de sucursal (opcional, ver notas)

## Archivos a modificar

- `src/App.tsx` — agregar ruta `/stock`
- `src/components/layout/AdminLayout.tsx` — agregar link en bottom nav mobile

No se requieren migraciones SQL.

---

## Implementación — `StockConsulta.tsx`

### Layout

Reutilizar `POSLayout` (ya existe en `src/components/layout/POSLayout.tsx`). No reinventar
el layout; el POS ya tiene el patrón correcto para mobile-first sin sidebar.

```tsx
export function StockConsulta() {
  return (
    <POSLayout title="Consulta de stock">
      {/* contenido */}
    </POSLayout>
  )
}
```

### Buscador

Input grande con icono de búsqueda, autofocus al cargar la pantalla:

```tsx
<div className="relative">
  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
  <input
    ref={searchRef}
    autoFocus
    placeholder="Nombre, SKU o código de barras..."
    className="w-full h-14 pl-12 pr-4 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-admin-500"
    value={query}
    onChange={e => setQuery(e.target.value)}
  />
  {query && (
    <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
      <X className="h-5 w-5 text-gray-400" />
    </button>
  )}
</div>
```

### Query de búsqueda

Buscar con debounce de 300ms. Query: productos que coincidan con nombre o SKU, con su
stock en todas las sucursales:

```typescript
async function buscarProductos(q: string) {
  if (q.trim().length < 2) {
    setResultados([])
    return
  }

  const { data } = await supabase
    .from('products')
    .select(`
      id, name, sku,
      branch_inventory!inner(
        stock,
        branch:branches(id, name, is_active)
      )
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
    .limit(20)

  setResultados(data ?? [])
}
```

### Resultados

Cada producto encontrado muestra una card con sus sucursales:

```tsx
function ProductoStockCard({ producto }: { producto: ProductoConStock }) {
  const totalStock = producto.branch_inventory.reduce((sum, bi) => sum + bi.stock, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-gray-900">{producto.name}</p>
          <p className="text-xs text-gray-400 font-mono">{producto.sku}</p>
        </div>
        <StockBadge stock={totalStock} label="Total" size="lg" />
      </div>

      {/* Stock por sucursal */}
      <div className="flex flex-wrap gap-2">
        {producto.branch_inventory
          .filter(bi => bi.branch.is_active)
          .map(bi => (
            <div key={bi.branch.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-gray-600">{bi.branch.name}</span>
              <StockBadge stock={bi.stock} size="sm" />
            </div>
          ))
        }
      </div>
    </div>
  )
}
```

### Componente `StockBadge`

```tsx
function StockBadge({ stock, label, size = 'md' }: { stock: number; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = stock === 0
    ? 'bg-red-100 text-red-700'
    : stock <= 5
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-green-100 text-green-700'

  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'

  return (
    <span className={cn('font-mono font-semibold rounded px-1.5 py-0.5 leading-none', color, textSize)}>
      {label && <span className="font-normal mr-1">{label}:</span>}
      {stock}
    </span>
  )
}
```

Umbrales de color: 0 = rojo, 1-5 = amarillo, > 5 = verde. En v2 usar el
`low_stock_threshold` del producto si está disponible.

### Estado vacío y de carga

- Antes de escribir: ilustración + "Buscá un producto por nombre o SKU"
- Escribiendo (debounce): indicador de carga sutil
- Sin resultados: "No encontramos productos con ese texto"
- Con resultados: lista de cards

---

## Escáner de código de barras (opcional en v1)

El POS ya implementa `BarcodeDetector` API en `POSBarcodeScanner.tsx`. Si el usuario quiere
escanear desde la consulta de stock, reutilizar ese componente — botón de cámara al lado
del input que activa el escáner, y al detectar un código ejecuta la búsqueda automáticamente.

**En v1 es opcional.** El buscador de texto es suficiente. Agregar el escáner en v2 si el
usuario lo pide.

---

## Ruta en `App.tsx`

```tsx
// Fuera del AdminLayout wrapper, como las rutas del POS:
<Route path="/stock" element={
  <RequireAuth>
    <StockConsulta />
  </RequireAuth>
} />
```

La autenticación es requerida pero no necesita verificar un rol específico en v1. Cualquier
miembro de la organización puede consultar el stock.

---

## Link en `AdminLayout.tsx`

En el bottom nav mobile (ya existe el patrón para el POS):

```tsx
// Bottom nav mobile — agregar junto al link del POS:
<Link to="/stock" className="flex flex-col items-center gap-1 text-xs">
  <Package className="h-5 w-5" />
  Stock
</Link>
```

En el sidebar desktop, agregarlo en la sección de Inventario:

```tsx
{ to: '/stock', icon: Search, label: 'Consulta rápida' }
```

---

## Criterios de éxito

- [ ] La búsqueda muestra resultados en menos de 500ms con el debounce
- [ ] Cada card muestra correctamente el stock por sucursal
- [ ] El badge de color cambia correctamente (rojo/amarillo/verde)
- [ ] La pantalla funciona correctamente en mobile (iPhone SE, iPhone 14)
- [ ] El input tiene autofocus al cargar la página
- [ ] El botón X limpia la búsqueda y vuelve al estado vacío
- [ ] Búsqueda por SKU exacto devuelve el producto correcto
- [ ] Sucursales inactivas no aparecen en el desglose
- [ ] La ruta `/stock` no muestra el sidebar de AdminLayout
- [ ] El link en el bottom nav mobile funciona

---

## Notas

- Esta pantalla no permite editar stock, crear movimientos ni hacer nada más. Es
  exclusivamente de lectura. No agregar acciones en v1.
- Si la organización tiene muchas sucursales (> 6), el desglose por sucursal puede
  quedar muy largo en mobile. Considerar colapsar las sucursales con stock = 0 con un
  toggle "Ver todas".
- En v2: agregar soporte para variantes (mostrar stock por variante dentro del producto).
  En v1 mostrar solo el stock directo del producto.
- El `POSLayout` puede necesitar ajuste en el título o el botón de volver. Verificar
  que acepta `title` como prop o extender si hace falta.
