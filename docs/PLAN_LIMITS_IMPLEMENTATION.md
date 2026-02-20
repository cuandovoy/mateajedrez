# Plan de implementación: Límites por plan (Starter vs Profesional)

Basado en los planes definidos:

| Plan | Starter | Profesional |
|------|---------|-------------|
| Productos | 200 máx | Ilimitados |
| Sucursales | 1 | Múltiples |
| Inventario | Básico (1 sucursal) | Multi-sucursal |
| Transferencias internas | ❌ | ✅ |
| Tienda online personalizada | ❌ | ✅ |
| Configuración de notificaciones | ❌ | ✅ |
| Manejo de cajas y cierres | ❌ | ✅ |
| Reportes avanzados | ❌ | ✅ |

---

## 1. Infraestructura base

### 1.1 Constantes y tipos de planes
- [ ] Crear `src/lib/planLimits.ts` con:
  - Constantes `PLAN_STARTER` y `PLAN_PROFESIONAL`
  - Objeto `PLAN_LIMITS` con límites por plan (productos, sucursales)
  - Función `getPlanLimits(tier: string)` para obtener límites
  - Función `canUseFeature(tier: string, feature: string)` para features booleanas

### 1.2 Hook `usePlanLimits`
- [ ] Crear `src/hooks/usePlanLimits.ts`:
  - Lee `currentOrganization.subscription_tier` del store
  - Devuelve `{ tier, limits, canUseFeature, isAtLimit }`
  - `isAtLimit('products')` → true si ya tiene 200 productos (Starter)
  - `canUseFeature('transfers')` → false para Starter

### 1.3 Actualizar `subscription_tier` en organizaciones
- [ ] Asegurar que nuevas orgs usen `'starter'` o `'profesional'` (no solo `'free'`)
- [ ] Migración o script para actualizar orgs existentes al plan correcto

---

## 2. Límite de productos (Starter: 200 máx)

### 2.1 Backend (Supabase)
- [ ] Crear función RPC `check_product_limit(org_id UUID)` que retorne si puede crear más productos
- [ ] Crear trigger o validación en INSERT de `products` que bloquee si excede límite
- [ ] Alternativa: función `create_product` que valide antes de insertar

### 2.2 Frontend
- [ ] **AdminProducts**: Antes de abrir modal de crear producto, verificar `!isAtLimit('products')`
- [ ] Si está en límite: deshabilitar botón "Agregar producto" y mostrar mensaje "Límite alcanzado (200 productos). Actualizá tu plan."
- [ ] Al crear producto desde formulario, validar en cliente antes de enviar
- [ ] Mostrar indicador de uso: "150 / 200 productos" en la página de productos (Starter)

---

## 3. Límite de sucursales (Starter: 1)

### 3.1 Backend
- [ ] Crear función `check_branch_limit(org_id UUID)` 
- [ ] Trigger o validación en INSERT de `branches` que bloquee si Starter ya tiene 1 sucursal

### 3.2 Frontend
- [ ] **AdminBranches**: Deshabilitar "Agregar sucursal" si Starter y ya tiene 1
- [ ] Mensaje: "Plan Starter incluye 1 sucursal. Actualizá a Profesional para múltiples sucursales."
- [ ] Ocultar o deshabilitar selector de sucursal en otras vistas si solo hay 1 (ya puede estar así)

---

## 4. Transferencias internas (solo Profesional)

### 4.1 Backend
- [ ] En RPC `create_inventory_transfer`: verificar `subscription_tier` antes de crear
- [ ] Retornar error amigable si es Starter

### 4.2 Frontend
- [ ] **AdminLayout**: Ocultar item "Transferencias" del menú si `!canUseFeature('transfers')`
- [ ] **AdminInventory**: Ocultar/deshabilitar botón "Transferir" en InventoryTransferModal si Starter
- [ ] Si accede por URL directa a `/transfers`: redirigir o mostrar pantalla "Función disponible en plan Profesional"

---

## 5. Caja / Cierres (solo Profesional)

### 5.1 Backend
- [ ] RLS o validación: bloquear INSERT en `cash_sessions` para Starter (opcional, si querés seguridad en DB)
- [ ] Las órdenes con pago en efectivo podrían requerir cash_session; definir si Starter puede vender en efectivo sin caja

### 5.2 Frontend
- [ ] **AdminLayout**: Ocultar item "Caja" si `!canUseFeature('cash_register')`
- [ ] **AdminCashRegister**: Si accede por URL, mostrar mensaje "Disponible en plan Profesional"
- [ ] **ManualSaleForm**: Si Starter, ocultar o deshabilitar método "Efectivo" (o permitir sin sesión de caja - definir negocio)

---

## 6. Reportes avanzados (solo Profesional)

### 6.1 Definir qué es "avanzado"
- [ ] Opción A: AdminSales completo = avanzado. Starter no ve `/reports/sales`
- [ ] Opción B: AdminSales básico (tabla simple) para ambos; "avanzado" = filtros, gráficos, export Excel
- [ ] Opción C: Crear página nueva `AdminReportsAdvanced` solo para Profesional

### 6.2 Implementación
- [ ] **AdminLayout**: Si Opción A: ocultar "Ventas" para Starter
- [ ] Si Opción B: mostrar AdminSales a ambos, pero sección "Reportes avanzados" (gráficos, export) solo para Profesional
- [ ] **AdminSales**: Envolver secciones avanzadas en `{canUseFeature('advanced_reports') && (...)}`

---

## 7. Tienda online personalizada (solo Profesional)

### 7.1 Definir alcance
- [ ] ¿Custom domain? (ej: tienda.miempresa.com)
- [ ] ¿Más opciones de branding? (logo, color ya existen en EditOrganizationModal)
- [ ] ¿Ocultar tienda online para Starter? (poco probable)

### 7.2 Implementación
- [ ] Si es custom domain: campo `custom_domain` en organizations, solo editable si Profesional
- [ ] **EditOrganizationModal** tab General: sección "Dominio personalizado" solo si `canUseFeature('custom_store')`
- [ ] Si Starter: mensaje "Personalizá tu tienda con plan Profesional"

---

## 8. Configuración de notificaciones (solo Profesional)

### 8.1 Estado actual
- [ ] Verificar si existe feature de notificaciones en el código
- [ ] Si no existe: crear como feature futura, protegida por plan desde el inicio

### 8.2 Implementación
- [ ] Cuando se implemente: página/config solo visible para Profesional
- [ ] Agregar `notifications_config` a `canUseFeature`

---

## 9. UX: Indicadores de plan y upgrade

### 9.1 Banner o aviso
- [ ] En AdminLayout o Dashboard: si Starter, mostrar banner discreto "Estás en plan Starter. [Ver planes]" 
- [ ] Al alcanzar límite (ej: 200 productos): modal o toast sugiriendo upgrade

### 9.2 Página de planes
- [ ] Crear página `/pricing` o `/planes` con los planes (Starter, Profesional)
- [ ] Botón "Actualizar plan" en configuración de organización (para admins)
- [ ] Integración con pasarela de pago (Mercado Pago, Stripe) para cambiar plan - fase posterior

---

## 10. Resumen de archivos a tocar

| Archivo | Cambios |
|---------|---------|
| `src/lib/planLimits.ts` | **Nuevo** - Constantes y helpers |
| `src/hooks/usePlanLimits.ts` | **Nuevo** - Hook para límites |
| `src/components/layout/AdminLayout.tsx` | Ocultar items según plan |
| `src/pages/admin/AdminProducts.tsx` | Límite productos, indicador uso |
| `src/pages/admin/AdminBranches.tsx` | Límite sucursales |
| `src/pages/admin/AdminInventory.tsx` | Ocultar transferencias si Starter |
| `src/pages/admin/AdminSales.tsx` | Restringir reportes avanzados |
| `src/pages/admin/AdminCashRegister.tsx` | Bloquear acceso si Starter |
| `src/components/admin/EditOrganizationModal.tsx` | Ocultar custom domain si Starter |
| `supabase/migrations/` | **Nueva migración** - Funciones de validación, triggers |
| `CreateOrganizationModal.tsx` | Asignar tier inicial (starter/profesional) |

---

## Orden sugerido de implementación

1. **Fase 1 - Base**: planLimits.ts, usePlanLimits, migración con funciones de validación
2. **Fase 2 - Límites duros**: Productos (200), Sucursales (1)
3. **Fase 3 - Features por plan**: Ocultar Transferencias, Caja, Reportes avanzados
4. **Fase 4 - UX**: Indicadores, banner, página de planes
