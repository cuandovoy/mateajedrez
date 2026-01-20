# 🏪 Plan de Implementación: Sistema Multi-Sucursal

## 📋 Análisis de Requerimientos

### ¿Qué es un Sistema Multi-Sucursal?

Un sistema multi-sucursal permite gestionar múltiples ubicaciones físicas (tiendas, almacenes, puntos de venta) desde una sola plataforma, donde cada sucursal tiene:
- Inventario independiente
- Personal asignado
- Órdenes asociadas
- Reportes propios
- Configuración específica

---

## 🎯 Funcionalidades Clave a Implementar

### 1. **Gestión de Sucursales**

#### Tabla `stores` (Sucursales)
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,                    -- Nombre de la sucursal
  code VARCHAR(50) UNIQUE NOT NULL,              -- Código único (ej: "SUC-001")
  address TEXT,                                   -- Dirección completa
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Uruguay',
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,               -- Sucursal por defecto
  opening_hours JSONB,                            -- Horarios de atención
  coordinates JSONB,                              -- Lat/Lng para mapas
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Consideraciones:**
- Solo una sucursal puede ser `is_default = true`
- Código único para identificación rápida
- Horarios en JSONB para flexibilidad
- Coordenadas para mapas y cálculo de distancias

---

### 2. **Stock por Sucursal**

#### Tabla `variant_store_stock` (Stock de Variantes por Sucursal)
```sql
CREATE TABLE variant_store_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved_stock INTEGER DEFAULT 0 CHECK (reserved_stock >= 0), -- Stock en carritos
  min_stock INTEGER DEFAULT 0,                    -- Stock mínimo
  low_stock_threshold INTEGER DEFAULT 10,          -- Umbral de stock bajo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(variant_id, store_id)                    -- Una fila por variante/sucursal
);
```

**Consideraciones:**
- Stock independiente por sucursal
- Stock reservado para carritos
- Alertas de stock bajo por sucursal
- Índices para consultas rápidas

#### Migración de Stock Existente
- Crear registros de stock para todas las variantes en la sucursal por defecto
- Mantener compatibilidad con stock a nivel de variante (sin sucursal)

---

### 3. **Asignación de Usuarios a Sucursales**

#### Tabla `user_stores` (Usuarios por Sucursal)
```sql
CREATE TABLE user_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,                      -- 'manager', 'employee', 'viewer'
  is_primary BOOLEAN DEFAULT false,               -- Sucursal principal del usuario
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);
```

**Roles por Sucursal:**
- `manager`: Administrador de la sucursal (puede gestionar stock, órdenes, empleados)
- `employee`: Empleado (puede ver y procesar órdenes)
- `viewer`: Solo lectura (reportes, estadísticas)

**Consideraciones:**
- Un usuario puede pertenecer a múltiples sucursales
- Un usuario tiene una sucursal "primaria" (is_primary = true)
- Super admin puede acceder a todas las sucursales

---

### 4. **Órdenes por Sucursal**

#### Modificar tabla `orders`
```sql
ALTER TABLE orders
  ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  ADD COLUMN pickup_store_id UUID REFERENCES stores(id) ON DELETE SET NULL, -- Para retiro en tienda
  ADD COLUMN delivery_type VARCHAR(50) DEFAULT 'shipping'; -- 'shipping', 'pickup', 'both'
```

**Tipos de Entrega:**
- `shipping`: Envío a domicilio (desde sucursal asignada)
- `pickup`: Retiro en tienda (pickup_store_id)
- `both`: Envío + retiro (casos especiales)

**Asignación de Órdenes:**
- Automática: Por proximidad, stock disponible, carga de trabajo
- Manual: Admin puede asignar/transferir órdenes entre sucursales

---

### 5. **Transferencias entre Sucursales**

#### Tabla `store_transfers` (Transferencias de Stock)
```sql
CREATE TABLE store_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  from_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  to_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) DEFAULT 'pending',           -- 'pending', 'in_transit', 'completed', 'cancelled'
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (from_store_id != to_store_id)
);
```

**Flujo de Transferencia:**
1. Empleado solicita transferencia
2. Manager de sucursal origen aprueba
3. Stock se reserva en origen
4. Stock se incrementa en destino al completar
5. Historial completo de movimientos

---

### 6. **Catálogo Compartido vs. Exclusivo**

#### Opción A: Catálogo Compartido (Recomendado)
- Todos los productos visibles en todas las sucursales
- Stock independiente por sucursal
- Precios pueden variar por sucursal (opcional)

#### Opción B: Catálogo por Sucursal
- Productos asignados a sucursales específicas
- Más complejo de gestionar
- Útil para productos exclusivos por ubicación

**Recomendación:** Empezar con Opción A (catálogo compartido)

---

### 7. **Precios por Sucursal (Opcional)**

#### Tabla `variant_store_prices` (Precios por Sucursal)
```sql
CREATE TABLE variant_store_prices (
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (variant_id, store_id)
);
```

**Consideraciones:**
- Si no hay precio específico, usar precio de la variante
- Permite promociones por sucursal
- Útil para ajustes regionales

---

### 8. **Reportes y Métricas por Sucursal**

#### Dashboard por Sucursal
- Ventas totales de la sucursal
- Productos más vendidos
- Stock bajo
- Órdenes pendientes
- Empleados activos

#### Dashboard Global (Super Admin)
- Comparativa entre sucursales
- Transferencias pendientes
- Rendimiento por sucursal
- Inventario consolidado

---

## 🗄️ Cambios en Base de Datos

### Migraciones Necesarias

1. **013_create_stores.sql**
   - Crear tabla `stores`
   - Crear sucursal por defecto
   - Índices y triggers

2. **014_add_store_stock.sql**
   - Crear tabla `variant_store_stock`
   - Migrar stock existente a sucursal por defecto
   - Actualizar triggers de stock

3. **015_add_user_stores.sql**
   - Crear tabla `user_stores`
   - Asignar usuarios existentes a sucursal por defecto
   - Políticas RLS

4. **016_add_store_to_orders.sql**
   - Agregar `store_id` y `pickup_store_id` a `orders`
   - Migrar órdenes existentes
   - Actualizar triggers

5. **017_create_store_transfers.sql**
   - Crear tabla `store_transfers`
   - Triggers para manejar transferencias

6. **018_add_store_prices.sql** (Opcional)
   - Crear tabla `variant_store_prices`
   - Sistema de precios por sucursal

---

## 🔐 Seguridad y Permisos (RLS)

### Políticas RLS Necesarias

1. **Stores:**
   - Todos pueden ver sucursales activas
   - Solo admins pueden crear/editar/eliminar

2. **Variant Store Stock:**
   - Usuarios ven stock de sus sucursales asignadas
   - Managers pueden actualizar stock de su sucursal
   - Super admin ve todo

3. **Orders:**
   - Usuarios ven órdenes de su sucursal
   - Managers pueden gestionar órdenes de su sucursal
   - Super admin ve todas las órdenes

4. **Store Transfers:**
   - Usuarios ven transferencias de sus sucursales
   - Managers pueden crear/aprobar transferencias

---

## 🎨 Cambios en Frontend

### 1. **Admin - Gestión de Sucursales**

#### Nueva página: `/admin/stores`
- Lista de sucursales
- Crear/editar/eliminar sucursales
- Activar/desactivar sucursales
- Establecer sucursal por defecto

#### Componente: `StoreManager.tsx`
- Formulario de sucursal
- Gestión de horarios
- Mapa para seleccionar ubicación

---

### 2. **Admin - Asignación de Usuarios**

#### Actualizar: `/admin/users`
- Agregar columna "Sucursales"
- Modal para asignar usuarios a sucursales
- Gestión de roles por sucursal

#### Componente: `UserStoreAssignment.tsx`
- Selector de sucursales
- Asignación de roles
- Sucursal principal

---

### 3. **Admin - Stock por Sucursal**

#### Actualizar: `/admin/products` y `VariantManager.tsx`
- Selector de sucursal
- Mostrar stock por sucursal
- Actualizar stock por sucursal
- Alertas de stock bajo por sucursal

#### Nueva vista: `/admin/stores/:id/stock`
- Vista consolidada de stock de una sucursal
- Filtros y búsqueda
- Exportar reporte

---

### 4. **Admin - Transferencias**

#### Nueva página: `/admin/transfers`
- Lista de transferencias
- Crear nueva transferencia
- Aprobar/rechazar transferencias
- Seguimiento de estado

#### Componente: `StoreTransferForm.tsx`
- Seleccionar variante
- Seleccionar sucursales origen/destino
- Cantidad y notas

---

### 5. **Admin - Órdenes por Sucursal**

#### Actualizar: `/admin/orders`
- Filtro por sucursal
- Columna "Sucursal"
- Asignar/transferir órdenes entre sucursales

#### Actualizar: `/admin/orders/:id`
- Mostrar sucursal asignada
- Cambiar sucursal de la orden
- Historial de cambios de sucursal

---

### 6. **Dashboard por Sucursal**

#### Actualizar: `/admin/dashboard`
- Selector de sucursal
- Métricas filtradas por sucursal
- Comparativa entre sucursales (super admin)

#### Componente: `StoreSelector.tsx`
- Dropdown para seleccionar sucursal
- Persistir selección en localStorage
- Mostrar sucursal actual en header

---

### 7. **Tienda - Selección de Sucursal**

#### Actualizar: `ProductDetail.tsx`
- Mostrar disponibilidad por sucursal
- Selector de sucursal para ver stock
- Indicar "Disponible en X sucursales"

#### Actualizar: `Cart.tsx`
- Mostrar sucursal de donde viene cada producto
- Advertencia si productos de diferentes sucursales

#### Actualizar: `Checkout.tsx`
- Seleccionar sucursal para retiro
- Seleccionar método de entrega
- Calcular envío según sucursal

---

## 🔄 Flujo de Trabajo

### Flujo 1: Compra con Retiro en Tienda
1. Cliente selecciona productos
2. Selecciona "Retiro en tienda"
3. Elige sucursal para retiro
4. Sistema valida stock en esa sucursal
5. Crea orden con `pickup_store_id`
6. Sucursal prepara pedido
7. Cliente retira en sucursal

### Flujo 2: Compra con Envío
1. Cliente selecciona productos
2. Selecciona "Envío a domicilio"
3. Sistema asigna orden a sucursal (por stock/proximidad)
4. Crea orden con `store_id`
5. Sucursal prepara y envía

### Flujo 3: Transferencia de Stock
1. Manager detecta stock bajo
2. Solicita transferencia desde otra sucursal
3. Manager de sucursal origen aprueba
4. Stock se reserva en origen
5. Transferencia física
6. Manager destino confirma recepción
7. Stock se actualiza automáticamente

---

## 📊 Consideraciones de Performance

### Índices Necesarios
```sql
CREATE INDEX idx_variant_store_stock_store ON variant_store_stock(store_id);
CREATE INDEX idx_variant_store_stock_variant ON variant_store_stock(variant_id);
CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_user_stores_user ON user_stores(user_id);
CREATE INDEX idx_user_stores_store ON user_stores(store_id);
```

### Consultas Optimizadas
- Cachear stock por sucursal
- Agregaciones pre-calculadas para reportes
- Paginación en listados grandes

---

## 🚀 Plan de Implementación por Fases

### **Fase 1: Base de Datos (Semana 1)**
- ✅ Crear migraciones 013-018
- ✅ Aplicar migraciones
- ✅ Crear sucursal por defecto
- ✅ Migrar datos existentes
- ✅ Verificar integridad

### **Fase 2: Gestión de Sucursales (Semana 2)**
- ✅ Crear `/admin/stores`
- ✅ CRUD de sucursales
- ✅ Selector de sucursal en admin
- ✅ Asignación de usuarios a sucursales

### **Fase 3: Stock por Sucursal (Semana 3)**
- ✅ Actualizar `VariantManager` para stock por sucursal
- ✅ Vista de stock consolidado
- ✅ Alertas de stock bajo por sucursal
- ✅ Actualizar triggers de stock

### **Fase 4: Órdenes por Sucursal (Semana 4)**
- ✅ Agregar `store_id` a órdenes
- ✅ Asignación automática de órdenes
- ✅ Filtros por sucursal en admin
- ✅ Transferencia de órdenes

### **Fase 5: Transferencias (Semana 5)**
- ✅ Crear sistema de transferencias
- ✅ Aprobación de transferencias
- ✅ Actualización automática de stock
- ✅ Historial de transferencias

### **Fase 6: Tienda Pública (Semana 6)**
- ✅ Selector de sucursal en tienda
- ✅ Mostrar disponibilidad por sucursal
- ✅ Retiro en tienda en checkout
- ✅ Validación de stock por sucursal

### **Fase 7: Reportes y Dashboard (Semana 7)**
- ✅ Dashboard por sucursal
- ✅ Comparativa entre sucursales
- ✅ Reportes de transferencias
- ✅ Métricas consolidadas

### **Fase 8: Testing y Ajustes (Semana 8)**
- ✅ Testing completo
- ✅ Corrección de bugs
- ✅ Optimización de performance
- ✅ Documentación

---

## ⚠️ Consideraciones Importantes

### 1. **Migración de Datos Existentes**
- Crear sucursal "Principal" o "Online"
- Asignar todo el stock existente a esta sucursal
- Asignar usuarios existentes a esta sucursal
- Asignar órdenes existentes a esta sucursal

### 2. **Compatibilidad Hacia Atrás**
- Mantener stock a nivel de variante para productos sin sucursal
- Si no hay `store_id` en orden, usar sucursal por defecto
- Validar stock en sucursal por defecto si no se especifica

### 3. **Asignación Automática de Órdenes**
- Algoritmo simple: Sucursal con más stock disponible
- Algoritmo avanzado: Proximidad + stock + carga de trabajo
- Permitir asignación manual siempre

### 4. **Stock Reservado**
- Reservar stock al agregar al carrito (opcional, complejo)
- Reservar stock solo al crear orden (más simple, recomendado)

### 5. **Precios por Sucursal**
- Implementar solo si es necesario
- Puede agregarse después sin afectar funcionalidad base

---

## 📝 Checklist de Implementación

### Base de Datos
- [ ] Tabla `stores` creada
- [ ] Tabla `variant_store_stock` creada
- [ ] Tabla `user_stores` creada
- [ ] Tabla `store_transfers` creada
- [ ] Columnas agregadas a `orders`
- [ ] Migraciones aplicadas
- [ ] Datos existentes migrados
- [ ] RLS policies configuradas
- [ ] Índices creados
- [ ] Triggers actualizados

### Backend/Admin
- [ ] CRUD de sucursales
- [ ] Asignación de usuarios
- [ ] Gestión de stock por sucursal
- [ ] Sistema de transferencias
- [ ] Asignación de órdenes
- [ ] Dashboard por sucursal
- [ ] Reportes por sucursal

### Frontend/Tienda
- [ ] Selector de sucursal
- [ ] Disponibilidad por sucursal
- [ ] Retiro en tienda
- [ ] Validación de stock
- [ ] Checkout con sucursal

### Testing
- [ ] Testing de stock por sucursal
- [ ] Testing de transferencias
- [ ] Testing de órdenes
- [ ] Testing de permisos
- [ ] Testing de performance

---

## 🎯 Recomendación Final

**Empezar con MVP (Mínimo Producto Viable):**
1. Una sucursal por defecto (existente)
2. Stock por sucursal básico
3. Asignación manual de órdenes
4. Selector de sucursal en admin

**Luego agregar:**
- Transferencias
- Asignación automática
- Precios por sucursal
- Reportes avanzados

Esto permite implementar gradualmente sin romper funcionalidad existente.

---

## 📚 Recursos Adicionales

- [Multi-Store E-commerce Architecture](https://www.shopify.com/plus/solutions/multi-store)
- [Inventory Management Best Practices](https://www.tradegecko.com/learn/inventory-management)
- [PostgreSQL Multi-Tenant Patterns](https://www.postgresql.org/docs/current/ddl-partitioning.html)
