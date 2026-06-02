# Sprint 7 — Ajustes negativos sospechosos y alerta de margen negativo

## Objetivo

Dos mejoras de detección de problemas silenciosos:

1. **Reporte de ajustes negativos**: identifica pérdidas de stock no explicadas por ventas,
   agrupadas por usuario y período. Detecta robo interno o errores de operación.

2. **Alerta de margen negativo**: avisa cuando el precio de venta con descuento activo queda
   por debajo del costo del producto. Evita vender a pérdida sin saberlo.

**Por qué séptimo**: ambas son mejoras de detección sobre datos que ya existen. Requieren
poco esfuerzo de implementación y cierran dos gaps de control que el dueño del negocio
difícilmente puede detectar a mano.

---

## PARTE A — Reporte de ajustes negativos sospechosos

### Archivos a crear

- `supabase/migrations/129_ajustes_negativos_rpc.sql`
- `src/components/admin/AjustesNegativosPanel.tsx`

### Archivos a modificar

- `src/pages/admin/AdminInventory.tsx` — agregar pestaña o sección

---

### Migración SQL

```sql
-- 129_ajustes_negativos_rpc.sql

CREATE OR REPLACE FUNCTION get_negative_adjustments(
  p_organization_id UUID,
  p_date_from       TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_date_to         TIMESTAMPTZ DEFAULT NOW(),
  p_branch_id       UUID DEFAULT NULL
)
RETURNS TABLE (
  movement_id     UUID,
  occurred_at     TIMESTAMPTZ,
  product_name    TEXT,
  sku             TEXT,
  branch_name     TEXT,
  operator_name   TEXT,
  quantity        INTEGER,
  previous_stock  INTEGER,
  new_stock       INTEGER,
  notes           TEXT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    im.id                                      AS movement_id,
    im.created_at                              AS occurred_at,
    p.name                                     AS product_name,
    p.sku                                      AS sku,
    b.name                                     AS branch_name,
    COALESCE(up.full_name, 'Desconocido')      AS operator_name,
    im.quantity,
    im.previous_stock,
    im.new_stock,
    im.notes
  FROM inventory_movements im
  JOIN branch_inventory bi ON bi.id = im.branch_inventory_id
  JOIN branches b ON b.id = bi.branch_id
    AND b.organization_id = p_organization_id
    AND (p_branch_id IS NULL OR b.id = p_branch_id)
  LEFT JOIN products p ON p.id = bi.product_id
  LEFT JOIN user_profiles up ON up.user_id = im.created_by
  WHERE im.movement_type = 'adjustment'
    AND im.quantity < 0
    AND im.created_at BETWEEN p_date_from AND p_date_to
  ORDER BY im.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_negative_adjustments_by_operator(
  p_organization_id UUID,
  p_date_from       TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_date_to         TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  operator_id       UUID,
  operator_name     TEXT,
  total_adjustments BIGINT,
  total_units_lost  BIGINT,
  avg_per_adjustment NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    im.created_by                               AS operator_id,
    COALESCE(up.full_name, 'Desconocido')       AS operator_name,
    COUNT(*)                                    AS total_adjustments,
    ABS(SUM(im.quantity))                       AS total_units_lost,
    ROUND(ABS(AVG(im.quantity)), 1)             AS avg_per_adjustment
  FROM inventory_movements im
  JOIN branch_inventory bi ON bi.id = im.branch_inventory_id
  JOIN branches b ON b.id = bi.branch_id AND b.organization_id = p_organization_id
  LEFT JOIN user_profiles up ON up.user_id = im.created_by
  WHERE im.movement_type = 'adjustment'
    AND im.quantity < 0
    AND im.created_at BETWEEN p_date_from AND p_date_to
  GROUP BY im.created_by, up.full_name
  ORDER BY total_units_lost DESC;
$$;

GRANT EXECUTE ON FUNCTION get_negative_adjustments(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_negative_adjustments_by_operator(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
```

---

### Implementación — `AjustesNegativosPanel.tsx`

**Layout:**

```
Filtros: [Desde] [Hasta] [Sucursal] [Limpiar]

Resumen (2 cards):
  Total de ajustes negativos | Unidades perdidas en el período

Tabla por operador (siempre visible):
  Operador | N° ajustes | Unidades perdidas | Promedio por ajuste

Tabla de detalle (paginada):
  Fecha | Producto | SKU | Sucursal | Operador | Cantidad | Stock anterior → nuevo | Notas
```

**Fila de cantidad:**
```tsx
<span className="font-mono font-medium text-red-600">
  {row.quantity} ud
</span>
<span className="text-xs text-gray-400 ml-1">
  ({row.previous_stock} → {row.new_stock})
</span>
```

**Badge de advertencia si no hay notas:**
```tsx
{!row.notes && (
  <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
    Sin justificación
  </span>
)}
```

Esto incentiva al operador a siempre completar el campo "notas" en los ajustes.

---

### Integración en AdminInventory

Agregar una pestaña nueva en la página de inventario:

```tsx
// Pestañas existentes (verificar cuáles existen y agregar después):
// [Inventario] [Movimientos] → agregar [Ajustes negativos]

{tab === 'ajustes' && <AjustesNegativosPanel organizationId={organizationId} />}
```

Mostrar un badge con el count de ajustes negativos de los últimos 30 días en el tab header.

---

## PARTE B — Alerta de margen negativo en productos

### Archivos a modificar

- `src/pages/admin/AdminProducts.tsx` — badge en tabla y en formulario de edición

No se requieren migraciones.

---

### Lógica de detección

Un producto tiene margen negativo cuando:
```
precio_con_descuento < costo
```

Donde:
```typescript
// Ya existe en @/lib/utils:
import { getEffectivePrice, hasActiveDiscount } from '@/lib/utils'

function tieneMargenNegativo(product: Product): boolean {
  if (!product.cost || product.cost <= 0) return false  // sin costo = no detectable
  if (!hasActiveDiscount(product)) return false          // sin descuento = no hay riesgo
  return getEffectivePrice(product) < product.cost
}
```

---

### Badge en AdminProducts — tabla desktop

En la columna de precio de la tabla de productos, agregar el badge junto al precio:

```tsx
<div className="flex items-center gap-1.5">
  <span>{formatPrice(getEffectivePrice(product))}</span>
  {tieneMargenNegativo(product) && (
    <span
      title="El precio con descuento es menor al costo"
      className="inline-flex items-center gap-0.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 font-medium"
    >
      <TrendingDown className="h-3 w-3" />
      Pérdida
    </span>
  )}
</div>
```

### Validación en formulario de edición

Al editar o crear un producto, si `descuento_activo AND precio_con_descuento < costo`,
mostrar un warning inline bajo los campos de precio/descuento:

```tsx
{margenNegativoEnFormulario && (
  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 mt-2">
    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
    <p className="text-sm text-red-700">
      Con este descuento, el precio de venta ({formatPrice(precioConDescuento)}) es menor
      al costo del producto ({formatPrice(costoActual)}). Vas a vender a pérdida.
    </p>
  </div>
)}
```

El warning es solo visual — no bloquea guardar. El dueño puede tener razones válidas
(liquidación, etc.).

### Cálculo del warning en el formulario

```typescript
// Watch de los campos relevantes con react-hook-form:
const precio     = watch('price') ?? 0
const descuento  = watch('discount_percentage') ?? 0
const expires    = watch('discount_expires_at')
const costo      = watch('cost') ?? 0

const descuentoActivo = descuento > 0 && (
  !expires || new Date(expires) > new Date()
)
const precioConDescuento = precio * (1 - descuento / 100)
const margenNegativo = costo > 0 && descuentoActivo && precioConDescuento < costo
```

### Filtro en AdminProducts

Agregar un toggle en los filtros de productos:

```tsx
<button
  onClick={() => setFilterMargenNegativo(!filterMargenNegativo)}
  className={cn(
    'h-9 px-3 flex items-center gap-1.5 rounded-lg border text-sm',
    filterMargenNegativo
      ? 'bg-red-50 border-red-300 text-red-800 font-medium'
      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
  )}
>
  <TrendingDown className="h-4 w-4" />
  <span className="hidden sm:inline">Margen negativo</span>
  {margenNegativoCount > 0 && (
    <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none bg-red-100 text-red-700">
      {margenNegativoCount}
    </span>
  )}
</button>
```

El filtro es client-side sobre los productos ya cargados.

---

## Criterios de éxito — Parte A

- [ ] Las RPCs devuelven solo movimientos con `movement_type = 'adjustment'` y `quantity < 0`
- [ ] La tabla por operador muestra totales correctos
- [ ] Los movimientos sin notas muestran el badge "Sin justificación"
- [ ] Los filtros de fecha refetchean las RPCs correctamente
- [ ] La pestaña en AdminInventory muestra el count de ajustes como badge

## Criterios de éxito — Parte B

- [ ] El badge "Pérdida" aparece en productos con descuento activo cuyo precio < costo
- [ ] El badge no aparece si el descuento está vencido
- [ ] El badge no aparece si `cost` es null o 0 (sin costo registrado)
- [ ] El warning en el formulario aparece en tiempo real al cambiar precio o descuento
- [ ] El warning no bloquea guardar el producto
- [ ] El toggle "Margen negativo" filtra correctamente en AdminProducts
- [ ] El count del toggle muestra 0 cuando no hay productos con este problema

---

## Notas

- El reporte de ajustes negativos no incluye `movement_type = 'sale'` — las ventas también
  reducen stock pero son legítimas. Solo filtra ajustes manuales, que son los que requieren
  justificación.
- En el futuro: agregar una política de "todo ajuste negativo mayor a X unidades requiere
  aprobación de admin". En v1 no implementar, solo registrar.
- El campo `cost` puede estar vacío en muchos productos (especialmente los importados antes
  de que se implementara el campo). La alerta de margen negativo no funciona si no hay costo
  cargado. Agregar un CTA visible en AdminProducts para los productos sin costo: "X productos
  sin costo registrado — completar para activar control de margen".
