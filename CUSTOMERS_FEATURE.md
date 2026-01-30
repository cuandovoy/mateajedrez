# Gestión de Clientes - Sistema Completo

## ✅ Cambios Realizados

### 1. **Base de Datos - Migración 031**
Archivo: `supabase/migrations/031_add_customers_table.sql`

- **Tabla `customers`**: Gestiona todos los clientes (registrados y guests)
  - `id`: UUID primario
  - `user_id`: Referencia opcional a auth.users
  - `email`: Email opcional
  - `full_name`: Nombre completo (obligatorio)
  - `phone`: Teléfono (único, obligatorio)
  - `address`: JSONB con dirección completa
  - `notes`: Notas adicionales
  - `is_active`: Estado del cliente
  - Timestamps: `created_at`, `updated_at`

- **Índices**: phone, user_id, email para búsquedas rápidas
- **RLS Policies**: Control de acceso basado en permisos
- **Permisos RBAC**: 
  - `customers:view` - Ver clientes
  - `customers:create` - Crear clientes
  - `customers:edit` - Editar clientes
  - `customers:delete` - Eliminar clientes
  - `customers:export` - Exportar clientes

### 2. **Tipos TypeScript**
Archivo: `src/types/database.types.ts`

- Agregadas definiciones de tipos `Customer`, `CustomerInsert`, `CustomerUpdate`
- Actualizado tipo `Order` con campo `customer_id`
- Exportadas nuevas funciones de tipo

### 3. **Permisos RBAC Actualizados**
Archivo: `src/lib/permissions.ts`

**Nuevas Categoría de Permisos**: `customers`

**Asignaciones por Rol**:
- **Admin**: Todos los permisos de clientes (view, create, edit, delete, export)
- **Manager**: view, create, edit (no delete, no export)
- **Viewer**: Solo view
- **User**: Sin acceso a gestión de clientes

### 4. **Componente Admin Customers**
Archivo: `src/pages/admin/AdminCustomers.tsx`

**Características**:
- ✅ **Listar clientes** con búsqueda (nombre, teléfono, email)
- ✅ **Crear clientes** vía formulario
- ✅ **Editar clientes** existentes
- ✅ **Eliminar clientes** con confirmación
- ✅ **Vista de tabla** con:
  - Nombre del cliente
  - Contacto (teléfono + email)
  - Dirección (calle, ciudad, provincia)
  - Fecha de registro
  - Acciones (editar/eliminar)
- ✅ **Formulario completo** con:
  - Nombre, email, teléfono (obligatorios)
  - Dirección (opcional): calle, ciudad, provincia, código postal, país
  - Notas adicionales

### 5. **Integración en App**
Archivo: `src/App.tsx`

- Importado `AdminCustomers`
- Agregada ruta: `/admin/customers` → `<AdminCustomers />`

### 6. **Menú Admin actualizado**
Archivo: `src/components/layout/AdminLayout.tsx`

- Agregado link **"Clientes"** en sección "Operaciones"
- Icono: `Users2`
- Permiso requerido: `customers:view`
- Solo visible para usuarios con permiso

### 7. **Flujo de Checkout actualizado**
Archivo: `src/pages/Checkout.tsx`

**Cambios**:
- Elimina creación de `user_profiles` al confirmar orden
- **Crea o actualiza `customers`** automáticamente:
  - Busca por teléfono (único)
  - Si existe: actualiza si es nuevo usuario registrado
  - Si no existe: crea nuevo customer
- Linkea orden a `customer_id` creado
- Flujo limpio sin duplicados

## 📊 Estructura de Datos

### Tabla: `customers`
```sql
- id (UUID)
- user_id (UUID, nullable) → auth.users
- email (string, nullable)
- full_name (string) ✓ obligatorio
- phone (string, unique) ✓ obligatorio
- address (JSON)
  - address: string
  - city: string
  - state: string
  - zipCode: string
  - country: string
- notes (text)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### Relaciones
```
customers (1) ──→ (many) orders
customers (0..1) ──→ (1) auth.users
```

## 🔐 Permisos RBAC

| Permiso | Admin | Manager | Viewer | User |
|---------|-------|---------|--------|------|
| customers:view | ✅ | ✅ | ✅ | ❌ |
| customers:create | ✅ | ✅ | ❌ | ❌ |
| customers:edit | ✅ | ✅ | ❌ | ❌ |
| customers:delete | ✅ | ❌ | ❌ | ❌ |
| customers:export | ✅ | ❌ | ❌ | ❌ |

## 🚀 Próximos Pasos

1. **Ejecutar migración 031** en Supabase
   ```sql
   -- En Supabase SQL Editor
   -- Pega el contenido de supabase/migrations/031_add_customers_table.sql
   ```

2. **Regenerar tipos**
   ```bash
   yarn generate-types
   ```

3. **Opcional**: Crear vista de análisis de clientes (cantidad de órdenes por cliente, monto total gastado, etc.)

4. **Opcional**: Exportar clientes a CSV (usar permiso `customers:export`)

## 📝 Notas Importantes

- El teléfono es **único** por cliente (previene duplicados)
- Los clientes guests se crean automáticamente en checkout
- Un usuario registrado puede tener múltiples números de teléfono (creando múltiples customer records)
- El campo `user_id` permite vincular clientes a usuarios autenticados
- RLS policies permiten solo acceso según permisos
- Sistema escalable para futuras funcionalidades (CRM, historial de compras, etc.)
