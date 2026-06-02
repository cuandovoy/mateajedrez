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

## Testing

### Qué testear (obligatorio)
- Todo archivo nuevo en `src/lib/` con lógica de negocio debe tener su `*.test.ts` en la misma carpeta
- Funciones puras (sin dependencias externas) → tests directos sin mocks
- Funciones que usan Supabase → mock del cliente con `vi.mock`

### Qué NO testear
- Componentes React y páginas
- Hooks que solo encadenan llamadas a Supabase sin lógica derivada
- Edge Functions (se testean en el entorno de Supabase)

### Estructura
- `describe` por función exportada; `it` por caso
- Cubrir siempre: caso feliz, edge cases (null/undefined/vacío/límites), caso de error
- Nombres de `it` en español, descriptivos del escenario

```typescript
describe('miFuncion', () => {
  it('retorna X cuando Y', () => { ... })
  it('retorna null para input vacío', () => { ... })
  it('retorna 0 en error', () => { ... })
})
```

### Tests efectivos — reglas de calidad

**No alcanza con el happy path.** Por cada función o schema con validaciones, seguir estas reglas:

**Boundary values (límites exactos):** Para todo campo numérico con `min`/`max`, testear los cuatro puntos: valor mínimo válido, valor máximo válido, mínimo-1 (debe fallar), máximo+1 (debe fallar).
```typescript
it('acepta descuento en límite inferior (0)', ...)   // min válido
it('acepta descuento en límite superior (100)', ...) // max válido
it('rechaza descuento -1', ...)                      // min-1
it('rechaza descuento 101', ...)                     // max+1
```

**null vs undefined:** Son distintos en Zod y TypeScript. Si un campo es `.optional()` (acepta `undefined`) pero no `.nullable()`, testear que `null` falla. Si es `.nullable()`, testear que `undefined` también pasa cuando corresponde.

**Tests negativos proporcionales:** Por cada regla de validación debe existir al menos un `it` que la rompa. Si hay 5 restricciones en un schema, debe haber al menos 5 tests negativos (que esperan `success: false`). Un bloque con solo tests que pasan no cubre robustez.

**Documentar decisiones de diseño en el nombre del test:** Cuando una validación ocurre *fuera* del schema (ej: en `onSubmit`), el test debe decirlo explícitamente para que quien lo lea entienda que no es un olvido.
```typescript
// ✅ Documenta la intención
it('acepta category_id vacío (validación multi-categoría ocurre en onSubmit via selectedCategoryIds)', ...)

// ❌ Genera confusión
it('acepta category_id vacío', ...)
```

**No testear la misma restricción dos veces con distintos valores felices** — un solo caso positivo por restricción es suficiente; los negativos son los que dan valor.

### Mock de Supabase

```typescript
vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

// Para builder pattern (from().select().eq()...):
function createQueryMock(result: { data: any; error: any }) {
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return mock
}
```

### Comandos
- `npm test` — corre todos los tests una vez
- `npm run test:watch` — modo watch (desarrollo)
- `npm run test:ui` — UI interactiva de Vitest

---

## Errores, loading y skeletons

### Errores según contexto
- **Error de datos** (fetch fallido al cargar la página/sección) → div inline:
  ```tsx
  {error && (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  )}
  ```
- **Error de acción** (guardar, eliminar, enviar fallido) → toast:
  ```typescript
  show('No se pudo guardar el producto', 'error')
  ```
- Nunca usar `alert()` para errores — siempre toast o div inline según contexto

### Loading states — usar siempre Skeleton
- Mientras `loading === true` mostrar skeleton, nunca spinner genérico ni `null`
- Para tablas admin: `<SkeletonTable rows={pageSize} />`
- Para cards/grids: `<SkeletonCard />` repetido
- Para elementos custom: combinar `<Skeleton className="h-4 w-3/4" />` con el layout real
- Componentes en `src/components/ui/Skeleton.tsx`: `Skeleton`, `SkeletonCard`, `SkeletonTable`

```tsx
{loading && <SkeletonTable rows={25} />}
{!loading && items.length === 0 && <EmptyState ... />}
{!loading && items.length > 0 && <MiTabla items={items} />}
```

---

## Empty states

- Siempre mostrar `<EmptyState>` cuando `items.length === 0` y `loading === false`
- Componente en `src/components/ui/EmptyState.tsx`
- Props: `icon` (Lucide), `title` (requerido), `description`, `action` ({ label, onClick })
- Incluir CTA cuando aplique (crear primer item, limpiar filtros, etc.)

```tsx
<EmptyState
  icon={Package}
  title="No hay productos"
  description="Creá tu primer producto para empezar a vender."
  action={{ label: 'Nuevo producto', onClick: handleNew }}
/>
```

---

## Modales

- Implementación manual (sin librería externa): `fixed inset-0 z-50 bg-black/50`
- Estructura estándar:
  ```tsx
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">  {/* o max-w-2xl */}
      {/* Header con título + botón X */}
      {/* Body */}
      {/* Footer con acciones */}
    </div>
  </div>
  ```
- Tamaño: `max-w-sm` para confirmaciones/alerts; `max-w-2xl` para formularios complejos
- Siempre incluir botón X en esquina superior derecha para cerrar
- Z-index base: `z-50`; si el modal aparece sobre otro modal: `z-[60]`
- Si `open === false`: `return null` (no renderizar el árbol)
- Nomenclatura de archivos: `Create*Modal.tsx`, `Edit*Modal.tsx`, `*DeleteModal.tsx`

---

## Navegación

- **Tienda pública**: usar `<Link>` siempre — navegación declarativa
  ```tsx
  <Link to={`${basePath}/product/${product.id}`}>Ver producto</Link>
  ```
- **Panel admin**: usar `<Link>` para navegación de sidebar y links estáticos; usar `useNavigate` solo cuando hay lógica previa (validación, guardado, confirmación)
  ```typescript
  const navigate = useNavigate()
  // Solo cuando hay lógica antes de navegar
  const handleSave = async () => {
    await save()
    navigate('/admin/products')
  }
  ```
- Sintaxis imperativa: siempre `navigate('/ruta')` (string simple, no objeto)
- Para pasar estado: `navigate('/ruta', { state: { id } })`

---

## Fechas y timezone

- **No usar** `date-fns`, `dayjs` ni `moment` — usar funciones de `src/lib/dateUtils.ts` + `Intl` nativo
- Todas las fechas se almacenan en **UTC** en la DB; se muestran en el timezone de la organización
- Tres casos de uso:

| Caso | Función |
|------|---------|
| Mostrar fecha en UI | `formatDateShort(date)` desde `@/lib/utils` |
| Convertir a clave de día (YYYY-MM-DD) en tz org | `toOrgDateKey(date, tz)` desde `@/lib/dateUtils` |
| Construir rango para query Supabase | `buildDateRange(tz)` desde `@/lib/dateUtils` |
| Obtener offset UTC para filtros | `orgTzOffset(date, tz)` desde `@/lib/dateUtils` |

- El timezone de la organización se obtiene de `orgSettings.timezone` (hook `useOrgSettings`)

---

## Paginación

- **Tienda pública**: "Cargar más" con acumulación de resultados; tamaño de página: `24`
- **Panel admin**: paginación estándar con botones prev/next o select de tamaño; tamaño default: `25`
- Tamaños centralizados — no definir `PAGE_SIZE` en cada componente; importar de `src/lib/constants.ts`:
  ```typescript
  export const PAGE_SIZE_STORE = 24
  export const PAGE_SIZE_ADMIN = 25
  export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
  ```

---

## Storage (imágenes)

- Todos los uploads deben pasar por funciones de `src/lib/storage.ts` — nunca llamar a `supabase.storage` directamente desde un componente
- Funciones disponibles: `uploadProductImage`, `uploadCategoryImage`, `uploadOrganizationLogo`, `deleteImage`
- Las validaciones de tipo y tamaño (`ALLOWED_IMAGE_TYPES`, `MAX_FILE_SIZE_MB`) deben importarse de `src/lib/storage.ts`, no redefinirse en el componente
- Patrón de ruta en bucket: siempre `{organizationId}/{fileName}` para aislamiento multi-tenant

```typescript
// ✅ Correcto
import { uploadProductImage } from '@/lib/storage'
const url = await uploadProductImage(file, productId, organizationId)

// ❌ Incorrecto
const { data } = await supabase.storage.from('product-images').upload(...)
```

---

## Supabase Realtime

- Usar `useRef` para almacenar el channel y evitar fugas de memoria
- Siempre incluir filter por `organization_id` en el `.on()` — no suscribirse a toda la tabla
- Limpiar el channel en el cleanup del `useEffect` y cuando cambie la org

```typescript
const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

useEffect(() => {
  if (!orgId) return

  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }

  const channel = supabase
    .channel(`tabla:${orgId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mi_tabla',
      filter: `organization_id=eq.${orgId}`,
    }, (payload) => { /* manejar */ })
    .subscribe()

  channelRef.current = channel
  return () => { supabase.removeChannel(channel) }
}, [orgId])
```

- Casos apropiados para Realtime: notificaciones en tiempo real, dashboards live, edición colaborativa
- Casos no apropiados: listados que el usuario refresca manualmente (usar refetch)

---

## Changelog

**Regla obligatoria:** al finalizar cualquier tarea que modifique archivos del proyecto, Claude Code debe actualizar `CHANGELOG.md` en la raíz.

### Formato de entrada

```markdown
## YYYY-MM-DD — <título corto de la tarea>

- **Archivos modificados:** lista de rutas relativas
- **Qué cambió:** descripción en una o dos líneas de qué se hizo y por qué
```

### Reglas
- Una entrada por tarea/conversación (no una por archivo)
- Entradas nuevas van **arriba** (orden descendente)
- El título resume el objetivo, no los archivos ("Soft delete en branches" no "Editar BranchTable.tsx")
- Si la tarea incluye una migración SQL, mencionarla en la entrada
- No registrar cambios triviales de formato o correcciones de typos menores a menos que el usuario lo pida
- Al finalizar cualquier tarea que modifique archivos del proyecto, Claude Code debe debe de analizar si hay alguna nueva regla importante para actualizar, de ser así si el usuario aproba eso entonces la nueva regla se debe de escribir para que en futuras iteraciones Claude Code se comporte igual y tome los mismos criterios.

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
- No llamar a `supabase.storage` directamente desde componentes — usar funciones de `storage.ts`
- No mostrar `null` o un div vacío mientras carga — siempre usar `<Skeleton*>`
- No omitir `<EmptyState>` cuando una lista está vacía
- No usar `alert()` para errores — usar toast (acciones) o div inline (datos)
- No definir `PAGE_SIZE` en cada componente — importar de `src/lib/constants.ts`
- No usar `date-fns`, `dayjs` ni `moment` — usar `dateUtils.ts` + `Intl` nativo
- No suscribirse a Realtime sin filter de `organization_id`
