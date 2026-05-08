# CLAUDE.md — Reglas del repositorio ecommerce-supabase SaaS

# Axiostock — Contexto del proyecto

## Producto
Ver @docs/product_marketing.md para contexto :completo de marketing, personas, voz de marca y lenguaje del cliente.


Este archivo es leído automáticamente por Claude Code en cada sesión. Seguir estas reglas sin excepción.

---

## Stack tecnológico

- **React 18 + TypeScript 5** con Vite
- **Supabase** (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **Zustand** para estado global
- **React Hook Form + Zod** para formularios y validaciones
- **React Router DOM 6** para navegación
- **Tailwind CSS 3** para estilos
- **TanStack Query v5** para data fetching en hooks públicos
- **Lucide React** para íconos (no usar otras librerías de íconos)

---

## Estructura del proyecto

```
src/
├── components/
│   ├── admin/       # Componentes exclusivos del panel admin
│   ├── features/    # Componentes reutilizables de negocio
│   ├── filters/     # Filtros de listados
│   ├── layout/      # AdminLayout, PublicStoreLayout, wrappers
│   └── ui/          # Componentes base (Button, Card, Input, etc.)
├── hooks/           # Custom hooks (fetch, org, auth, permisos)
├── lib/             # Lógica de negocio y utilidades
│   ├── schemas.ts   # Esquemas Zod de formularios
│   ├── utils.ts     # Formateo, precios, imágenes
│   ├── permissions.ts
│   └── planLimits.ts
├── pages/           # Páginas de la tienda pública
├── pages/admin/     # Páginas del panel admin
├── store/           # Stores Zustand
└── types/           # database.types.ts (generado) + index.ts (extensiones)
```

---

## Convenciones de código

### Componentes
- Siempre usar **exports nombrados** (`export function Foo()`), nunca `export default`
- Props definidas con `interface`, no con `type`
- Nombres de archivos y componentes en **PascalCase**
- Hooks y utilidades en **camelCase**

```tsx
// ✅ Correcto
interface ProductCardProps {
  product: Product
  stock?: number
}
export function ProductCard({ product, stock }: ProductCardProps) { ... }

// ❌ Incorrecto
export default function ProductCard(props: any) { ... }
```

### Imports
- Usar alias `@/` para todo import interno (`@/components`, `@/hooks`, `@/lib`, etc.)
- Agrupar: externos → internos → tipos
- Importar tipos con `import type { ... }`

---

## Supabase — reglas obligatorias

### Multi-tenancy
- **Toda query a la DB debe incluir `.eq('organization_id', organizationId)`**
- Nunca hacer queries sin filtro de organización — viola el aislamiento de datos

### Obtener organization ID
```tsx
// En componentes admin
const { organizationId } = useOrganization()

// En stores
const orgId = useOrganizationStore(s => s.currentOrganization?.id)
```

### Patrón de query
```typescript
const { data, error } = await supabase
  .from('products')
  .select('*, category:categories(id, name)')
  .eq('organization_id', organizationId)
  .order('created_at', { ascending: false })

if (error) throw error
```

### RPCs (funciones PostgreSQL)
```typescript
// Castear con `as any` cuando los tipos generados no están actualizados
const { error } = await (supabase.rpc as any)('nombre_funcion', {
  p_param: value,
})
```

### Tipos generados
- Los tipos viven en `src/types/database.types.ts` — este archivo se edita manualmente cuando se agrega una columna nueva y aún no se regeneraron los tipos
- Al agregar columnas nuevas: actualizar los tres bloques `Row`, `Insert` y `Update` del tipo correspondiente
- Extender tipos de negocio en `src/types/index.ts` con `interface ... extends ...`
- Exportar desde `src/types/index.ts`

### Tablas sin tipos generados (nuevas)
```typescript
// Castear el cliente para evitar error TS
const sb = supabase as any
await sb.from('nueva_tabla').insert(...)
```

---

## Migraciones

> **Las migraciones y funciones SQL las aplica el usuario manualmente. Claude Code solo debe crear los archivos `.sql` — nunca ejecutarlos ni usar MCP para aplicarlos.**

- Archivo en `supabase/migrations/NNN_nombre_descriptivo.sql`
- Numeración secuencial (ver el último número y sumar 1)
- Siempre incluir RLS policies al crear tablas nuevas
- Toda tabla nueva debe tener `organization_id UUID NOT NULL REFERENCES organizations(id)`
- Usar `IF NOT EXISTS` para operaciones idempotentes

```sql
-- Ejemplo de nueva tabla
CREATE TABLE IF NOT EXISTS public.nueva_tabla (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nueva_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select"
  ON public.nueva_tabla FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
```

---

## Formularios (React Hook Form + Zod)

- Todos los esquemas de formularios van en `src/lib/schemas.ts`
- Usar `zodResolver` del paquete `@hookform/resolvers/zod`
- Mensajes de validación siempre en **español**
- Validaciones especiales para Uruguay:
  - RUT: formato `XX.XXXXXX.001-X` → usar `validateUruguayanRUT`
  - Teléfono: `+598 X XXX XXXX` o `0X XXXX XXXX` → usar `validateUruguayanPhone`

```typescript
// Patrón estándar en página admin
const { register, handleSubmit, reset, formState: { errors } } =
  useForm<ProductForm>({ resolver: zodResolver(productSchema) })
```

---

## Estado global (Zustand)

### Stores disponibles
| Store | Propósito |
|-------|-----------|
| `authStore` | Usuario, perfil, login/logout |
| `organizationStore` | Org activa, switching (persistido) |
| `cartStore` | Carrito de compras (sync DB/localStorage) |
| `toastStore` | Notificaciones toast |

### Notificaciones
```typescript
const { show } = useToastStore()
show('Mensaje de éxito', 'success')   // 'success' | 'error' | 'warning' | 'info'
// Mensajes siempre en español
```

---

## Precios y descuentos

- El precio con descuento se obtiene SIEMPRE con `getEffectivePrice(product)` de `@/lib/utils`
- Para verificar si hay descuento activo: `hasActiveDiscount(product)`
- **Nunca usar `product.price` directamente** en contexto de tienda/carrito/checkout
- Los descuentos tienen `discount_percentage` (0-100) y `discount_expires_at` (puede ser null = sin límite)
- En variantes: usar `variant.price` (las variantes no tienen descuento propio)

```typescript
// ✅ Correcto
const unitPrice = item.variant?.price ?? getEffectivePrice(item.product)

// ❌ Incorrecto
const unitPrice = item.variant?.price ?? item.product.price
```

---

## Estilos y Tailwind

### Paletas de color
- **Admin**: usar clases `admin-*` (ej: `bg-admin-600`, `text-admin-500`, `focus:ring-admin-500`)
- **Tienda pública**: usar variables CSS `var(--org-primary-color, #fallback)` para colores dinámicos de la organización
- No mezclar clases `admin-*` en componentes de la tienda pública

### Filtros en el panel admin

**Regla obligatoria**: toda página del panel admin con filtros debe usar una **barra de filtros inline**, siempre visible, sin card, sin colapsado.

Principios:
- Los controles de filtro son siempre visibles — nunca colapsados ni escondidos detrás de un botón
- Usar `flex flex-wrap items-center gap-2` como contenedor
- Cada control tiene altura `h-9` y bordes `border-gray-200 rounded-lg`
- En mobile los labels de texto se ocultan con `hidden sm:inline`; el control sigue siendo funcional por ícono o valor
- El botón "Limpiar" solo aparece cuando hay al menos un filtro activo
- No usar `<Card>` ni secciones con headers para envolver filtros

**Estado activo de cada control:**
- Select activo (valor seleccionado): `border-admin-400 bg-admin-50 text-admin-800 font-medium`
- Toggle activo (ej: "Stock bajo"): color semántico del contexto, ej. `bg-yellow-50 border-yellow-300 text-yellow-800`
- Toggle activo neutro: `bg-gray-100 border-gray-400 text-gray-800 font-medium`
- Botón "Limpiar": `text-red-500 border border-red-200 hover:bg-red-50`, solo cuando hay filtros activos

**Input de búsqueda:**
```tsx
<div className="relative flex-1 min-w-[180px]">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
  <input
    placeholder="Nombre, SKU..."
    className="w-full h-9 pl-9 pr-8 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-admin-500"
  />
  {/* Botón × inline para limpiar — solo cuando hay texto */}
</div>
```

**Badges numéricos en toggles** (ej: cantidad de items en estado filtrado):
```tsx
<span className="text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none bg-yellow-100 text-yellow-700">
  {count}
</span>
```

**No hacer:**
- No usar `<Card>` para envolver filtros del panel admin
- No colapsar filtros detrás de un botón "Mostrar/Ocultar"
- No usar `<label>` encima de cada control — el placeholder o el valor seleccionado son suficientes
- No agregar un campo de solo lectura que no permite interacción (ej: "Ordenar por: Stock")

### Responsive
- Mobile-first siempre: base → `md:` → `lg:`
- Grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Contenedor principal: clase `container-custom`

### Clases custom definidas en `index.css`
- `.container-custom` — contenedor con max-width y padding horizontal
- `.spacing-section` — padding p-4 md:p-6
- `.focus-ring` — foco tienda pública
- `.focus-ring-admin` — foco panel admin

---

## Rutas y contextos

### Tienda pública
- Prefijo `/:slug/*`
- Sin autenticación requerida
- Org obtenida por slug de la URL (RPC `get_org_by_slug`)
- Layout: `PublicStoreLayout`

### Panel admin
- Rutas en `/` (sin prefijo)
- Requiere auth + permisos
- Layout: `AdminLayout` con sidebar
- Org obtenida de `useOrganization()` (store)

---

## Permisos y plan limits

### Verificar permisos
```typescript
const { can, canAny, isAdmin } = usePermission()
if (!can('products:edit')) return null
```

### Verificar plan/features
```typescript
const { canUseFeature, isAtLimit, tier } = usePlanLimits()
if (!canUseFeature('transfers')) { /* Mostrar upgrade */ }
if (isAtLimit('products')) { /* Bloquear creación */ }
```

### Tiers
- `starter` — límites en productos (700), sucursales (1), imágenes por producto (1)
- `profesional` — sin límites (null), hasta 3 imágenes por producto

---

## Categorías de productos

- Los productos pueden estar vinculados a **múltiples categorías** via la tabla `product_categories` (junction table)
- El campo `category_id` en `products` se mantiene como categoría principal (primera seleccionada)
- Al guardar productos: siempre actualizar la tabla `product_categories`
- Al mostrar categorías del producto: leer de `product_categories` con join a `categories`

---

## Inventario y stock

- El stock real está en `branch_inventory` (por sucursal), no en `products.stock`
- `products.stock` es un campo legacy de sincronización
- Para obtener stock real: agregar filas de `branch_inventory` filtrando por `organization_id` via join a `branches`
- Variantes: su stock está en `branch_inventory` con `variant_id` y `product_id IS NULL`

---

## Convenciones generales

- **Idioma**: toda la UI, mensajes de error y validación van en **español**
- **Comentarios**: solo cuando el "por qué" no es obvio. No documentar "qué hace" el código
- **console.log**: solo en catch/error, nunca en flujos normales
- **any**: permitido solo con `// eslint-disable-next-line @typescript-eslint/no-explicit-any` cuando los tipos generados de Supabase están desactualizados
- **Confirmaciones destructivas**: usar `confirm()` nativo antes de eliminar o cancelar
- **Fetching en admin**: usar `useCallback` + `useEffect` directamente con Supabase, no React Query (React Query se usa en hooks de tienda pública)
- **Ante dudas**: siempre preguntar al usuario antes de tomar decisiones de arquitectura, diseño de datos o cuando el alcance de una tarea no esté claro

## Data fetching y hooks

- Toda lógica de obtención y mutación de datos debe encapsularse en **custom hooks** en `src/hooks/`
- Los hooks deben ser optimizados: usar `useCallback` para funciones, `useMemo` para derivaciones costosas, y evitar re-fetches innecesarios
- Nombrar hooks descriptivamente: `useProducts`, `useOrderDetail`, `useBranchInventory`, etc.
- Los hooks de tienda pública usan **TanStack Query** (`useQuery`, `useMutation`)
- Los hooks de admin usan **Supabase directo** con `useCallback` + `useEffect`

## Edge Functions

- Ante operaciones complejas o costosas, evaluar si corresponde una **Supabase Edge Function** e indicárselo al usuario antes de implementar en el cliente
- Casos típicos que sugieren Edge Function:
  - Lógica de negocio con múltiples writes en cascada (ej: procesar un pago y actualizar stock/orden/inventario atomicamente)
  - Integraciones con APIs externas (webhooks, pasarelas de pago, envío de emails)
  - Operaciones que requieren secretos no expuestos al cliente
  - Agregaciones o reportes sobre grandes volúmenes de datos
- Al detectar uno de estos casos, avisar: _"Esta operación sugiere una Edge Function por [motivo]. ¿La creamos?"_

---

## Lo que NO hacer

- No usar `export default` en componentes
- No usar `class` en componentes (todo funcional)
- No usar otras librerías de íconos fuera de Lucide React
- No hacer queries sin filtro `organization_id`
- No usar `product.price` directamente en contexto de tienda (usar `getEffectivePrice`)
- No crear archivos de documentación `.md` salvo que el usuario lo pida explícitamente
- No agregar `console.log` de debug en el código
- No inventar URLs ni endpoints — siempre verificar que existen
