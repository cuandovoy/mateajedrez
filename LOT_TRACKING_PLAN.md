# Plan: Control de Lotes y Vencimientos

> "Si tarda más que anotar en un papel, nadie lo va a usar."

---

## Qué es y qué NO es este feature

**ES:** una página nueva `/inventory/lots` accesible como subitem de "Inventario" en el sidebar, para registrar lotes de mercadería recibida y ver de un vistazo qué vence pronto y qué lleva mucho tiempo parado.

**NO ES:** un reemplazo de nada existente. El inventario actual, los movimientos, las transferencias — todo sigue igual.

---

## Activación progresiva (sin configuración upfront)

El sistema arranca en modo simple para todos. No hay formulario de configuración ni decisiones que tomar antes de empezar.

| Estado | Cómo llega ahí |
|---|---|
| **Modo simple** (default) | Solo muestra producto, stock, días en depósito. Sin columna de vencimiento. |
| **Modo con vencimientos** | Se activa automáticamente cuando el usuario carga una fecha de vencimiento por primera vez. |

El sistema se adapta al uso, no al revés. Un negocio sin vencibles nunca ve esa columna. Un negocio con vencibles la activa sin darse cuenta al registrar su primer lote con fecha.

---

## Cambio en el sidebar

"Inventario" pasa de ítem simple a grupo expandible con dos subitems:

```
Catálogo
  ├── Productos
  ├── Categorías
  ├── ▶ Inventario
  │     ├── Stock actual    →  /inventory        (sin cambios)
  │     └── Lotes           →  /inventory/lots   (nuevo)
  ├── Proveedores
  └── Sucursales
```

Se expande automáticamente cuando la ruta activa empieza con `/inventory`.

---

## UI/UX

### Tabla principal

Todo vive en una sola pantalla. Agregar lotes, ver vencimientos existentes y filtrar — todo desde acá.

```
Lotes de inventario                          [+ Recibí mercadería]

🔴 3 vencen esta semana  🟡 5 vencen este mes  ⏱️ 4 parados +60 días

[Todas las sucursales ▾]  [🔍 Buscar...]  [Todos] [🔴] [🟡] [⏱️]

Producto          Stock   Vence     Días rest.  En depósito   Sucursal
─────────────────────────────────────────────────────────────────────
🔴 Yogur 500g      24     15/05      3 días       28 días      Centro
🔴 Leche 1L        12     17/05      5 días       14 días      Centro
🟡 Queso 200g      30     28/05     18 días       10 días      Depósito
🟢 Manteca 200g    60     20/06     45 días        5 días      Centro
⬜ Arroz largo     200      —          —          92 días ⚠️   Depósito
⬜ Aceite 900ml     48      —          —          75 días ⚠️   Centro
```

**Colores:** 🔴 vence ≤7 días · 🟡 vence 8–30 días · 🟢 vence >30 días · ⚠️ parado más del umbral configurado

**Filtros:** sucursal, buscador por nombre, `[🔴]` urgentes, `[🟡]` este mes, `[⏱️]` parados

**Columna "Vence":** solo aparece si la org tiene al menos un lote con fecha de vencimiento cargada.

### Panel lateral (click en fila)

Se abre a la derecha sin abandonar la tabla. Muestra detalle, historial de movimientos, y acciones (baja, ajuste).

### Flujo "Recibí mercadería" — 3 pasos

1. Buscar producto
2. Ingresar cantidad (+ dañados opcional)
3. Fecha de vencimiento (opcional) + "más datos" colapsado (proveedor, costo, remito)

Al confirmar la fila aparece en la tabla sin recargar.

### Configuración (opcional, desde Ajustes de organización)

- Umbral de días parados para mostrar ⚠️ (default: 60)
- Días de anticipación para alertas de vencimiento (default: 7)

No hay configuración obligatoria antes de empezar.

---

## Archivos

### Nuevos
```
supabase/migrations/123_inventory_lots.sql
src/pages/admin/AdminLots.tsx
src/components/admin/LotReceptionModal.tsx
src/components/admin/LotDetailPanel.tsx
src/components/admin/LotWriteOffModal.tsx
src/hooks/useLots.ts
```

### Modificados
```
src/types/database.types.ts          → agregar inventory_lots (Row/Insert/Update)
src/components/layout/AdminLayout.tsx → subItems en Inventario
src/App.tsx                           → ruta /inventory/lots
```

---

## Fases

### Fase 1 — Base ✅ (arranque)
- Migración SQL + tipos + sidebar + ruta

### Fase 2 — Tabla y carga (valor mínimo)
- AdminLots, LotReceptionModal, LotDetailPanel, LotWriteOffModal, useLots

### Fase 3 — Alertas automáticas
- Notificación in-app al vencer · badge en sidebar

### Fase 4 — Más valor
- Columna valor en pesos · FEFO automático al vender

### Fase 5 — Avanzado
- Exportar CSV · imprimir etiqueta · vincular a remito
