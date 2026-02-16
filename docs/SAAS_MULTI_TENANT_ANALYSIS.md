# Análisis: Conversión a SaaS Multi-Tenant (Marca Blanca)

## Resumen Ejecutivo

Este documento analiza los cambios necesarios para transformar el sistema de control de stock actual (single-tenant) en un **SaaS multi-tenant tipo marca blanca**, donde múltiples organizaciones/negocios comparten la misma instancia de Supabase, cada una con sus datos completamente aislados.

---

## 1. Estado Actual del Sistema

### 1.1 Arquitectura Actual (Single-Tenant)

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (1 instancia)                     │
├─────────────────────────────────────────────────────────────┤
│  auth.users          │  Todas las tablas de negocio         │
│  user_profiles       │  (sin aislamiento por organización)  │
│  products, orders... │  Todos ven los mismos datos           │
└─────────────────────────────────────────────────────────────┘
```

**Características actuales:**
- **Usuario único**: Un usuario = un perfil con rol (admin, manager, viewer, user)
- **Sin concepto de organización**: Todos los datos son globales
- **RLS**: Basado en `auth.uid()` y `user_profiles.role`
- **Storage**: Buckets compartidos (`product-images`, `category-images`)
- **Branches**: Sucursales sin asociación a organización

### 1.2 Tablas Existentes (sin organization_id)

| Tabla | Propósito | Cambio Requerido |
|-------|-----------|------------------|
| `categories` | Categorías de productos | + organization_id |
| `products` | Productos | + organization_id |
| `product_variants` | Variantes | Hereda de products |
| `product_images` | Imágenes | Hereda de products |
| `product_barcodes` | Códigos de barras | Hereda de products |
| `suppliers` | Proveedores | + organization_id |
| `product_suppliers` | Relación producto-proveedor | Hereda |
| `cart_items` | Carrito | + organization_id (user_id ya existe) |
| `orders` | Órdenes | + organization_id |
| `order_items` | Items de orden | Hereda de orders |
| `user_profiles` | Perfiles de usuario | **Cambio estructural** |
| `branches` | Sucursales | + organization_id |
| `branch_inventory` | Inventario por sucursal | Hereda de branches |
| `cash_sessions` | Sesiones de caja | Hereda de branches |
| `order_payments` | Pagos | Hereda de orders |
| `customers` | Clientes | + organization_id |
| `audit_logs` | Auditoría | + organization_id |
| `inventory_movements` | Movimientos | Hereda de branch_inventory |
| `inventory_transfers` | Transferencias | Hereda de branches |
| `roles` | Roles del sistema | Global o por org |
| `permissions` | Permisos | Global |
| `roles_permissions` | Relación rol-permiso | Global |
| `user_permissions` | Permisos individuales | + organization_id |
| `rbac_audit_log` | Log RBAC | + organization_id |

---

## 2. Modelo de Datos Propuesto

### 2.1 Nuevas Tablas

```sql
-- Organizaciones (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,        -- Para URLs: app.com/org-slug
  logo_url TEXT,
  primary_color VARCHAR(7),                   -- Marca blanca: color principal
  custom_domain VARCHAR(255) UNIQUE,          -- Opcional: tienda.miempresa.com
  settings JSONB DEFAULT '{}',                -- Config flexible
  subscription_tier VARCHAR(50) DEFAULT 'free',  -- free, starter, pro, enterprise
  subscription_status VARCHAR(50) DEFAULT 'active',  -- active, suspended, cancelled
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios pueden pertenecer a múltiples organizaciones
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',  -- admin, manager, viewer, user
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Configuración por organización (white-label)
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  store_name VARCHAR(255),
  store_logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  support_email VARCHAR(255),
  custom_css TEXT,                           -- Para personalización avanzada
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suscripciones/Membresías (para modelo de negocio)
CREATE TABLE organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL,               -- starter, pro, enterprise
  status VARCHAR(50) DEFAULT 'active',       -- active, past_due, cancelled
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  stripe_subscription_id VARCHAR(255),        -- Si usas Stripe
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Cambios en Tablas Existentes

**Patrón de migración:** Agregar `organization_id` a todas las tablas de negocio.

```sql
-- Ejemplo para products
ALTER TABLE products ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_products_organization_id ON products(organization_id);

-- Todas las queries deben incluir: .eq('organization_id', currentOrgId)
```

**Tablas que requieren `organization_id` directo:**
- categories
- products  
- suppliers
- branches
- customers
- orders
- cart_items
- audit_logs
- user_profiles → **Reemplazar por organization_members** (un usuario puede ser admin en Org A y viewer en Org B)

### 2.3 Decisión Crítica: user_profiles

**Opción A - Mantener user_profiles + organization_id (simple):**
- Un usuario solo puede pertenecer a UNA organización
- Más simple pero menos flexible

**Opción B - organization_members (recomendado):**
- Un usuario puede pertenecer a MÚLTIPLES organizaciones con diferentes roles
- Ej: Consultor que administra 3 negocios
- Permite "cambiar de organización" sin cambiar de cuenta

---

## 3. Cambios por Capa

### 3.1 Base de Datos (Supabase)

#### 3.1.1 Migraciones SQL

1. **Crear tabla `organizations`** con datos iniciales
2. **Crear tabla `organization_members`**
3. **Migrar datos existentes**: Crear 1 organización "default", asignar todos los user_profiles
4. **Agregar `organization_id`** a cada tabla (en orden de dependencias)
5. **Actualizar RLS** en TODAS las tablas para incluir:
   ```sql
   -- Ejemplo: products
   CREATE POLICY "Users see org products"
     ON products FOR SELECT
     USING (
       organization_id IN (
         SELECT organization_id FROM organization_members 
         WHERE user_id = auth.uid()
       )
     );
   ```
6. **Crear función helper** para RLS:
   ```sql
   CREATE OR REPLACE FUNCTION get_user_organization_ids()
   RETURNS SETOF UUID AS $$
     SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
   $$ LANGUAGE sql STABLE;
   ```

#### 3.1.2 RLS - Políticas Multi-Tenant

Todas las políticas deben cambiar de:
```sql
-- Antes (admin global)
USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin'))
```

A:
```sql
-- Después (admin en la organización)
USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = products.organization_id  -- tabla específica
    AND role IN ('admin', 'manager')
  )
)
```

#### 3.1.3 Storage (Supabase Storage)

**Opción 1 - Path por organización (recomendado):**
```
product-images/
  {organization_id}/
    {product_id}-{hash}.jpg
```

**Opción 2 - Buckets por organización:**
- Crear bucket dinámicamente: `product-images-{org_id}`
- Más complejo, requiere RLS en storage

**Cambios en `storage.ts`:**
```typescript
// Antes
const filePath = `${fileName}`

// Después  
const filePath = `${organizationId}/${productId || Date.now()}-${hash}.${fileExt}`
```

Y agregar **Storage RLS policies** para que cada org solo acceda a sus archivos.

### 3.2 Frontend (React)

#### 3.2.1 Nuevo Context/Store: OrganizationContext

```typescript
// store/organizationStore.ts
interface OrganizationState {
  currentOrganization: Organization | null
  organizations: Organization[]  // Organizaciones del usuario
  setCurrentOrganization: (org: Organization) => void
  fetchOrganizations: () => Promise<void>
}
```

#### 3.2.2 Flujo de Autenticación

1. **Login** → Obtener organizaciones del usuario
2. **Si tiene 1 org** → Auto-seleccionar
3. **Si tiene múltiples** → Mostrar selector, guardar en localStorage
4. **Si no tiene ninguna** → Redirigir a "Crear organización" o "Unirse a organización"

#### 3.2.3 Cambios en Queries

**Antes:**
```typescript
const { data } = await supabase.from('products').select('*')
```

**Después:**
```typescript
const orgId = useOrganizationStore.getState().currentOrganization?.id
if (!orgId) throw new Error('No organization selected')
const { data } = await supabase.from('products').select('*').eq('organization_id', orgId)
```

**Solución elegante:** Crear un hook o wrapper:
```typescript
// hooks/useOrgQuery.ts
export function useProducts() {
  const orgId = useOrganizationStore(s => s.currentOrganization?.id)
  return useQuery({
    queryKey: ['products', orgId],
    queryFn: () => supabase.from('products').select('*').eq('organization_id', orgId!)
  })
}
```

#### 3.2.4 Componentes a Modificar

| Componente | Cambio |
|------------|--------|
| `authStore` | Agregar `fetchOrganizations()`, `currentOrganization` |
| `AdminLayout` | Selector de organización en header |
| `ProtectedRoute` | Verificar membresía en org actual |
| Todas las páginas admin | Pasar/pasar org_id a queries |
| `storage.ts` | Incluir org_id en paths |
| `Checkout` | Filtrar branches por org |
| `Login` | Redirigir a selector de org si múltiples |

#### 3.2.5 Routing

**Opción A - Path-based (recomendado para inicio):**
```
app.com/                    → Landing
app.com/login               → Login
app.com/dashboard           → Requiere org en context
app.com/org/mi-tienda/admin → Org en URL (más explícito)
```

**Opción B - Subdomain:**
```
mi-tienda.app.com  → Resolver org por subdomain
```
Requiere configuración DNS wildcard y middleware.

### 3.3 API/Queries - Resumen de Archivos

Archivos que hacen queries a Supabase y necesitan `organization_id`:

- `src/pages/admin/AdminProducts.tsx`
- `src/pages/admin/AdminCategories.tsx`
- `src/pages/admin/AdminSuppliers.tsx`
- `src/pages/admin/AdminInventory.tsx`
- `src/pages/admin/AdminBranches.tsx`
- `src/pages/admin/AdminOrders.tsx`
- `src/pages/admin/AdminCustomers.tsx`
- `src/pages/admin/AdminUsers.tsx`
- `src/pages/admin/AdminCashRegister.tsx`
- `src/pages/admin/AdminTransfers.tsx`
- `src/pages/admin/AdminSales.tsx`
- `src/pages/admin/AdminAuditLogs.tsx`
- `src/pages/admin/AdminRolesPermissions.tsx`
- `src/pages/Checkout.tsx`
- `src/pages/Home.tsx` (productos públicos)
- `src/pages/Products.tsx`
- `src/pages/Cart.tsx`
- `src/store/cartStore.ts`
- `src/hooks/useUserManagement.ts`
- `src/lib/storage.ts`

---

## 4. Frontend de Pedidos (Proyecto Separado)

Tu idea: *"luego en otro proyecto conectar un frontend enfocado solamente en hacer pedidos"*

### 4.1 Arquitectura Recomendada

```
┌──────────────────────────────────────────────────────────────────┐
│                     MISMO SUPABASE                                │
├──────────────────────────────────────────────────────────────────┤
│  organizations │ products │ orders │ customers │ branch_inventory  │
└──────────────────────────────────────────────────────────────────┘
        │                    │                        │
        ▼                    ▼                        ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────────┐
│  App Admin    │   │  App Pedidos    │   │  App Super Admin    │
│  (este repo)  │   │  (nuevo repo)   │   │  (opcional)         │
│               │   │                 │   │                     │
│  - Stock      │   │  - Catálogo     │   │  - Gestión de orgs   │
│  - Inventario │   │  - Carrito      │   │  - Facturación       │
│  - Órdenes    │   │  - Checkout     │   │  - Suscripciones     │
│  - Usuarios   │   │  - Solo lectura │   │                     │
└───────────────┘   └─────────────────┘   └─────────────────────┘
```

### 4.2 App de Pedidos - Consideraciones

1. **Identificación de organización:**
   - Por subdominio: `pedidos.mi-tienda.com` → resolver org
   - Por path: `app.com/tienda/mi-negocio` 
   - Por custom domain: `tienda.miempresa.com` → org tiene custom_domain

2. **Auth en app de pedidos:**
   - Clientes (customers) pueden ser guest o registrados
   - Usar mismo `auth.users` de Supabase
   - RLS filtra por `organization_id` automáticamente

3. **Datos que necesita el frontend de pedidos:**
   - products (activos, con stock)
   - categories
   - product_variants
   - branch_inventory (para ver disponibilidad)
   - customers (crear/actualizar en checkout)
   - orders, order_items (insertar)

4. **White-label en frontend de pedidos:**
   - Cargar `organization_settings` (logo, colores)
   - Aplicar estilos dinámicamente
   - Meta tags para SEO por tienda

---

## 5. Modelo de Negocio - Sugerencias

### 5.1 Estructura de Membresías Típica

| Plan | Precio/mes | Límites | Ideal para |
|------|------------|---------|------------|
| **Free** | $0 | 1 sucursal, 50 productos, 100 órdenes/mes | Probar el sistema |
| **Starter** | $29-49 | 2 sucursales, 500 productos, 1000 órdenes | Pequeño negocio |
| **Pro** | $79-99 | 5 sucursales, productos ilimitados | Negocio en crecimiento |
| **Enterprise** | Custom | Ilimitado, custom domain, soporte | Grandes operaciones |

### 5.2 Métricas a Limitar por Plan

- **Sucursales** (branches)
- **Productos** activos
- **Órdenes** por mes
- **Usuarios** por organización
- **Almacenamiento** (imágenes)
- **Custom domain** (solo Pro+)

### 5.3 Implementación de Límites

```sql
-- Función para verificar límites antes de insertar
CREATE OR REPLACE FUNCTION check_organization_limit(
  p_org_id UUID,
  p_limit_type VARCHAR,  -- 'branches', 'products', 'orders_month'
  p_current_count INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_limit INT;
  v_tier VARCHAR;
BEGIN
  SELECT subscription_tier INTO v_tier 
  FROM organizations WHERE id = p_org_id;
  
  v_limit := CASE v_tier
    WHEN 'free' THEN CASE p_limit_type
      WHEN 'branches' THEN 1
      WHEN 'products' THEN 50
      WHEN 'orders_month' THEN 100
    END
    WHEN 'starter' THEN CASE p_limit_type
      WHEN 'branches' THEN 2
      WHEN 'products' THEN 500
      WHEN 'orders_month' THEN 1000
    END
    -- ...
  END;
  
  RETURN p_current_count < v_limit;
END;
$$ LANGUAGE plpgsql;
```

### 5.4 Opciones de Monetización

1. **Suscripción mensual/anual** (más predecible)
2. **Por transacción** (% de cada venta) - común en e-commerce
3. **Híbrido** (base + % sobre cierto volumen)
4. **White-label premium** (pago extra por custom domain, quitar branding)

### 5.5 Integración de Pagos

- **Stripe** o **Mercado Pago** para suscripciones
- Tabla `organization_subscriptions` para estado
- Webhooks para actualizar `subscription_status` cuando hay pago/cancelación

---

## 6. Plan de Implementación Sugerido

### Fase 1: Fundación (2-3 semanas)
1. Crear migraciones: `organizations`, `organization_members`
2. Migrar datos existentes a 1 organización default
3. Agregar `organization_id` a tablas críticas (products, categories, orders, branches)
4. Actualizar RLS en esas tablas
5. Crear `organizationStore` y selector de org en frontend

### Fase 2: Aislamiento Completo (2 semanas)
1. Agregar `organization_id` a tablas restantes
2. Actualizar todas las queries del frontend
3. Modificar storage para paths por org
4. Testing de aislamiento (crear 2 orgs, verificar que no se ven datos cruzados)

### Fase 3: Onboarding (1 semana)
1. Flujo "Crear organización" para nuevos usuarios
2. Invitaciones a organizaciones (opcional)
3. Página de configuración de organización (logo, colores)

### Fase 4: Membresías (2 semanas)
1. Tabla `organization_subscriptions`
2. Integración Stripe/MercadoPago
3. Límites por plan (middleware o triggers)
4. Dashboard de facturación

### Fase 5: Frontend de Pedidos (paralelo)
1. Nuevo proyecto React/Next.js
2. Resolución de org por subdomain/path
3. Cargar organization_settings para white-label
4. Reutilizar lógica de checkout

---

## 7. Riesgos y Consideraciones

### 7.1 Seguridad
- **Crítico**: Un bug en RLS podría exponer datos entre organizaciones
- **Mitigación**: Tests automatizados que intenten acceder a datos de otra org
- **Auditoría**: Revisar cada política RLS manualmente

### 7.2 Performance
- Índices en `organization_id` en todas las tablas
- Considerar particionamiento por org si crece mucho (futuro)

### 7.3 Migración de Datos Existentes
- Crear script que: 1) cree org "Legacy", 2) asigne todos los users, 3) actualice todos los registros con organization_id

### 7.4 Rollback
- Mantener migraciones reversibles
- Backup antes de migración masiva

---

## 8. Checklist Final

- [ ] Tabla `organizations` creada
- [ ] Tabla `organization_members` creada  
- [ ] Migración de datos existentes
- [ ] `organization_id` en todas las tablas de negocio
- [ ] RLS actualizado en todas las tablas
- [ ] Storage con paths por org
- [ ] organizationStore en frontend
- [ ] Selector de organización en UI
- [ ] Todas las queries filtran por org
- [ ] Flujo de creación de organización
- [ ] Tabla de suscripciones
- [ ] Integración de pagos
- [ ] Límites por plan
- [ ] Documentación de API para frontend de pedidos

---

*Documento generado para el proyecto ecommerce-supabase. Última actualización: Febrero 2025.*
