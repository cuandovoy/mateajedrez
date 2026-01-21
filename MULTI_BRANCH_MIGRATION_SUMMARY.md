# Multi-Branch Migration Summary

## ✅ Migraciones de Base de Datos Completadas

### 016_add_branches_and_inventory.sql
- ✅ Creada tabla `branches` (sucursales)
- ✅ Creada tabla `branch_inventory` (inventario por sucursal)
- ✅ Agregado `branch_id` a tabla `orders` (nullable)
- ✅ RLS configurado para ambas tablas
- ✅ Función helper: `get_low_stock_items_by_branch()`
- ✅ Seed: Sucursal principal "MAIN" creada

### 017_populate_branch_inventory.sql
- ✅ Migración de stock desde `product_variants.stock` → `branch_inventory`
- ✅ Migración de stock desde `products.stock` → `branch_inventory` (edge cases)
- ✅ Todos los productos/variantes activos tienen entrada en inventory

### 018_assign_orders_to_main_branch.sql
- ✅ Todas las órdenes existentes asignadas a sucursal principal
- ✅ `branch_id` establecido para órdenes históricas

### 019_update_stock_triggers_for_branches.sql
- ✅ Eliminados triggers legacy que usaban `product_variants.stock`
- ✅ Creada función `decrement_branch_inventory()` - decrementa stock desde `branch_inventory`
- ✅ Creada función `restore_branch_inventory()` - restaura stock al cancelar
- ✅ Nuevos triggers configurados para usar `branch_inventory`
- ✅ Función `check_variant_stock_availability()` actualizada para aceptar `branch_id`

### 020_add_cash_register_system.sql
- ✅ Creada tabla `cash_sessions` (sesiones de caja)
- ✅ Creada tabla `order_payments` (pagos por orden)
- ✅ Agregado 'cash' al enum `payment_method`
- ✅ Funciones helper: `calculate_cash_session_expected_amount()`, `get_daily_totals_by_branch()`
- ✅ RLS configurado para ambas tablas

---

## 📋 Estado Actual

### ✅ Completado (Backend)
- [x] Estructura de base de datos para multi-sucursal
- [x] Migración de datos legacy
- [x] Triggers actualizados para usar `branch_inventory`
- [x] Sistema de caja básico
- [x] RLS configurado

### ✅ Completado (Frontend)
- [x] Crear `AdminBranches.tsx` - CRUD de sucursales
- [x] Lista de sucursales con filtros
- [x] Formulario crear/editar sucursal
- [x] Activar/desactivar sucursales
- [x] Actualizar `Checkout.tsx` para asignar `branch_id` a órdenes
- [x] Validar stock desde `branch_inventory` en lugar de legacy
- [x] Actualizar `Cart.tsx` para validar stock desde `branch_inventory`
- [x] Crear `order_payments` al crear orden
- [x] `AdminCashRegister.tsx` - Gestión de sesiones de caja
- [x] Abrir caja (crear `cash_sessions`)
- [x] Cerrar caja (actualizar `cash_sessions` con `closing_amount`)
- [x] Ver diferencia de caja
- [x] Historial de sesiones por sucursal
- [x] Actualizar `AdminSales.tsx` para mostrar ventas por sucursal
- [x] Filtro por sucursal en reportes
- [x] Totales por sucursal en reportes

### ⏳ Pendiente (Frontend - Opcional/Futuro)

#### 1. Gestión de Inventario por Sucursal (Admin)
- [ ] Vista de inventario por sucursal
- [ ] Actualizar stock por sucursal
- [ ] Ver productos con bajo stock por sucursal
- [ ] Transferencias entre sucursales (futuro)

#### 2. Checkout y Órdenes
- [ ] Mostrar sucursal en detalle de orden
- [ ] Permitir selección manual de sucursal en checkout (actualmente usa MAIN automáticamente)

#### 3. Sistema de Caja
- [ ] Vincular pagos en efectivo a `cash_sessions` automáticamente
- [ ] Actualizar `expected_amount` automáticamente al crear pagos en efectivo
- [ ] Reportes de diferencias de caja más detallados

#### 4. Reportes
- [ ] Totales por método de pago por sucursal
- [ ] Gráficos comparativos entre sucursales
- [ ] Exportar reportes a PDF/Excel

---

## 🔧 Cambios Necesarios en el Código

### 1. Checkout.tsx
```typescript
// Al crear orden, agregar branch_id
const orderData = {
  user_id: user?.id || null,
  total,
  status: 'pending' as const,
  shipping_address: shippingAddress,
  payment_method: paymentMethod,
  branch_id: selectedBranchId, // NUEVO: seleccionar o usar default
}

// Crear order_payments después de crear orden
await supabase.from('order_payments').insert({
  order_id: order.id,
  payment_method: paymentMethod,
  amount: total,
  cash_session_id: paymentMethod === 'cash' ? currentCashSessionId : null,
})
```

### 2. Validación de Stock
```typescript
// En lugar de verificar product_variants.stock, verificar branch_inventory
const { data: inventory } = await supabase
  .from('branch_inventory')
  .select('stock')
  .eq('branch_id', selectedBranchId)
  .eq('variant_id', variantId)
  .single()
```

### 3. Tipos TypeScript
- Regenerar tipos de Supabase después de ejecutar migraciones
- Agregar tipos para `branches`, `branch_inventory`, `cash_sessions`, `order_payments`

---

## 🧪 Cómo Probar

### 1. Ejecutar Migraciones
```sql
-- En Supabase SQL Editor, ejecutar en orden:
-- 016_add_branches_and_inventory.sql
-- 017_populate_branch_inventory.sql
-- 018_assign_orders_to_main_branch.sql
-- 019_update_stock_triggers_for_branches.sql
-- 020_add_cash_register_system.sql
```

### 2. Verificar Migración
```sql
-- Verificar sucursal principal
SELECT * FROM branches WHERE code = 'MAIN';

-- Verificar inventory poblado
SELECT COUNT(*) FROM branch_inventory;

-- Verificar órdenes con branch_id
SELECT COUNT(*), COUNT(branch_id) FROM orders;

-- Verificar triggers
SELECT * FROM pg_trigger WHERE tgname LIKE '%branch_inventory%';
```

### 3. Probar Crear Orden
- Crear una orden desde el frontend
- Verificar que se asigna `branch_id`
- Verificar que se decrementa stock en `branch_inventory`
- Verificar que NO se actualiza `product_variants.stock` (legacy)

---

## ⚠️ Notas Importantes

1. **Stock Legacy**: Las columnas `products.stock` y `product_variants.stock` ya NO se actualizan. Se mantienen solo para referencia histórica.

2. **Branch ID Requerido**: Las nuevas órdenes DEBEN tener `branch_id`. El trigger lanzará error si falta.

3. **Backward Compatibility**: Las órdenes existentes tienen `branch_id` asignado a la sucursal principal.

4. **Cash Sessions**: Solo una sesión abierta por sucursal a la vez (enforced por unique index).

5. **RLS**: Solo admins pueden gestionar sucursales, inventory y cash sessions.

---

## 📝 Próximos Pasos Recomendados

1. **Regenerar tipos TypeScript**:
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
   ```

2. **Crear componente AdminBranches.tsx** (MVP)

3. **Actualizar Checkout.tsx** para asignar branch_id

4. **Crear componente AdminCashRegister.tsx** (MVP)

5. **Actualizar reportes** para mostrar datos por sucursal

6. **Testing exhaustivo** antes de producción

---

## 🐛 Troubleshooting

### Error: "Order does not have a branch_id"
- Asegurar que todas las órdenes nuevas tengan `branch_id` asignado
- Verificar que migración 018 se ejecutó correctamente

### Error: "Inventory entry not found"
- Verificar que migración 017 se ejecutó correctamente
- Verificar que el producto/variante tiene entrada en `branch_inventory`

### Stock no se decrementa
- Verificar que los triggers están activos: `SELECT * FROM pg_trigger WHERE tgname LIKE '%branch_inventory%'`
- Verificar que `order.branch_id` está establecido

---

**Última actualización**: Después de migración 020
