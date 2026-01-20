# 📦 Mejoras Necesarias para Control de Stock Completo

## 🔍 Análisis del Sistema Actual

### ✅ Lo que ya tienes:
- ✅ SKU único por producto
- ✅ Estado activo/inactivo (`is_active`)
- ✅ Stock básico (número entero)
- ✅ Decremento automático al crear órdenes
- ✅ Restauración automática al cancelar órdenes
- ✅ Validación de stock en cliente (carrito, checkout)

### ❌ Lo que falta (según mejores prácticas):

---

## 🚨 CRÍTICO: Sistema de Variantes

### Problema Actual:
- El stock se maneja **solo a nivel de producto**
- No puedes tener: "Remera Roja Talle M" con stock diferente de "Remera Roja Talle L"
- Un producto con variantes comparte el mismo stock (incorrecto)

### Solución: Tabla de Variantes

Necesitas crear una tabla `product_variants`:

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL UNIQUE, -- SKU único por variante
  name VARCHAR(255), -- Ej: "Rojo - Talle M"
  attributes JSONB, -- { "color": "Rojo", "size": "M", "model": "2024" }
  price DECIMAL(10, 2), -- Precio específico de la variante (opcional, hereda del producto si es NULL)
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN DEFAULT true,
  image_url TEXT, -- Imagen específica de la variante
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Cambios necesarios:**
1. Mover `stock` de `products` a `product_variants`
2. `order_items` debe referenciar `variant_id` en lugar de solo `product_id`
3. `cart_items` debe referenciar `variant_id`
4. Actualizar todos los triggers de stock para trabajar con variantes

---

## 📊 Funcionalidades Adicionales Recomendadas

### 1. Unidad de Medida

**Problema:** No puedes diferenciar entre "5 unidades" y "5 kg" o "5 packs"

**Solución:**
```sql
-- Agregar a products o product_variants
ALTER TABLE products 
  ADD COLUMN unit VARCHAR(50) DEFAULT 'unidad'; -- 'unidad', 'kg', 'pack', 'litro', etc.
```

**Casos de uso:**
- Productos vendidos por peso (kg, gr)
- Productos vendidos por volumen (litro, ml)
- Productos vendidos por pack (pack de 6, pack de 12)

---

### 2. Stock Mínimo y Alertas

**Problema:** No tienes alertas automáticas cuando el stock está bajo

**Solución:**
```sql
ALTER TABLE products 
  ADD COLUMN min_stock INTEGER DEFAULT 0, -- Stock mínimo antes de alertar
  ADD COLUMN low_stock_threshold INTEGER DEFAULT 10; -- Umbral de stock bajo
```

**Funcionalidad:**
- Dashboard muestra productos con stock bajo
- Alertas automáticas cuando stock < min_stock
- Notificaciones al admin

---

### 3. Historial de Movimientos de Stock

**Problema:** No puedes rastrear cambios de stock (quién, cuándo, por qué)

**Solución:**
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'sale', 'purchase', 'adjustment', 'return', 'cancellation'
  quantity INTEGER NOT NULL, -- Positivo para entrada, negativo para salida
  reference_id UUID, -- ID de orden, compra, ajuste, etc.
  reference_type VARCHAR(50), -- 'order', 'purchase', 'manual', etc.
  notes TEXT,
  created_by UUID REFERENCES auth.users(id), -- Usuario que hizo el movimiento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Beneficios:**
- Auditoría completa de stock
- Rastreo de movimientos
- Reportes de inventario
- Detección de discrepancias

---

### 4. Precio por Variante

**Problema:** Todas las variantes tienen el mismo precio

**Solución:**
- Ya incluido en la tabla `product_variants` (campo `price`)
- Si `price` es NULL, usa el precio del producto padre
- Permite precios diferentes por talle, color, etc.

---

### 5. Imágenes por Variante

**Problema:** No puedes mostrar imágenes específicas por variante (ej: color)

**Solución:**
- Campo `image_url` en `product_variants`
- Si no tiene imagen, usa la del producto padre
- Permite mostrar el color exacto en el catálogo

---

### 6. Atributos de Variante Estructurados

**Problema:** Necesitas manejar diferentes tipos de atributos (talle, color, modelo)

**Solución:**
```sql
-- Ya incluido en product_variants como JSONB
-- Ejemplo de attributes:
{
  "color": "Rojo",
  "size": "M",
  "material": "Algodón",
  "model": "2024"
}
```

**Ventajas:**
- Flexible para diferentes tipos de productos
- Fácil de filtrar y buscar
- Escalable

---

### 7. Stock Reservado (En Carrito)

**Problema:** El stock se reserva solo al crear la orden, no cuando se agrega al carrito

**Solución:**
```sql
ALTER TABLE product_variants 
  ADD COLUMN reserved_stock INTEGER DEFAULT 0; -- Stock reservado en carritos

-- Actualizar lógica:
-- stock_disponible = stock - reserved_stock
-- Al agregar al carrito: reserved_stock += quantity
-- Al crear orden: stock -= quantity, reserved_stock -= quantity
-- Al eliminar del carrito: reserved_stock -= quantity
```

**Beneficios:**
- Evita sobreventa
- Mejor experiencia de usuario
- Stock más preciso

---

### 8. Múltiples Ubicaciones/Almacenes

**Problema:** Si tienes múltiples almacenes, no puedes rastrear stock por ubicación

**Solución:**
```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE variant_warehouse_stock (
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (variant_id, warehouse_id)
);
```

---

### 9. Lotes y Fechas de Vencimiento

**Problema:** Para productos perecederos, necesitas rastrear lotes y fechas

**Solución:**
```sql
CREATE TABLE stock_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  lot_number VARCHAR(100),
  quantity INTEGER NOT NULL,
  expiry_date DATE,
  purchase_date DATE,
  supplier_id UUID, -- Si tienes tabla de proveedores
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 10. Costo y Margen

**Problema:** No puedes calcular márgenes de ganancia sin costo

**Solución:**
```sql
ALTER TABLE product_variants 
  ADD COLUMN cost DECIMAL(10, 2), -- Costo de compra
  ADD COLUMN margin_percentage DECIMAL(5, 2); -- Margen de ganancia calculado
```

---

## 📋 Priorización de Implementación

### 🔴 Fase 1 - CRÍTICO (MVP Sólido):
1. **Sistema de Variantes** - Sin esto, el control de stock es incompleto
2. **Unidad de Medida** - Necesario para diferentes tipos de productos
3. **Stock Mínimo y Alertas** - Básico para gestión de inventario

### 🟡 Fase 2 - IMPORTANTE:
4. **Historial de Movimientos** - Auditoría y trazabilidad
5. **Precio por Variante** - Flexibilidad comercial
6. **Imágenes por Variante** - Mejor experiencia de usuario

### 🟢 Fase 3 - MEJORAS:
7. **Stock Reservado** - Prevención de sobreventa
8. **Múltiples Almacenes** - Escalabilidad
9. **Lotes y Vencimientos** - Para productos perecederos
10. **Costo y Margen** - Análisis financiero

---

## 🛠️ Plan de Implementación Sugerido

### Paso 1: Crear Migración de Variantes
```sql
-- 010_add_product_variants.sql
-- Crear tabla product_variants
-- Migrar stock existente a variantes
-- Actualizar triggers
-- Actualizar RLS policies
```

### Paso 2: Actualizar Código Frontend
- Actualizar `AdminProducts.tsx` para manejar variantes
- Actualizar `ProductDetail.tsx` para mostrar selector de variantes
- Actualizar `cartStore.ts` para trabajar con variant_id
- Actualizar `Checkout.tsx` para validar stock de variantes

### Paso 3: Agregar Funcionalidades Adicionales
- Implementar unidad de medida
- Agregar stock mínimo y alertas
- Crear historial de movimientos

---

## 💡 Recomendación Final

**Para un MVP sólido, implementa mínimo:**
1. ✅ Sistema de Variantes (CRÍTICO)
2. ✅ Unidad de Medida
3. ✅ Stock Mínimo y Alertas

**El resto puede agregarse gradualmente según necesidades del negocio.**

---

## 📚 Recursos Adicionales

- [E-commerce Inventory Management Best Practices](https://www.shopify.com/blog/inventory-management)
- [Multi-variant Product Management](https://help.shopify.com/en/manual/products/variants)
- [Stock Control Systems](https://www.tradegecko.com/learn/inventory-management/stock-control)
