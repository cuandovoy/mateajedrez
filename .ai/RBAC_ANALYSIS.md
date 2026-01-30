# 🔐 Análisis & Propuesta RBAC (Role-Based Access Control)

**Análisis del Sistema Actual + Propuesta Escalable**  
**Fecha**: 29 de enero de 2026

---

## 📊 SITUACIÓN ACTUAL

### ✅ Lo que Está Bien

1. **RLS en BD** ✓
   - Implementado en todas las tablas principales
   - Policies específicas por operación (SELECT, INSERT, UPDATE, DELETE)
   - Validación en servidor (segura)

2. **Estructura Base**
   - `user_profiles` tabla con campo `role: 'user' | 'admin'`
   - `authStore` con `isAdmin` flag
   - `ProtectedRoute` para verificar acceso a rutas

3. **Tipos TypeScript**
   - Estructura en `database.types.ts`
   - Tipos reutilizables

### ❌ Limitaciones Actuales

1. **Solo 2 Roles** (User vs Admin)
   - Binario: `isAdmin: true/false`
   - No hay permisos granulares
   - No escalable para nuevos roles

2. **No Hay Permiso Específicos**
   - No puedes permitir que Admin A acceda a X pero no a Y
   - No hay noción de "permisos individuales"
   - Solo "eres admin o no lo eres"

3. **Validación Descentralizada**
   - Checks de `isAdmin` esparcidos en componentes
   - Sin ubicación central de reglas
   - Difícil mantener consistencia

4. **RLS Repetitivo**
   - Cada tabla repite la misma lógica de "is admin?"
   - Si agregas un rol nuevo, hay que updatear todas las policies

5. **No Hay Auditoría de Permisos**
   - No se registra quién intentó acceder a qué
   - No se pueden ver permisos asignados por usuario

---

## 🎯 PROPUESTA ESCALABLE

### Arquitectura: 3 Capas

```
┌─────────────────────────────────────────┐
│ Frontend (React Components)              │
│ - usePermission() hook                   │
│ - PermissionGate component               │
│ - Protected routes                       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ Permiso Service (Aplicación)            │
│ - Definir permisos por rol              │
│ - Checks de permiso                      │
│ - Caché local                            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ Supabase (BD + RLS)                      │
│ - Tabla: user_permissions                │
│ - Tabla: roles (si existe)               │
│ - RLS policies por permiso               │
│ - Audit logs de accesos                  │
└─────────────────────────────────────────┘
```

---

## 📋 FASE 1: DISEÑO DE BD (Simple pero Escalable)

### Opción A: Roles Simples (RECOMENDADO PARA EMPEZAR)

```sql
-- Sin tabla adicional de roles, solo enum
ALTER TYPE user_role ADD VALUE 'manager' BEFORE 'admin';
ALTER TYPE user_role ADD VALUE 'viewer';

-- Tabla para trackear permisos (opcional pero recomendado)
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(role, permission_key)
);

-- Ejemplos de permisos
INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'products:create'),
  ('admin', 'products:edit'),
  ('admin', 'products:delete'),
  ('admin', 'orders:view'),
  ('admin', 'users:manage'),
  ('admin', 'cash_register:access'),
  
  ('manager', 'products:create'),
  ('manager', 'products:edit'),
  ('manager', 'orders:view'),
  ('manager', 'cash_register:access'),
  
  ('viewer', 'products:view'),
  ('viewer', 'orders:view'),
  
  ('user', 'orders:view_own'),
  ('user', 'cart:manage');
```

### Opción B: Roles + Permisos Individuales (Más Flexible)

```sql
-- Si necesitas asignar permisos individuales por usuario
CREATE TABLE user_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  permission_key VARCHAR(100) NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE(user_id, permission_key)
);

-- El usuario hereda permisos de su rol + permisos individuales
-- Ideal para: acceso temporal, permisos excepcionales
```

---

## 🛠️ FASE 2: IMPLEMENTACIÓN EN FRONTEND

### 1. Crear Permission Service

```typescript
// src/lib/permissions.ts
export type Permission = 
  | 'products:create'
  | 'products:edit'
  | 'products:delete'
  | 'products:view'
  | 'orders:view'
  | 'orders:manage'
  | 'users:manage'
  | 'cash_register:access'
  | 'reports:view'
  | 'inventory:manage';

export type UserRole = 'user' | 'viewer' | 'manager' | 'admin';

// Matriz de permisos por rol (source of truth)
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ['orders:view', 'products:view'],
  
  viewer: ['products:view', 'orders:view', 'reports:view'],
  
  manager: [
    'products:create',
    'products:edit',
    'orders:view',
    'orders:manage',
    'cash_register:access',
    'reports:view',
  ],
  
  admin: [
    'products:create',
    'products:edit',
    'products:delete',
    'products:view',
    'orders:view',
    'orders:manage',
    'users:manage',
    'cash_register:access',
    'reports:view',
    'inventory:manage',
  ],
};

export function hasPermission(
  userRole: UserRole | null,
  permission: Permission
): boolean {
  if (!userRole) return false;
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

export function hasAnyPermission(
  userRole: UserRole | null,
  permissions: Permission[]
): boolean {
  if (!userRole) return false;
  return permissions.some(p => hasPermission(userRole, p));
}

export function hasAllPermissions(
  userRole: UserRole | null,
  permissions: Permission[]
): boolean {
  if (!userRole) return false;
  return permissions.every(p => hasPermission(userRole, p));
}
```

### 2. Custom Hook

```typescript
// src/hooks/usePermission.ts
import { useAuthStore } from '@/store/authStore';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  type Permission 
} from '@/lib/permissions';

export function usePermission() {
  const role = useAuthStore(state => state.profile?.role) as any;

  return {
    can: (permission: Permission) => hasPermission(role, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(role, permissions),
    role,
  };
}
```

### 3. PermissionGate Component

```typescript
// src/components/features/PermissionGate.tsx
import { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { Permission } from '@/lib/permissions';

interface PermissionGateProps {
  permission: Permission | Permission[];
  fallback?: ReactNode;
  children: ReactNode;
  require?: 'any' | 'all'; // 'any' si tiene algún permiso, 'all' si tiene todos
}

export function PermissionGate({
  permission,
  fallback = null,
  children,
  require = 'any',
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermission();
  
  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = require === 'any' 
    ? canAny(permissions)
    : canAll(permissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

### 4. Enhanced ProtectedRoute

```typescript
// src/components/features/ProtectedRoute.tsx (actualizado)
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import type { Permission } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission | Permission[];
  requireAll?: boolean;
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requireAll = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuthStore();
  const { canAny, canAll } = usePermission();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermissions) {
    const perms = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions];
    
    const hasAccess = requireAll ? canAll(perms) : canAny(perms);
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
```

---

## 🎨 FASE 3: EJEMPLOS DE USO

### En Componentes

```tsx
// Esconder opción si no tiene permisos
import { PermissionGate } from '@/components/features/PermissionGate';

export function AdminMenu() {
  return (
    <menu>
      <PermissionGate permission="products:edit">
        <li>
          <a href="/admin/products">Editar Productos</a>
        </li>
      </PermissionGate>

      <PermissionGate permission="users:manage">
        <li>
          <a href="/admin/users">Gestionar Usuarios</a>
        </li>
      </PermissionGate>

      <PermissionGate permission={['orders:manage', 'reports:view']} require="any">
        <li>Menu Avanzado</li>
      </PermissionGate>
    </menu>
  );
}
```

### En Rutas

```tsx
// src/App.tsx
<Route
  path="/admin/users"
  element={
    <ProtectedRoute requiredPermissions="users:manage">
      <AdminUsers />
    </ProtectedRoute>
  }
/>

<Route
  path="/admin/products"
  element={
    <ProtectedRoute requiredPermissions={['products:create', 'products:edit']}>
      <AdminProducts />
    </ProtectedRoute>
  }
/>
```

### Con usePermission Hook

```tsx
import { usePermission } from '@/hooks/usePermission';

export function ProductActions({ product }: { product: Product }) {
  const { can, role } = usePermission();

  return (
    <div className="flex gap-2">
      {can('products:edit') && (
        <Button onClick={() => editProduct(product.id)}>Editar</Button>
      )}

      {can('products:delete') && (
        <Button variant="danger" onClick={() => deleteProduct(product.id)}>
          Borrar
        </Button>
      )}

      {can('products:create') && role === 'admin' && (
        <Button onClick={() => cloneProduct(product.id)}>Duplicar</Button>
      )}
    </div>
  );
}
```

---

## 🔒 FASE 4: RLS Actualizado

```sql
-- Products: Ejemplo de RLS actualizado
CREATE POLICY "Users can view products based on role"
  ON products FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Only users with permission can edit products"
  ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('manager', 'admin')
    )
  );

-- También puedes hacer más granular:
CREATE POLICY "Users with explicit permission can delete"
  ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM user_role_permissions
      WHERE user_id = auth.uid()
      AND permission_key = 'products:delete'
    )
  );
```

---

## 📈 ESCALABILIDAD: Cómo Crecer

### Fase 1 (Ahora): Simple
- ✅ 2-4 roles predefinidos
- ✅ Permisos hardcodeados en `ROLE_PERMISSIONS`
- ✅ RLS básico

### Fase 2 (Futuro): Flexible
- 📅 Tabla `roles` en BD
- 📅 Tabla `role_permissions` en BD
- 📅 API para crear/editar roles
- 📅 Admin UI para gestionar permisos

### Fase 3 (Muy Futuro): Avanzado
- 🚀 Permisos individuales por usuario
- 🚀 Permisos temporales (con `expires_at`)
- 🚀 Delegación de permisos
- 🚀 Audit log completo

---

## 🛣️ ROADMAP IMPLEMENTACIÓN

### Semana 1
- [ ] Actualizar `user_profiles` para soportar nuevos roles
- [ ] Crear `src/lib/permissions.ts` con matriz de permisos
- [ ] Crear `src/hooks/usePermission.ts`
- [ ] Crear `src/components/features/PermissionGate.tsx`

### Semana 2
- [ ] Actualizar `ProtectedRoute` con permisos
- [ ] Actualizar Admin Sidebar para usar PermissionGate
- [ ] Actualizar Admin Layout
- [ ] Tests de los nuevos componentes

### Semana 3
- [ ] Actualizar RLS policies en BD
- [ ] Migración de datos (asignar permisos a usuarios)
- [ ] Testing en staging
- [ ] Documentación

---

## 💾 CHECKLIST ANTES DE IMPLEMENTAR

- [ ] ¿Qué roles necesitas? (user, manager, admin, viewer, etc.)
- [ ] ¿Qué permisos por rol?
- [ ] ¿Necesitas permisos individuales por usuario?
- [ ] ¿Requieres auditoría?
- [ ] ¿Permisos temporales (expiration)?
- [ ] ¿Delegación de permisos?

---

## 🎓 CONCEPTOS CLAVE

| Concepto | Significado |
|----------|-----------|
| **Role** | Categoría de usuario (admin, manager, user) |
| **Permission** | Acción específica permitida (products:edit) |
| **RLS** | Seguridad en BD (lo que frontend intenta no importa) |
| **Frontend Check** | UX (esconder botones que no puedes usar) |
| **Backend Check** | Seguridad (validar permisos en RPC functions) |

---

## 🚀 BENEFICIOS DEL SISTEMA PROPUESTO

✅ **Simple de empezar** - Solo necesitas actualizar el enum `user_role`  
✅ **Fácil de mantener** - Matriz centralizada de permisos  
✅ **Escalable** - Puedes ir de hardcoded a BD cuando lo necesites  
✅ **Type-safe** - TypeScript checks permisos en compile time  
✅ **Seguro** - RLS en BD + checks en frontend  
✅ **Flexible** - Soporta múltiples roles y permisos granulares  

---

**¿Listo para implementar? Avísame y comenzamos fase a fase.** 🚀
