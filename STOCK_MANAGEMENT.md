# Sistema de Gestión de Stock

Este documento describe cómo funciona el sistema de gestión de stock en la aplicación e-commerce.

## 📋 Resumen del Sistema

El sistema de stock está implementado en múltiples capas para garantizar la integridad de los datos y una buena experiencia de usuario.

## 🔄 Flujo de Descuento de Stock

### 1. **Trigger Automático en Base de Datos** (Nivel 1 - Más Seguro)

**Archivo:** `supabase/migrations/007_add_payment_method.sql`

- **Función:** `decrement_product_stock()`
- **Trigger:** `decrement_stock_on_order_item`
- **Cuándo se ejecuta:** Automáticamente cuando se inserta un `order_item`
- **Qué hace:**
  - Verifica que el producto exista
  - Valida que haya stock suficiente
  - Descuenta el stock automáticamente
  - Lanza error si no hay stock suficiente

**Ventajas:**
- ✅ Garantiza que el stock siempre se descuenta
- ✅ Previene condiciones de carrera
- ✅ No se puede omitir desde la aplicación

### 2. **Validación en Checkout** (Nivel 2 - Prevención)

**Archivo:** `src/pages/Checkout.tsx`

- **Cuándo se ejecuta:** Antes de crear la orden
- **Qué hace:**
  - Consulta el stock actual de todos los productos en el carrito
  - Valida que haya stock suficiente para cada producto
  - Verifica que los productos estén activos
  - Muestra mensajes de error específicos si hay problemas
  - Recarga el carrito si hay problemas de stock

**Ventajas:**
- ✅ Evita crear órdenes que fallarán
- ✅ Mejor experiencia de usuario (mensajes claros)
- ✅ Previene errores antes de llegar a la base de datos

### 3. **Validación al Agregar al Carrito** (Nivel 3 - UX)

**Archivo:** `src/store/cartStore.ts`

- **Cuándo se ejecuta:** Cuando el usuario agrega un producto al carrito
- **Qué hace:**
  - Verifica stock disponible antes de agregar
  - Considera la cantidad ya en el carrito
  - Muestra mensajes de error si no hay stock
  - Previene agregar más de lo disponible

**Ventajas:**
- ✅ Evita que el usuario agregue productos sin stock
- ✅ Feedback inmediato
- ✅ Mejora la experiencia de usuario

### 4. **Validación en el Carrito** (Nivel 4 - Monitoreo)

**Archivo:** `src/pages/Cart.tsx`

- **Cuándo se ejecuta:** Cuando se carga o actualiza el carrito
- **Qué hace:**
  - Valida el stock de todos los productos en el carrito
  - Muestra advertencias visuales si hay problemas
  - Deshabilita el botón de checkout si hay problemas
  - Muestra stock disponible para cada producto

**Ventajas:**
- ✅ El usuario siempre sabe el estado del stock
- ✅ Previene sorpresas en el checkout
- ✅ Permite ajustar cantidades antes de proceder

## 🔄 Restauración de Stock

### Cuando se Cancela una Orden

**Archivo:** `supabase/migrations/008_improve_stock_management.sql`

- **Función:** `restore_product_stock()`
- **Trigger:** `restore_stock_on_order_cancellation`
- **Cuándo se ejecuta:** Cuando una orden cambia de estado a "cancelled"
- **Qué hace:**
  - Restaura el stock de todos los productos de la orden
  - Solo se ejecuta si el estado anterior NO era "cancelled" (evita duplicados)

**Ventajas:**
- ✅ El stock se restaura automáticamente
- ✅ No requiere intervención manual
- ✅ Previene pérdida de stock por órdenes canceladas

## 📊 Funciones de Utilidad

### `check_stock_availability(product_id, quantity)`

Verifica si hay stock disponible para un producto específico.

```sql
SELECT check_stock_availability('product-uuid', 5);
-- Retorna: true o false
```

### `get_products_stock(product_ids[])`

Obtiene el stock disponible de múltiples productos.

```sql
SELECT * FROM get_products_stock(ARRAY['uuid1', 'uuid2']);
-- Retorna: product_id, available_stock, is_available
```

## 🎯 Mejores Prácticas

### Para Desarrolladores

1. **Siempre validar stock antes de operaciones críticas**
   - Al agregar al carrito
   - Antes del checkout
   - Al actualizar cantidades

2. **Usar el trigger de base de datos como última línea de defensa**
   - No confiar solo en validaciones del frontend
   - El trigger garantiza integridad

3. **Manejar errores de stock graciosamente**
   - Mostrar mensajes claros al usuario
   - Ofrecer alternativas (ajustar cantidad, eliminar producto)
   - Recargar el carrito para mostrar estado actualizado

### Para Administradores

1. **Monitorear stock bajo**
   - El dashboard muestra productos con stock bajo
   - Revisar regularmente y reabastecer

2. **Cancelar órdenes cuando sea necesario**
   - El stock se restaurará automáticamente
   - No es necesario ajustar stock manualmente

3. **Actualizar stock desde el panel de administración**
   - Los cambios se reflejan inmediatamente
   - El sistema validará automáticamente

## ⚠️ Casos Especiales

### Stock Negativo

- **NO está permitido** por el trigger de base de datos
- Si se intenta, la orden fallará con un error claro
- El usuario verá un mensaje y deberá ajustar su carrito

### Múltiples Usuarios Comprando el Mismo Producto

- El trigger de base de datos previene condiciones de carrera
- La primera orden que se complete tendrá el stock
- Las siguientes fallarán si no hay stock suficiente
- El sistema mostrará un error claro

### Órdenes Pendientes

- El stock se descuenta **inmediatamente** al crear la orden
- No hay "reserva temporal" de stock
- Si una orden se cancela, el stock se restaura automáticamente

## 🔧 Migraciones Aplicadas

1. **007_add_payment_method.sql**
   - Trigger para descontar stock automáticamente
   - Validación de stock antes de descontar

2. **008_improve_stock_management.sql**
   - Función para restaurar stock al cancelar
   - Funciones de utilidad para verificar stock

## 📝 Notas Importantes

- El stock se descuenta **al crear la orden**, no al pagar
- Esto previene que múltiples usuarios compren el último producto
- Si una orden se cancela, el stock se restaura automáticamente
- Las validaciones en el frontend mejoran la UX pero no reemplazan la validación de la BD
