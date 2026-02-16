# Plan de Implementación - Fase 1 y 2 (Multi-Tenant)

## Orden de Ejecución

Las migraciones deben ejecutarse en orden numérico. Cada migración es incremental.

---

## Fase 1

### Migración 034: Crear tablas organizations y organization_members

**Archivo:** `supabase/migrations/034_add_organizations.sql`

- Crear tabla `organizations`
- Crear tabla `organization_members`
- Crear funciones helper: `get_user_organization_ids()`, `is_org_member()`, `is_org_admin_or_manager()`
- Mantener `is_admin()` por compatibilidad temporal (deprecar después)

### Migración 035: Migrar datos y agregar organization_id (Parte 1 - Tablas raíz)

**Archivo:** `supabase/migrations/035_add_organization_id_part1.sql`

- Crear organización default "Mi Organización"
- Poblar `organization_members` desde `user_profiles`
- Agregar `organization_id` a tablas raíz:
  - categories
  - products
  - suppliers
  - branches
  - customers
  - orders
- Backfill con org default
- Hacer NOT NULL
- Ajustar UNIQUE en customers: (organization_id, phone)

### Migración 036: Agregar organization_id (Parte 2 - Tablas dependientes)

**Archivo:** `supabase/migrations/036_add_organization_id_part2.sql`

- cart_items
- audit_logs
- roles (opcional: global), user_permissions
- rbac_audit_log

Las tablas que heredan por FK (product_variants, product_images, order_items, branch_inventory, etc.) obtienen organization_id vía JOIN - no necesitan columna propia para RLS si siempre se accede por la tabla padre. Pero para RLS más simple, agregamos organization_id a las que se consultan directamente.

**Decisión:** Agregar organization_id solo donde se necesita para RLS directo. Las tablas hijas (order_items, product_images) se filtran vía la tabla padre (orders, products).

### Migración 037: Actualizar RLS para multi-tenant

**Archivo:** `supabase/migrations/037_update_rls_multi_tenant.sql`

- Actualizar función `is_admin()` para aceptar org context O crear `is_org_admin(org_id)`
- Recrear políticas en todas las tablas con organization_id
- Actualizar view `user_all_permissions` para usar organization_members (requiere org context - será función)

### Frontend Fase 1

- Crear `organizationStore.ts`
- Crear `useOrganization` hook
- Modificar `authStore` para cargar organizaciones al login
- Agregar selector de organización en AdminLayout
- Crear página/flujo "Crear organización" (básico)

---

## Fase 2

### Migración 038: organization_id en tablas restantes

**Archivo:** `supabase/migrations/038_add_organization_id_remaining.sql`

- product_variants (vía product_id, pero para queries directas)
- product_images, product_barcodes, product_suppliers
- branch_inventory, cash_sessions, order_payments
- inventory_movements, inventory_transfers

### Frontend Fase 2: Actualizar queries

Archivos a modificar (agregar `.eq('organization_id', orgId)`):

| Archivo | Tablas |
|---------|--------|
| AdminProducts | products, categories, suppliers |
| AdminCategories | categories |
| AdminSuppliers | suppliers |
| AdminInventory | branches, products, branch_inventory |
| AdminBranches | branches |
| AdminOrders | orders |
| AdminCustomers | customers |
| AdminUsers | user_profiles → organization_members |
| AdminCashRegister | cash_sessions, branches |
| AdminTransfers | inventory_transfers, branches |
| AdminSales | orders |
| AdminAuditLogs | audit_logs |
| AdminRolesPermissions | roles, permissions |
| Checkout | branches, branch_inventory, customers, orders |
| Home, Products, Cart | products, categories |
| cartStore | cart_items |
| storage.ts | paths con org_id |

### Storage Fase 2

- Modificar `uploadProductImage`, `uploadCategoryImage` para incluir org_id en path
- Crear políticas RLS en Storage buckets
- Actualizar `deleteImage` para path con org

---

## Actualización de database.types.ts

Después de cada migración que altere el schema, ejecutar:

```bash
yarn generate-types
```

O actualizar manualmente los tipos para: Organization, OrganizationMember, y los nuevos campos organization_id en cada tabla.

---

## Checklist de Ejecución

- [x] 034 - Crear migración
- [x] 035 - Crear migración
- [x] 036 - Crear migración
- [x] 037 - Crear migración
- [x] 038 - Crear migración
- [x] 039 - RPC populate_missing_inventory_entries (multi-tenant)
- [x] Actualizar database.types.ts
- [x] organizationStore + selector en AdminLayout
- [x] useOrganization hook
- [x] AdminProducts - organization_id en queries
- [x] AdminCategories - organization_id en queries
- [x] Actualizar páginas restantes: AdminSuppliers, AdminInventory, AdminBranches, AdminOrders, AdminCustomers, AdminUsers, AdminCashRegister, AdminTransfers, AdminSales, AdminAuditLogs
- [x] Checkout - organization_id en orders, customers, branches
- [x] Home, Products, CategoryProducts - filtrar por org
- [x] cartStore - organization_id en cart_items
- [x] Modificar storage para paths por org
- [x] Flujo Crear organización (modal en AdminLayout)
- [ ] **Ejecutar migraciones** en Supabase: `supabase db push` o 039 si ya tienes el schema
- [ ] Testing: crear 2 orgs, verificar aislamiento
