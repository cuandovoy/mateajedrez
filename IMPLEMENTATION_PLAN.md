# 🚀 Plan de Implementación: Sistema de Variantes y Mejoras de Stock

## 📋 Fase 1: Migraciones de Base de Datos

### ✅ Migraciones Creadas:

1. **010_add_product_variants.sql** ✅
   - Crea tabla `product_variants`
   - Migra stock existente a variantes por defecto
   - Actualiza `order_items` y `cart_items` con `variant_id`
   - Actualiza triggers de stock para trabajar con variantes

2. **011_add_stock_improvements.sql** ✅
   - Agrega `unit` (unidad de medida) a productos y variantes
   - Agrega `min_stock` y `low_stock_threshold`
   - Crea funciones para detectar stock bajo

3. **012_add_variants_rls.sql** ✅
   - Agrega políticas RLS para `product_variants`

### 🔧 Pasos para Aplicar:

1. **Ejecutar migraciones en orden:**
   ```sql
   -- En Supabase SQL Editor, ejecutar en orden:
   -- 010_add_product_variants.sql
   -- 011_add_stock_improvements.sql
   -- 012_add_variants_rls.sql
   ```

2. **Verificar migración:**
   - Verificar que cada producto tiene al menos una variante por defecto
   - Verificar que los triggers funcionan correctamente

---

## 📋 Fase 2: Actualizar Tipos TypeScript

### Archivo: `src/types/database.types.ts`

**Tareas:**
1. Agregar tipos para `product_variants`
2. Actualizar tipos de `order_items` y `cart_items` para incluir `variant_id`
3. Agregar tipos para las nuevas funciones de stock

**Cambios necesarios:**
```typescript
// Agregar a Database interface:
product_variants: {
  Row: {
    id: string
    product_id: string
    sku: string
    name: string | null
    attributes: Json | null
    price: number | null
    stock: number
    is_active: boolean
    image_url: string | null
    unit: string | null
    min_stock: number
    low_stock_threshold: number
    created_at: string
    updated_at: string
  }
  // ... Insert, Update
}

// Actualizar order_items y cart_items para incluir variant_id
```

---

## 📋 Fase 3: Actualizar Admin Dashboard

### 3.1 DashboardMetrics.tsx

**Cambios necesarios:**

1. **Actualizar métrica de "Productos Bajo Stock":**
   - Usar función `get_low_stock_items()` en lugar de consulta directa
   - Mostrar variantes con stock bajo, no solo productos

2. **Agregar nueva métrica (opcional):**
   - Total de variantes activas
   - Variantes sin stock

**Código a modificar:**
```typescript
// Reemplazar consulta de low stock:
const lowStockResult = await supabase.rpc('get_low_stock_items')

// O usar función directa:
const { data: lowStockData } = await supabase
  .from('product_variants')
  .select('id, stock, min_stock, low_stock_threshold')
  .lte('stock', supabase.raw('COALESCE(low_stock_threshold, 10)'))
  .eq('is_active', true)
```

---

## 📋 Fase 4: Actualizar AdminProducts.tsx

### 4.1 Agregar Gestión de Variantes

**Nuevas funcionalidades:**

1. **Vista de Variantes:**
   - Mostrar lista de variantes por producto
   - Botón "Gestionar Variantes" en cada producto
   - Tabla con: SKU, Nombre, Atributos, Precio, Stock, Estado

2. **Modal de Crear/Editar Variante:**
   - Formulario con campos:
     - SKU (único)
     - Nombre de la variante
     - Atributos (JSONB editor o campos dinámicos)
     - Precio (opcional, hereda del producto)
     - Stock
     - Unidad de medida
     - Stock mínimo
     - Umbral de stock bajo
     - Imagen de la variante
     - Estado activo/inactivo

3. **Selector de Atributos:**
   - Permitir definir atributos comunes (color, talle, modelo)
   - Generar variantes automáticamente (combinaciones)
   - Ejemplo: Color [Rojo, Azul] × Talle [S, M, L] = 6 variantes

**Estructura sugerida:**
```typescript
// Nuevo componente: VariantManager.tsx
// Nuevo componente: VariantForm.tsx
// Actualizar AdminProducts.tsx para incluir gestión de variantes
```

---

## 📋 Fase 5: Actualizar Vistas de Tienda

### 5.1 ProductDetail.tsx

**Cambios necesarios:**

1. **Selector de Variantes:**
   - Mostrar selectores según atributos (Color, Talle, etc.)
   - Actualizar precio según variante seleccionada
   - Actualizar imagen según variante seleccionada
   - Mostrar stock disponible por variante
   - Deshabilitar variantes sin stock

2. **Agregar al Carrito:**
   - Enviar `variant_id` en lugar de solo `product_id`
   - Validar stock de la variante específica

**Componente sugerido:**
```typescript
// Nuevo componente: VariantSelector.tsx
interface VariantSelectorProps {
  productId: string
  variants: ProductVariant[]
  selectedVariant: string | null
  onVariantChange: (variantId: string) => void
}
```

### 5.2 ProductCard.tsx y ProductListItem.tsx

**Cambios necesarios:**

1. **Mostrar Variantes Disponibles:**
   - Mostrar cantidad de variantes disponibles
   - Mostrar stock total (suma de todas las variantes)
   - Indicador si hay variantes con stock bajo

2. **Link a Producto:**
   - Mantener link a `/products/:id`
   - El ProductDetail mostrará el selector de variantes

---

## 📋 Fase 6: Actualizar Carrito y Checkout

### 6.1 cartStore.ts

**Cambios necesarios:**

1. **Actualizar estructura de CartItem:**
   ```typescript
   interface CartItem {
     id: string
     variant_id: string // NUEVO
     product_id: string
     quantity: number
     variant?: ProductVariant // NUEVO
     product: Product
   }
   ```

2. **Actualizar addToCart:**
   - Aceptar `variant_id` como parámetro
   - Validar stock de la variante específica
   - Guardar `variant_id` en cart_items

3. **Actualizar syncLocalCart:**
   - Incluir `variant_id` al sincronizar
   - Manejar casos donde variant_id es NULL (backward compatibility)

### 6.2 Cart.tsx

**Cambios necesarios:**

1. **Mostrar Información de Variante:**
   - Mostrar nombre de la variante
   - Mostrar atributos (color, talle, etc.)
   - Mostrar imagen de la variante si existe

2. **Validación de Stock:**
   - Validar stock de la variante específica
   - Mostrar advertencias si la variante se quedó sin stock

### 6.3 Checkout.tsx

**Cambios necesarios:**

1. **Validación de Stock:**
   - Validar stock de cada variante en el carrito
   - Mostrar errores específicos por variante

2. **Crear Order Items:**
   - Incluir `variant_id` al crear order_items
   - Mantener `product_id` para backward compatibility

---

## 📋 Fase 7: Actualizar Order Views

### 7.1 AdminOrderDetail.tsx

**Cambios necesarios:**

1. **Mostrar Variante en Order Items:**
   - Mostrar nombre de la variante
   - Mostrar atributos de la variante
   - Mostrar SKU de la variante

### 7.2 OrderConfirmation.tsx

**Cambios necesarios:**

1. **Mostrar Variante:**
   - Similar a AdminOrderDetail
   - Mostrar información de la variante comprada

---

## 📋 Fase 8: Actualizar Búsqueda y Filtros

### 8.1 Products.tsx

**Cambios necesarios:**

1. **Filtros por Atributos:**
   - Agregar filtros por color, talle, etc.
   - Filtrar variantes, no solo productos

2. **Búsqueda:**
   - Buscar en variantes también
   - Mostrar resultados agrupados por producto

### 8.2 CategoryProducts.tsx

**Cambios necesarios:**

1. **Filtros de Variantes:**
   - Permitir filtrar por atributos de variantes
   - Mostrar solo productos con variantes que coincidan

---

## 📋 Fase 9: Testing y Validación

### Checklist de Testing:

- [ ] Crear producto con variantes desde admin
- [ ] Ver variantes en lista de productos
- [ ] Seleccionar variante en ProductDetail
- [ ] Agregar variante al carrito
- [ ] Ver variante en carrito
- [ ] Completar checkout con variantes
- [ ] Verificar que el stock se decrementa correctamente
- [ ] Verificar que el stock se restaura al cancelar orden
- [ ] Probar con productos sin variantes (backward compatibility)
- [ ] Validar alertas de stock bajo
- [ ] Probar filtros por atributos

---

## 📋 Fase 10: Mejoras Adicionales (Opcional)

### 10.1 Historial de Movimientos de Stock

**Migración:** `013_add_stock_movements.sql`

**Implementación:**
- Crear tabla `stock_movements`
- Actualizar triggers para registrar movimientos
- Crear vista en admin para ver historial

### 10.2 Stock Reservado

**Implementación:**
- Agregar `reserved_stock` a `product_variants`
- Actualizar lógica de carrito para reservar stock
- Limpiar reservas expiradas

---

## 🎯 Orden de Implementación Recomendado

### Semana 1: Base de Datos y Tipos
1. ✅ Aplicar migraciones 010, 011, 012
2. Actualizar `database.types.ts`
3. Verificar que todo funciona en base de datos

### Semana 2: Admin - Gestión de Variantes
4. Crear componentes de gestión de variantes
5. Actualizar `AdminProducts.tsx`
6. Actualizar `DashboardMetrics.tsx`

### Semana 3: Tienda - Visualización
7. Actualizar `ProductDetail.tsx` con selector de variantes
8. Actualizar `ProductCard.tsx` y `ProductListItem.tsx`
9. Actualizar `Products.tsx` y `CategoryProducts.tsx`

### Semana 4: Carrito y Checkout
10. Actualizar `cartStore.ts`
11. Actualizar `Cart.tsx`
12. Actualizar `Checkout.tsx`

### Semana 5: Órdenes y Testing
13. Actualizar vistas de órdenes
14. Testing completo
15. Ajustes y correcciones

---

## 📝 Notas Importantes

### Backward Compatibility:
- Los productos existentes tienen una variante por defecto creada automáticamente
- `variant_id` es nullable en `order_items` y `cart_items`
- Si `variant_id` es NULL, el sistema busca la variante por defecto

### Migración Gradual:
- Puedes implementar variantes gradualmente
- Los productos sin variantes específicas seguirán funcionando
- La variante por defecto se crea automáticamente

### Performance:
- Los índices están creados para optimizar consultas
- Las funciones de stock usan `SECURITY DEFINER` para mejor performance
- Considera agregar caché para consultas frecuentes

---

## 🚨 Consideraciones de Seguridad

1. **RLS Policies:**
   - Verificar que las políticas de RLS funcionan correctamente
   - Solo admins pueden modificar variantes
   - Usuarios pueden ver solo variantes activas

2. **Validación de Stock:**
   - Siempre validar stock en el servidor (triggers)
   - Validación en cliente es solo UX, no seguridad

3. **SKU Único:**
   - El SKU debe ser único a nivel global
   - Validar en frontend y backend

---

## 📚 Recursos y Referencias

- Migraciones creadas: `010_add_product_variants.sql`, `011_add_stock_improvements.sql`, `012_add_variants_rls.sql`
- Documentación de mejoras: `STOCK_IMPROVEMENTS.md`
- Tipos de base de datos: `src/types/database.types.ts`

---

## ✅ Checklist Final

Antes de considerar la implementación completa:

- [ ] Migraciones aplicadas y verificadas
- [ ] Tipos TypeScript actualizados
- [ ] Admin puede crear/editar variantes
- [ ] Tienda muestra selector de variantes
- [ ] Carrito funciona con variantes
- [ ] Checkout funciona con variantes
- [ ] Stock se maneja correctamente
- [ ] Alertas de stock bajo funcionan
- [ ] Backward compatibility mantenida
- [ ] Testing completo realizado
