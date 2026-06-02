# Roadmap por sprints — Axiostock

Cada archivo es un sprint independiente. Están ordenados por impacto/esfuerzo: los primeros
no requieren migraciones y se ven desde el día 1; los últimos agregan RPCs y flujos nuevos.

---

| Sprint | Nombre | Archivos nuevos | Migración | Esfuerzo |
|--------|--------|-----------------|-----------|----------|
| [01](./sprint_01_dias_de_stock.md) | Días de stock y stock muerto en AdminInventory | — | No | Bajo |
| [02](./sprint_02_reposicion_po.md) | Pantalla de reposición con generación de PO | 1 página, 1 componente | Sí (RPC) | Medio |
| [03](./sprint_03_rentabilidad_por_producto.md) | Rentabilidad por producto | 1 página | Sí (columna + RPC) | Medio-alto |
| [04](./sprint_04_historial_caja.md) | Historial de diferencias de caja por operador | 1 componente | Sí (2 RPCs) | Medio |
| [05](./sprint_05_stock_movil.md) | Vista simplificada de stock móvil | 1 página | No | Bajo |
| [06](./sprint_06_importacion_clientes_proveedores.md) | Importación CSV de clientes y proveedores | 2 modales | No | Medio |
| [07](./sprint_07_ajustes_margen.md) | Ajustes negativos sospechosos + alerta de margen | 1 componente | Sí (2 RPCs) | Medio |

---

## Orden recomendado

```
Sprint 01  →  impacto inmediato, cero migración, solo AdminInventory
Sprint 05  →  también sin migración, habilita el caso de uso móvil
Sprint 02  →  cierra el loop de alertas de stock
Sprint 04  →  convierte la caja en herramienta anti-fraude
Sprint 03  →  requiere migración de datos — hacer cuando haya pocas órdenes sin costo
Sprint 06  →  mejora onboarding, independiente del resto
Sprint 07  →  detección de problemas silenciosos, puede hacerse en paralelo con cualquier otro
```

## Dependencias entre sprints

- **Sprint 03** depende de que el campo `unit_cost` en `order_items` exista antes de que
  se acumulen muchas órdenes. Hacerlo antes de tener > 500 órdenes para que el backfill
  sea más preciso.
- **Sprint 01** (días de stock) es un prerequisito conceptual para Sprint 02 (reposición),
  ya que usa la misma métrica de rotación. Hacer primero el 01.
- El resto son independientes entre sí.

## Convención de números de migración

Al momento de escribir este plan, la última migración es `126_organizations_soft_delete.sql`.
Los sprints asumen que las nuevas migraciones empiezan desde `127`. Verificar el número real
al momento de implementar cada sprint y ajustar si hace falta.
