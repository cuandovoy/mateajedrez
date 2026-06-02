# Sprint 4 — Historial de diferencias de caja por operador

## Objetivo

Agregar en `AdminCashRegister` una vista de historial que muestre las diferencias de caja
acumuladas por operador a lo largo del tiempo, con un gráfico de tendencia y alertas
cuando un operador repite diferencias negativas.

**Por qué cuarto**: convierte la caja en herramienta anti-fraude. Los datos ya existen en
`cash_sessions` (campo `difference` y `opened_by`). Solo falta exponerlos de forma que
el dueño pueda ver patrones, no solo el número de hoy.

---

## Archivos a crear

- `supabase/migrations/128_caja_historial_rpc.sql` — RPC de reporte de diferencias
- `src/components/admin/CajaHistorialPanel.tsx` — componente del panel

## Archivos a modificar

- `src/pages/admin/AdminCashRegister.tsx` — agregar pestaña "Historial"

> Ajustar el número de migración al siguiente disponible según el estado real del repo
> al momento de implementar.

---

## Migración SQL

```sql
-- 128_caja_historial_rpc.sql

CREATE OR REPLACE FUNCTION get_cash_session_history(
  p_organization_id UUID,
  p_date_from       DATE DEFAULT (CURRENT_DATE - INTERVAL '90 days')::DATE,
  p_date_to         DATE DEFAULT CURRENT_DATE,
  p_branch_id       UUID DEFAULT NULL
)
RETURNS TABLE (
  session_id        UUID,
  branch_name       TEXT,
  operator_id       UUID,
  operator_name     TEXT,
  opened_at         TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  opening_amount    NUMERIC,
  expected_amount   NUMERIC,
  closing_amount    NUMERIC,
  difference        NUMERIC,
  duration_minutes  INTEGER
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    cs.id                                                         AS session_id,
    b.name                                                        AS branch_name,
    cs.opened_by                                                  AS operator_id,
    COALESCE(up.full_name, 'Usuario eliminado')                   AS operator_name,
    cs.opened_at,
    cs.closed_at,
    cs.opening_amount,
    cs.expected_amount,
    cs.closing_amount,
    COALESCE(cs.closing_amount - cs.expected_amount, 0)           AS difference,
    EXTRACT(EPOCH FROM (cs.closed_at - cs.opened_at)) / 60       AS duration_minutes
  FROM cash_sessions cs
  JOIN branches b ON b.id = cs.branch_id
    AND b.organization_id = p_organization_id
    AND (p_branch_id IS NULL OR b.id = p_branch_id)
  LEFT JOIN user_profiles up ON up.user_id = cs.opened_by
  WHERE cs.closed_at IS NOT NULL
    AND cs.opened_at::DATE BETWEEN p_date_from AND p_date_to
  ORDER BY cs.opened_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_cash_operator_summary(
  p_organization_id UUID,
  p_date_from       DATE DEFAULT (CURRENT_DATE - INTERVAL '90 days')::DATE,
  p_date_to         DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  operator_id          UUID,
  operator_name        TEXT,
  total_sessions       BIGINT,
  sessions_with_faltante BIGINT,
  sessions_with_sobrante BIGINT,
  diferencia_total     NUMERIC,
  diferencia_promedio  NUMERIC,
  peor_sesion          NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    cs.opened_by                                                    AS operator_id,
    COALESCE(up.full_name, 'Usuario eliminado')                     AS operator_name,
    COUNT(*)                                                        AS total_sessions,
    COUNT(*) FILTER (WHERE cs.closing_amount < cs.expected_amount)  AS sessions_with_faltante,
    COUNT(*) FILTER (WHERE cs.closing_amount > cs.expected_amount)  AS sessions_with_sobrante,
    SUM(cs.closing_amount - cs.expected_amount)                     AS diferencia_total,
    ROUND(AVG(cs.closing_amount - cs.expected_amount), 2)           AS diferencia_promedio,
    MIN(cs.closing_amount - cs.expected_amount)                     AS peor_sesion
  FROM cash_sessions cs
  JOIN branches b ON b.id = cs.branch_id AND b.organization_id = p_organization_id
  LEFT JOIN user_profiles up ON up.user_id = cs.opened_by
  WHERE cs.closed_at IS NOT NULL
    AND cs.opened_at::DATE BETWEEN p_date_from AND p_date_to
  GROUP BY cs.opened_by, up.full_name
  ORDER BY diferencia_total ASC;
$$;

GRANT EXECUTE ON FUNCTION get_cash_session_history(UUID, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cash_operator_summary(UUID, DATE, DATE) TO authenticated;
```

---

## Implementación — `CajaHistorialPanel.tsx`

### Layout del panel

El panel tiene dos secciones:

**Sección 1 — Resumen por operador** (tabla siempre visible)

| Operador | Sesiones | Faltante (N) | Sobrante (N) | Diferencia total | Promedio | Peor sesión |
|----------|----------|--------------|--------------|-----------------|----------|-------------|

Highlight de filas:
- Diferencia total < -500 → fondo rojo claro
- Diferencia total entre -500 y 0 → fondo amarillo claro
- Diferencia total > 0 → fondo verde claro

```tsx
function DiferenciaCell({ value }: { value: number }) {
  return (
    <span className={cn(
      'font-mono text-sm font-medium',
      value < 0 ? 'text-red-600' : value > 0 ? 'text-green-600' : 'text-gray-500'
    )}>
      {value >= 0 ? '+' : ''}{formatPrice(value)}
    </span>
  )
}
```

**Sección 2 — Historial de sesiones** (tabla paginada, 25 por página)

| Fecha | Operador | Sucursal | Apertura | Esperado | Contado | Diferencia | Duración |
|-------|----------|----------|----------|----------|---------|------------|----------|

Diferencia en color (rojo/verde). Duración en formato "2h 15m".

**Filtros de la barra:**
- Rango de fechas (default: últimos 90 días)
- Sucursal
- Operador (select con los operadores del período)
- Toggle "Solo con faltante" (sessions_with_faltante > 0)

### Alerta de patrón sospechoso

Si un operador tiene `sessions_with_faltante / total_sessions > 0.5` (más de la mitad de
sus sesiones con faltante) Y `diferencia_total < -200`, mostrar un banner:

```tsx
{operadoresSospechosos.length > 0 && (
  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-red-800">Patrones a revisar</p>
        <p className="text-sm text-red-700 mt-0.5">
          {operadoresSospechosos.map(op => op.operator_name).join(', ')} tiene más del
          50% de sesiones con faltante en el período seleccionado.
        </p>
      </div>
    </div>
  </div>
)}
```

Los umbrales (50% / $200) son fijos en v1. En v2 hacerlos configurables en
`AdminNotificationSettings`.

---

## Integración en `AdminCashRegister.tsx`

Agregar una segunda pestaña al panel existente:

```tsx
// Tabs actuales:
// [Sesiones] → lista de sesiones abiertas/cerradas

// Agregar:
// [Sesiones] [Historial de diferencias]

<div className="flex gap-1 border-b border-gray-200 mb-6">
  <TabButton active={tab === 'sessions'} onClick={() => setTab('sessions')}>
    Sesiones
  </TabButton>
  <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
    Historial de diferencias
  </TabButton>
</div>

{tab === 'historial' && <CajaHistorialPanel organizationId={organizationId} />}
```

---

## Criterios de éxito

- [ ] Las RPCs devuelven datos correctos verificados contra registros conocidos
- [ ] El resumen por operador muestra los totales correctos
- [ ] El highlight de filas funciona según los umbrales definidos
- [ ] El historial de sesiones está paginado y muestra la diferencia en color
- [ ] El filtro por operador funciona correctamente
- [ ] El banner de patrón sospechoso aparece solo cuando corresponde
- [ ] Los filtros de fecha refetchean las RPCs
- [ ] La pestaña no rompe el layout existente de AdminCashRegister
- [ ] El loading/skeleton cubre ambas secciones del panel

---

## Notas

- `user_profiles` puede no tener el nombre de todos los usuarios (si se eliminaron).
  El `COALESCE(up.full_name, 'Usuario eliminado')` cubre ese caso.
- El campo `difference` en `cash_sessions` puede ser un campo calculado en la DB o puede
  no existir como columna (puede ser `closing_amount - expected_amount`). Verificar la
  migración original de `cash_sessions` y ajustar la query si es necesario.
- En v1 no hay gráfico de tendencia temporal (línea de diferencias por fecha). Si el
  usuario lo pide, agregar un `LineChart` de Recharts con las sesiones del operador
  seleccionado ordenadas por fecha.
