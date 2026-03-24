# Axios — Plan de Mejoras
> Análisis completo de landing page y panel de administración
> Priorizado por impacto. Listo para implementar.

---

## Contexto

**Producto:** Axios (axiostock.com) — SaaS de control de stock y gestión comercial
**Stack visible:** React + Vite (localhost:5173), rutas SPA
**Mercado:** Latinoamérica, español rioplatense
**Planes:** Starter y Profesional (sin precios visibles actualmente)

---

## 🔴 PRIORIDAD ALTA — Impacto directo en conversión y retención

### 1. Landing: Mostrar precios en la sección de planes

**Problema:** Los planes Starter y Profesional existen pero no muestran ningún número. Esto genera fricción y manda al usuario a comparar con competidores que sí muestran precios.

**Solución:**
- Agregar precio mensual y anual en cada card de plan
- Agregar badge de ahorro en el plan anual (ej: "Ahorrá 20%")
- Agregar el precio directamente en el CTA: `Comenzar con Starter — $X/mes`
- Agregar toggle mensual/anual sobre las cards

**Archivo a editar:** componente de la sección `#planes` en la landing

---

### 2. Landing: Reemplazar placeholder de video demo

**Problema:** La sección "Mirá el sistema en acción" tiene texto literal `"Agregá tu video de YouTube o Vimeo aquí"` visible en producción. Destruye la credibilidad en el momento más crítico.

**Solución (dos opciones, implementar la que aplique):**
- **Opción A:** Incrustar el video real de YouTube/Vimeo con iframe responsive
- **Opción B:** Si no hay video aún, ocultar la sección completa hasta tenerlo

```jsx
// Opción A — iframe responsive
<div className="aspect-video w-full rounded-xl overflow-hidden">
  <iframe
    src="https://www.youtube.com/embed/VIDEO_ID"
    className="w-full h-full"
    allowFullScreen
  />
</div>
```

---

### 3. Landing: Agregar testimonios reales

**Problema:** La sección "Testimonios" aparece en el nav pero el contenido está vacío.

**Solución:**
- Si hay clientes reales: agregar 3–5 testimonios con nombre, empresa, foto (o avatar), y texto
- Si no hay testimonios aún: ocultar el item del nav y la sección hasta tenerlos
- Formato sugerido: card con foto pequeña, cita en comillas, nombre + rol + empresa

---

### 4. Admin — Dashboard: Agregar variación vs período anterior en métricas

**Problema:** Las 8 tarjetas del dashboard muestran números absolutos sin contexto. "Ingresos de Hoy: $0" no le dice nada al usuario sin saber si ayer fueron $500 o $5.

**Solución:**
- Agregar indicador de variación porcentual en cada card (vs mismo período anterior)
- Color verde con ↑ si mejoró, rojo con ↓ si empeoró, gris si es igual
- Ejemplo: `$ 153.102 · ↑ 12% vs mes anterior`

```tsx
// Estructura sugerida para cada MetricCard
interface MetricCardProps {
  title: string
  value: string
  subtitle: string
  delta?: { value: number; label: string } // ej: { value: 12, label: "vs mes anterior" }
  icon: ReactNode
}
```

---

### 5. Admin — Clientes: Agregar historial y métricas por cliente

**Problema:** El módulo de clientes solo muestra nombre, contacto y dirección. No hay ningún dato comercial. No se puede saber cuánto gastó un cliente, cuándo fue la última vez que compró, ni qué productos prefiere.

**Solución — Vista de detalle de cliente (nueva página `/customers/:id`):**
- Total gastado (suma de todas sus órdenes)
- Cantidad de órdenes
- Fecha de primera y última compra
- Listado de órdenes del cliente con estado y monto
- Productos más comprados (top 3–5)
- Botón para crear nueva orden asociada al cliente

**Navegación:** Click en el nombre del cliente en la tabla → abre la vista de detalle

---

## 🟡 PRIORIDAD MEDIA — UX y funcionalidad operativa

### 6. Admin — Inventario: Agregar vista cruzada por producto

**Problema:** La vista actual filtra por sucursal. Para ver el stock de un producto en todas las sucursales hay que cambiar el filtro manualmente varias veces.

**Solución:** Agregar tab o toggle "Ver por producto":
- Filas = productos
- Columnas = sucursales
- Celda = stock actual + stock mínimo
- Resaltar en rojo las celdas con stock bajo el umbral
- Permitir editar el stock directo desde la celda (click inline)

```
| Producto              | Sucursal A | Depósito B | Sucursal C |
|-----------------------|------------|------------|------------|
| Martillo carpintero   | 13 ✓       | 2 ⚠        | 0 🔴       |
| Clavos 2" x 1kg       | 1 🔴       | 45 ✓       | 12 ✓       |
```

---

### 7. Admin — Órdenes: Mostrar datos reales del cliente en compras online

**Problema:** Todas las órdenes del e-commerce aparecen con "Cliente en tienda" aunque el comprador haya dejado su nombre y email en el checkout.

**Solución:**
- Mostrar nombre real del comprador (o email si no hay nombre)
- Si el cliente existe en el CRM, linkear a su perfil
- Si no existe, mostrar badge "Invitado" con los datos disponibles
- Mover el filtro "Descuento" del header al panel expandido de filtros (es un filtro de uso poco frecuente)

---

### 8. Admin — Productos: Búsqueda en tiempo real (sin botón)

**Problema:** El campo de búsqueda de productos requiere hacer clic en "Buscar" para disparar la consulta. Añade fricción innecesaria.

**Solución:**
- Disparar búsqueda con debounce (300–500ms) al tipear
- Mantener el botón como fallback opcional, pero no requerirlo
- Aplicar la misma lógica en el buscador de Órdenes y Clientes

```tsx
const [query, setQuery] = useState("")
const debouncedQuery = useDebounce(query, 400)

useEffect(() => {
  fetchProducts({ search: debouncedQuery })
}, [debouncedQuery])
```

---

### 9. Admin — Productos: Edición masiva

**Problema:** Para cambiar el precio, estado o categoría de varios productos hay que editarlos uno por uno.

**Solución:**
- Agregar checkbox en cada fila del listado
- Al seleccionar 2+ productos aparece una barra de acción flotante
- Acciones masivas disponibles: cambiar estado (activo/inactivo), cambiar categoría, ajustar precio en %

```
[✓] 3 productos seleccionados  |  Cambiar estado ▼  |  Cambiar categoría ▼  |  Ajustar precio ▼  |  Cancelar
```

---

### 10. Admin — Dashboard: Agregar mini gráfico de ventas recientes

**Problema:** El dashboard no tiene ningún gráfico. El usuario tiene que ir a Reportes > Ventas para ver cualquier tendencia.

**Solución:**
- Agregar un gráfico de barras de los últimos 7 o 14 días debajo de las cards de métricas
- Datos: ingresos por día (barra) + número de órdenes (línea)
- Usar la misma librería de gráficos ya instalada en el proyecto (verificar si usan Recharts, Chart.js, etc.)
- Sin filtros — siempre muestra los últimos 14 días como snapshot

---

### 11. Admin — Auditoría: Mejorar usabilidad de filtros

**Problema:** Los filtros de "ID de Registro" y "ID de Usuario" requieren UUIDs — datos técnicos que un usuario de negocio no maneja.

**Solución:**
- Reemplazar "ID de Usuario" por un select/search con nombres de usuarios reales
- Reemplazar "ID de Registro" por texto de búsqueda libre en "Resumen de cambio"
- Agregar filtro por "Módulo" (dropdown con los módulos del sistema)
- Mantener los filtros técnicos colapsados en un accordeon "Filtros avanzados"

---

### 12. Admin — Punto de Venta: Mejorar estado vacío

**Problema:** Cuando no hay caja abierta, el estado vacío es confuso y no da contexto suficiente para un usuario nuevo.

**Solución:**
- Mejorar el copy del estado vacío: explicar en 1–2 líneas qué es una sesión de caja y para qué sirve
- Hacer el botón "Abrir Caja" más prominente (más grande, con ícono)
- Agregar link a documentación o tooltip explicativo

---

## 🟢 PRIORIDAD BAJA — Polish y detalle

### 13. Landing: Mejorar diferenciación de la propuesta de valor

**Problema:** "Tu negocio completo, en un solo lugar" es genérico y similar a la mayoría de SaaS all-in-one.

**Sugerencias de copy alternativo que enfatizan el mercado local:**
- "El sistema que necesitaban los negocios uruguayos"
- "Inventario, tienda y caja — todo en español, todo sin vueltas"
- "Dejá las planillas de Excel. Axis hace el trabajo."

---

### 14. Landing: Agregar micro-badges de confianza en el nav

**Sugerencia:** Agregar junto al logo o debajo del nav alguna señal de confianza:
- "Usado por X negocios en Uruguay"
- Logos de medios si hubo cobertura
- Rating de Google / Trustpilot si aplica

---

### 15. Admin — General: Alertas accionables en el dashboard

**Mejora:** Cuando hay condiciones que requieren atención, mostrarlas proactivamente:

```
⚠ 3 productos con stock bajo el umbral → Ver inventario
📦 2 órdenes con cobro pendiente → Ver órdenes
```

Mostrar estas alertas como banner/toast dismissible en la parte superior del dashboard, solo cuando sean relevantes.

---

### 16. Admin — Reportes Financiero: Gráfico visible sin aplicar filtros

**Problema:** El gráfico "Cobros vs Egresos diarios" requiere aplicar filtros antes de renderizarse. La primera vista es siempre vacía.

**Solución:** Cargar el gráfico con el período default (mes actual) sin que el usuario tenga que hacer clic en "Aplicar filtros".

---

## 📋 Resumen de tareas por archivo/módulo

| # | Área | Tipo | Esfuerzo estimado |
|---|------|------|-------------------|
| 1 | Landing — Planes | UI + Config | Bajo |
| 2 | Landing — Demo | UI | Muy bajo |
| 3 | Landing — Testimonios | UI + Contenido | Bajo |
| 4 | Dashboard — Métricas | UI + Backend | Medio |
| 5 | Clientes — Detalle | UI + Backend | Alto |
| 6 | Inventario — Vista cruzada | UI + Backend | Alto |
| 7 | Órdenes — Cliente real | UI + Backend | Medio |
| 8 | Productos — Búsqueda live | Frontend | Bajo |
| 9 | Productos — Edición masiva | UI + Backend | Medio |
| 10 | Dashboard — Gráfico ventas | UI + Backend | Medio |
| 11 | Auditoría — Filtros | UI | Bajo |
| 12 | POS — Estado vacío | UI | Muy bajo |
| 13–16 | Polish varios | UI | Bajo cada uno |

---

## 🚀 Orden de implementación sugerido

**Sprint 1 — Conversión (landing):**
→ #2 (video), #1 (precios), #3 (testimonios)

**Sprint 2 — Retención core:**
→ #4 (métricas con delta), #5 (historial cliente), #8 (búsqueda live)

**Sprint 3 — Operativa:**
→ #6 (inventario cruzado), #7 (cliente en órdenes), #9 (edición masiva)

**Sprint 4 — Reportes y polish:**
→ #10, #11, #12, #13–16

---

*Plan generado a partir de análisis directo del sistema — landing axiostock.com/landing/app y panel localhost:5173*
