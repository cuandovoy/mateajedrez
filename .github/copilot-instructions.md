# Copilot Instructions - Vibe Coding Ecommerce Supabase

You are an expert assistant helping develop a full-stack e-commerce application. This document provides essential context for code generation and refactoring.

## Project Overview

**Stack**: React 18 + TypeScript + Supabase PostgreSQL + Zustand + Tailwind CSS  
**Architecture**: Multi-layered frontend with admin panel, multi-branch inventory system, and role-based access control  
**Key Features**: Product management, orders, cart, stock control (multi-branch), cash register system, audit logs

## Critical Patterns & Architecture

### 1. Role-Based Access Control (RBAC)
**New Roles** (expanded from binary admin/user):
- `admin`: Full system access
- `manager`: Product, order, inventory, and cash register management
- `viewer`: Read-only access to products, orders, and reports
- `user`: Basic customer access

**Permission System**:
- All permissions defined in `@/lib/permissions.ts`
- Permissions by category: products, orders, users, inventory, cash_register, reports, settings
- Format: `category:action` (e.g., `products:edit`, `users:manage_roles`)

**BD Tables for RBAC**:
- `roles`: System roles with descriptions
- `permissions`: Available permissions with categories
- `roles_permissions`: Role-permission mapping
- `user_permissions`: Individual user permission overrides (temporary/exceptions)
- `rbac_audit_log`: Audit trail of RBAC changes

**Permission Checks**:
```typescript
// In components
import { usePermission } from '@/hooks/usePermission'

const { can, canAny, canAll, role } = usePermission()

if (can('products:edit')) { /* ... */ }
if (canAny(['products:create', 'products:edit'])) { /* ... */ }

// Gate component
<PermissionGate permission="products:edit">
  <Button>Edit</Button>
</PermissionGate>

// Protected routes
<ProtectedRoute requiredPermissions="users:manage_roles">
  <AdminRolesPermissions />
</ProtectedRoute>
```

### 2. Type Safety & Supabase Integration
- **Always** use types from `@/types/database.types.ts` (auto-generated from Supabase schema)
- Example: `import type { Product, Order } from '@/types/database.types'`
- Create extension types in `@/types/index.ts` (e.g., `ProductWithCategory`)
- Use `type` for simple unions, `interface` for extensible contracts
- Regenerate types after SQL migrations: `yarn generate-types`

### 3. State Management (Zustand)
Three main stores live in `src/store/`:
- `authStore`: User auth state, profile, role; handles Supabase session + profile sync
- `cartStore`: Local cart management with localStorage persistence and server sync on login
- `toastStore`: Toast notifications (success/error/info)

**Pattern**: Use selector functions to avoid unnecessary re-renders:
```typescript
const user = useAuthStore(state => state.user)  // ✅ Not: useAuthStore().user
```

### 3. Component Architecture
```
src/components/
  ui/           → Reusable atoms (Button, Input, Modal)
  features/     → Domain-specific (ProductCard, OrderForm)
  admin/        → Admin-only components
  layout/       → Page wrappers (AdminLayout, ShopLayout)
  filters/      → Filter components
```

**Key structure**: Components are small, focused, with clear props interfaces. Avoid prop drilling beyond 2 levels—use stores or context.

### 4. Supabase & Row Level Security (RLS)
- **All queries must use specific selects**, not `select('*')`
- **Example**: `supabase.from('product').select('id, name, price, category_id')`
- **RLS policies** are strict: users can only access their own data (except public reads for products)
- Validate data client-side (Zod) AND server-side (RLS + DB constraints)
- Use RPC functions for complex operations (e.g., order processing)

### 5. Forms & Validation
- Use **react-hook-form + Zod** for all forms
- Create reusable Zod schemas (e.g., `EmailSchema`, `PasswordSchema`) in dedicated `.types.ts` files
- Disable submit button during loading
- Show field-level validation errors inline
- Example structure:
```typescript
const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 chars')
})
type FormData = z.infer<typeof schema>
const form = useForm<FormData>({ resolver: zodResolver(schema) })
```

### 6. Admin Panel Patterns
- All admin pages extend `AdminLayout` component
- Use consistent table structure with actions column (edit/delete)
- Implement filters as reusable components from `@/components/filters/`
- Pagination must include limit + offset parameters
- Show loading/error states for all data fetches
- **Permission-gated**: Wrap admin features with permission checks

**Example**:
```tsx
// Only show admin link if user has permission
<PermissionGate permission="users:manage_roles">
  <Link to="/admin/roles-permissions">Manage Roles</Link>
</PermissionGate>

// Gate entire page
<ProtectedRoute requiredPermissions={['settings:manage_roles', 'settings:audit_logs']}>
  <AdminRolesPermissions />
</ProtectedRoute>
```

**Admin Pages with RBAC**:
- `/admin/roles-permissions` - Manage roles and permissions (admin only)
- `/admin/users` - Manage users and assign roles (users:manage_roles)
- `/admin/products` - Manage products (products:create, products:edit)
- `/admin/orders` - Manage orders (orders:view, orders:edit)
- `/admin/cash-register` - Cash register system (cash_register:access)

### 7. Error Handling
- Wrap async operations in try-catch with specific error messages
- Never expose technical details to users—use generic messages
- Always set loading state to false in finally block
- Log errors for debugging, but don't leak sensitive info
- Toast notifications for user feedback

### 8. Styling
- **Tailwind CSS only**—no custom CSS files
- Use `cn()` utility for conditional classes (from `clsx`)
- Responsive classes: `sm:`, `md:`, `lg:`, `xl:`
- Add custom Tailwind config entries in `tailwind.config.js` if needed
- DaisyUI components via Tailwind classes

## Development Workflows

### Adding a New Database Table
1. Create SQL migration in `supabase/migrations/NNN_description.sql`
2. Include RLS policies for access control
3. Run migration in Supabase Dashboard (SQL Editor)
4. Regenerate types: `yarn generate-types`
5. Add types to `@/types/index.ts` if extending base types

### Managing Roles and Permissions
1. **Viewing/Editing**: Admin goes to `/admin/roles-permissions`
2. **Modifying Permissions**: Select role → toggle checkboxes → Save
3. **Adding New Permission**: Add to `permissions` table, then assign to roles
4. **Updating Permission Matrix**: Edit `ROLE_PERMISSIONS` in `@/lib/permissions.ts`
5. **Temporary User Permissions**: Use `user_permissions` table with `expires_at`

**Workflow Example**:
```
Requirement: "Managers can now export reports"
  ↓
1. Add permission to BD: INSERT INTO permissions (key, name, category)
   VALUES ('reports:export', 'Export reports', 'reports')
  ↓
2. Assign to manager role in Admin UI
   /admin/roles-permissions → Select "manager" → Check "reports:export" → Save
  ↓
3. Use in components:
   <PermissionGate permission="reports:export">
     <ExportButton />
   </PermissionGate>
  ↓
✅ Done
```

### Creating a New Admin Feature
1. Create page component in `src/pages/admin/Admin[Feature].tsx`
2. Use `AdminLayout` wrapper for consistent UI
3. Build table/form from existing admin components
4. Add route to `src/App.tsx` with `ProtectedRoute`
5. Wrap with required permissions: `<ProtectedRoute requiredPermissions="category:action">`

### Multi-Branch Architecture
- **Tables with branch context**: `branch_inventory`, `cash_sessions`, `inventory_movements`
- **Pattern**: Filter queries by `branch_id` from user's branch assignment
- **Example**: `const { data } = await supabase.from('branch_inventory').select('*').eq('branch_id', currentBranchId)`

## Commands Reference
```bash
yarn dev                    # Start dev server (Vite)
yarn build                  # Production build
yarn type-check             # TypeScript validation
yarn lint                   # ESLint check
yarn generate-types         # Regenerate Supabase types
```

## Naming Conventions
- **Components**: `PascalCase` → `ProductCard.tsx`
- **Hooks/Functions**: `camelCase` → `useAuthStore`, `formatPrice()`
- **Constants**: `UPPER_SNAKE_CASE` → `MAX_QUANTITY`
- **Types/Interfaces**: `PascalCase` → `Product`, `OrderInsert`
- **DB Tables**: singular `snake_case` → `product`, `user_profile`, `cash_session`

## Anti-Patterns to Avoid
❌ Use `any` type without justification  
❌ Create custom CSS outside Tailwind  
❌ Hardcode values (use constants)  
❌ Ignore TypeScript errors  
❌ Trust client-side validation alone  
❌ Mix business logic into components  
❌ Use `select('*')` in Supabase queries  
❌ Forget error handling in async operations  

## Key Files to Reference
- `.cursorrules` → Extended project standards and anti-patterns
- `.ai/RULES.md` → 10 fundamental rules and best practices
- `.ai/RBAC_ANALYSIS.md` → Role-based access control analysis
- `.ai/skills/react-patterns.md` → React/TypeScript patterns
- `.ai/skills/supabase-best-practices.md` → DB and RLS patterns
- `src/lib/permissions.ts` → Permission definitions and role mapping
- `src/hooks/usePermission.ts` → Permission checking hook
- `src/components/features/PermissionGate.tsx` → Permission gating component
- `src/components/features/ProtectedRoute.tsx` → Protected route with permission checks
- `src/pages/admin/AdminRolesPermissions.tsx` → Admin UI for managing roles/permissions
- `src/types/database.types.ts` → Auto-generated Supabase schema
- `supabase/migrations/029_add_rbac_system.sql` → RBAC tables and initial data
- `supabase/migrations/` → All DB schema and RLS policies
