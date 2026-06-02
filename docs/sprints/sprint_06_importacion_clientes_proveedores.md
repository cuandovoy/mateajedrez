# Sprint 6 — Importación CSV de clientes y proveedores

## Objetivo

Extender el sistema de importación masiva (ya existente para productos) a clientes y
proveedores. Reduce el tiempo de onboarding de días a horas para el negocio que viene
de Excel.

**Por qué sexto**: el patrón ya está construido en `ProductImportModal.tsx`. Este sprint
es principalmente copiar y adaptar ese patrón, no inventar nada nuevo.

---

## Archivos a crear

- `src/components/admin/CustomerImportModal.tsx`
- `src/components/admin/SupplierImportModal.tsx`

## Archivos a modificar

- `src/pages/admin/AdminCustomers.tsx` — agregar botón + modal
- `src/pages/admin/AdminSuppliers.tsx` — agregar botón + modal

No se requieren migraciones SQL.

---

## Plantilla CSV — Clientes

```
nombre,email,telefono,rut,direccion,ciudad,notas
Juan García,juan@gmail.com,+598 99 123 456,12345678901,Av. 18 de Julio 1234,Montevideo,Cliente frecuente
```

Campos:
| Campo | Requerido | Validación |
|-------|-----------|------------|
| `nombre` | Sí | Min 2 caracteres |
| `email` | No | Formato email válido si se provee |
| `telefono` | No | Sin validación estricta en v1 |
| `rut` | No | Si se provee: 12 dígitos (sin puntos ni guiones) |
| `direccion` | No | Texto libre |
| `ciudad` | No | Texto libre |
| `notas` | No | Texto libre |

Deduplicación: si ya existe un cliente con el mismo `email` → saltar la fila (no
actualizar). Si ya existe con el mismo `rut` → saltar. Reportar como "ya existe".

---

## Plantilla CSV — Proveedores

```
nombre,contacto,email,telefono,rut,direccion,ciudad,pais,sitio_web,notas
Distribuidora Norte,Carlos López,carlos@dnorte.com,+598 2 123 4567,211234560016,Ruta 5 km 10,Montevideo,Uruguay,www.dnorte.com,Proveedor de lácteos
```

Campos:
| Campo | Requerido | Validación |
|-------|-----------|------------|
| `nombre` | Sí | Min 2 caracteres |
| `contacto` | No | Nombre del contacto en la empresa |
| `email` | No | Formato email válido si se provee |
| `telefono` | No | Sin validación estricta |
| `rut` | No | 12 dígitos sin formato |
| `direccion` | No | Texto libre |
| `ciudad` | No | Texto libre |
| `pais` | No | Default "Uruguay" si vacío |
| `sitio_web` | No | Texto libre |
| `notas` | No | Texto libre |

Deduplicación: si ya existe proveedor con mismo `nombre` (case-insensitive) → saltar.

---

## Implementación — `CustomerImportModal.tsx`

Copiar la estructura de `ProductImportModal.tsx` y adaptar:

### Diferencias con ProductImportModal

1. **Sin selector de sucursal** — los clientes no tienen stock.
2. **Sin categorías** — no hay creación automática de entidades relacionadas.
3. **Deduplicación por email o RUT** — al cargar el modal, fetchear emails y RUTs existentes
   para validación en el preview.
4. **Insert más simple** — un solo batch insert a la tabla `customers`.

### Fetch de datos existentes al montar

```typescript
useEffect(() => {
  async function loadExisting() {
    const { data } = await supabase
      .from('customers')
      .select('email, rut')
      .eq('organization_id', organizationId)
      .not('email', 'is', null)

    const emails = new Set((data ?? []).map(c => c.email?.toLowerCase()).filter(Boolean))
    const ruts   = new Set((data ?? []).map(c => c.rut).filter(Boolean))
    setExistingEmails(emails)
    setExistingRuts(ruts)
  }
  loadExisting()
}, [organizationId])
```

### Validaciones por fila

```typescript
function validarFilaCliente(row: Record<string, string>, index: number): ParsedRowCliente {
  const errors: string[] = []
  const nombre = row['nombre']?.trim() ?? ''
  const email  = row['email']?.trim().toLowerCase() ?? ''
  const rut    = row['rut']?.replace(/\D/g, '') ?? ''

  if (!nombre || nombre.length < 2) errors.push('Nombre requerido (mínimo 2 caracteres)')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email inválido')
  if (email && existingEmails.has(email)) errors.push('Ya existe un cliente con este email')
  if (rut && existingRuts.has(rut)) errors.push('Ya existe un cliente con este RUT')

  return { rowIndex: index, nombre, email: email || null, rut: rut || null, /* ... */ , errors }
}
```

### Import

```typescript
const inserts = validRows.map(row => ({
  full_name:       row.nombre,
  email:           row.email,
  phone:           row.telefono || null,
  rut:             row.rut || null,
  address:         row.direccion || null,
  city:            row.ciudad || null,
  notes:           row.notas || null,
  is_active:       true,
  organization_id: organizationId,
}))

await supabase.from('customers').insert(inserts)
```

---

## Implementación — `SupplierImportModal.tsx`

Misma estructura. Diferencias:

### Fetch de datos existentes

```typescript
const { data } = await supabase
  .from('suppliers')
  .select('name')
  .eq('organization_id', organizationId)

const nombres = new Set((data ?? []).map(s => s.name.toLowerCase()))
setExistingNames(nombres)
```

### Validaciones

```typescript
if (!nombre || nombre.length < 2) errors.push('Nombre requerido')
if (existingNames.has(nombre.toLowerCase())) errors.push('Ya existe un proveedor con este nombre')
```

### Import

```typescript
const inserts = validRows.map(row => ({
  name:            row.nombre,
  contact_name:    row.contacto || null,
  email:           row.email || null,
  phone:           row.telefono || null,
  tax_id:          row.rut || null,
  address:         row.direccion || null,
  city:            row.ciudad || null,
  country:         row.pais || 'Uruguay',
  website:         row.sitio_web || null,
  notes:           row.notas || null,
  is_active:       true,
  organization_id: organizationId,
}))

await supabase.from('suppliers').insert(inserts)
```

---

## Integración en AdminCustomers y AdminSuppliers

Mismo patrón que en `AdminProducts`:

**AdminCustomers.tsx:**
```tsx
import { CustomerImportModal } from '@/components/admin/CustomerImportModal'

// Estado:
const [isImportModalOpen, setIsImportModalOpen] = useState(false)

// Botón en toolbar (antes de "Nuevo cliente"):
<Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
  <Upload className="h-4 w-4 mr-2" />
  Importar
</Button>

// Modal:
{isImportModalOpen && (
  <CustomerImportModal
    organizationId={organizationId!}
    onClose={() => setIsImportModalOpen(false)}
    onImported={() => fetchCustomers()}
  />
)}
```

**AdminSuppliers.tsx:** mismo patrón con `SupplierImportModal`.

---

## Plantillas descargables

Cada modal incluye el mismo botón de descarga de plantilla que `ProductImportModal`:

```typescript
function downloadTemplate(tipo: 'clientes' | 'proveedores') {
  const headers = tipo === 'clientes'
    ? 'nombre,email,telefono,rut,direccion,ciudad,notas'
    : 'nombre,contacto,email,telefono,rut,direccion,ciudad,pais,sitio_web,notas'

  const ejemplos = tipo === 'clientes'
    ? 'Juan García,juan@gmail.com,+598 99 123 456,12345678901,Av. 18 de Julio 1234,Montevideo,Cliente frecuente'
    : 'Distribuidora Norte,Carlos López,carlos@dnorte.com,+598 2 123 4567,211234560016,Ruta 5 km 10,Montevideo,Uruguay,www.dnorte.com,Proveedor de lácteos'

  const csv = '﻿' + headers + '\n' + ejemplos  // BOM para Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plantilla_${tipo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Criterios de éxito

- [ ] La plantilla de clientes se descarga con BOM y abre correctamente en Excel
- [ ] La plantilla de proveedores ídem
- [ ] El preview muestra filas válidas e inválidas con errores claros
- [ ] Clientes con email o RUT duplicado muestran error "Ya existe" en el preview
- [ ] Proveedores con nombre duplicado muestran error en el preview
- [ ] El import batch inserta correctamente en `customers` con `organization_id`
- [ ] El import batch inserta correctamente en `suppliers` con `organization_id`
- [ ] Después del import se refetchea la lista y aparece toast de éxito con N importados / M saltados
- [ ] Los modales siguen el diseño de 4 pasos de `ProductImportModal`
- [ ] El parser CSV maneja correctamente campos con comas (entre comillas)

---

## Notas

- El parser CSV de `ProductImportModal.tsx` (`parseCSV`, `parseCSVLine`) puede extraerse a
  un helper compartido en `src/lib/csvUtils.ts` para no duplicar código. Evaluar si vale
  la pena en este sprint o simplemente copiar.
- En v1 no actualizar clientes/proveedores existentes — solo insertar nuevos. La política
  de "si ya existe, saltear" es la más segura para no pisar datos que el usuario ya editó.
- El campo `rut` en `customers` corresponde al RUT uruguayo. En `suppliers` es `tax_id`
  (más genérico). Verificar los nombres reales de columnas en `database.types.ts` antes
  de implementar.
