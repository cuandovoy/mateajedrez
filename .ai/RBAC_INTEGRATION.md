# 📌 Integration Guide - Agregar AdminRolesPermissions a App.tsx

## Paso 1: Importar la nueva página

Abre `src/App.tsx` y agrega el import:

```typescript
import { AdminRolesPermissions } from '@/pages/admin/AdminRolesPermissions'
```

## Paso 2: Agregar la ruta protegida

Busca la sección de rutas admin (alrededor de la línea 40-60) y agrega:

```tsx
<Route
  path="/admin/roles-permissions"
  element={
    <ProtectedRoute requiredPermissions="settings:manage_roles">
      <AdminRolesPermissions />
    </ProtectedRoute>
  }
/>
```

## Paso 3: Agregar link al Sidebar

En `src/components/layout/Sidebar.tsx`, encuentra la sección de admin links y agrega:

```tsx
<PermissionGate permission="settings:manage_roles">
  <NavLink 
    to="/admin/roles-permissions"
    className={({ isActive }) =>
      cn(
        'px-4 py-2 rounded hover:bg-gray-200',
        isActive && 'bg-primary-600 text-white'
      )
    }
  >
    Roles & Permisos
  </NavLink>
</PermissionGate>
```

## Paso 4: Actualizar tipos (opcional)

Si necesitas regenerar tipos de Supabase:

```bash
yarn generate-types
```

## Paso 5: Ejecutar la migración

1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Copia el contenido de `supabase/migrations/029_add_rbac_system.sql`
4. Ejecuta

## ✅ Verificación

1. Loggearse como admin
2. Ir a `/admin/roles-permissions`
3. Ver tabla de roles y permisos
4. Hacer cambio en permisos
5. Guardar y verificar en BD

---

**Eso es todo! El sistema RBAC está completamente integrado.** 🚀
