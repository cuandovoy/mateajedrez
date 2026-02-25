# Plan Escalable: Registro de Egresos (Compras / Recepción de Mercadería)

## Estado actual (decisión de implementación)
- **Alcance activo**: implementar primero **Fase 1 + Fase 2**.
- **Objetivo inmediato**: registrar egresos reales (recepción, factura y pago) y poder consultarlos.
- **Siguiente etapa activa**: **Fase 3** (costeo y margen real en ventas).
- **Siguiente etapa activa**: **Fase 5** (hardening y observabilidad).
- **Diferido**: mejoras avanzadas de observabilidad (alertas y métricas de infraestructura).

### Checklist de avance (Fase 1-2)
- [x] Diseño final de tablas y relaciones.
- [x] Migraciones SQL + índices + constraints.
- [x] RLS por `organization_id`.
- [x] RPC/servicios transaccionales para recepción y registro de pago.
- [x] UI de Orden de Compra + Recepción.
- [x] UI de Factura de Proveedor + Pagos.
- [x] Vista de egresos consolidados (`expense_ledger`) con filtros y paginación.
- [x] Cobertura funcional de casos clave en UI/flujo: recepción parcial, pago parcial y reverso de pago.

### Cierre de Fase 1-2
- El módulo ya permite operar de punta a punta: **Orden de Compra -> Recepción -> Factura -> Pago/Reverso -> Libro de Egresos**.
- El libro de egresos cuenta con filtros por fecha, proveedor, tipo de registro y tipo de evento, además de paginación.
- Desde facturas de proveedor se puede registrar pago y revertir el último pago registrado.
- Los flujos manuales de inventario (ingreso/ajuste) quedaron explicitados como **operativos sin impacto contable**, para evitar confusión con compras reales.

### Avance Fase 3 (inicio)
- [x] Migración base para costeo por sucursal (promedio ponderado) y snapshot de costo/margen en venta.
- [x] `post_goods_receipt` actualizado para recalcular `avg_unit_cost` y `last_purchase_unit_cost` en `branch_inventory`.
- [x] Trigger en `order_items` para guardar `cost_at_sale`, `margin_at_sale`, `margin_percentage_at_sale` y `cost_source`.
- [x] Exponer métricas de margen en reportes de ventas (UI + RPC).
- [x] Validar escenarios con branch faltante y ventas históricas sin costo.

### Cierre Fase 3
- El reporte de ventas ahora incluye margen bruto y cobertura de costo trazado.
- Se agregó desglose de items sin costo trazado por causa:
  - `branch_missing`
  - `inventory_cost_missing`
  - otros casos
- La UI muestra advertencia explícita cuando existen ventas sin costo trazado en el período.

### Avance Fase 4 (inicio)
- [x] RPC financiero base (`get_financial_report_summary`) para:
  - ventas vs egresos diarios/mensuales;
  - resumen de flujo neto;
  - cuentas por pagar (aging);
  - top proveedores con deuda.
- [x] Vista UI de Reporte Financiero conectada al RPC.
- [x] Optimizar para alto volumen con materialized views + refresh manual desde UI.
- [x] Exportación backend paginada para reportes financieros grandes (`export_financial_report_rows`) + descarga CSV en UI.

### Cierre Fase 4
- Reportería financiera corre sobre `materialized views` para alto volumen.
- Se expuso refresh manual de agregados desde UI.
- Se agregó RPC de exportación backend paginada para evitar armar datasets gigantes en frontend.
- La vista financiera ya exporta CSV consumiendo lotes desde backend (apto para volúmenes grandes).

### Avance Fase 5 (inicio)
- [x] Definir checklist ejecutable de hardening y observabilidad.
- [x] Comenzar trazabilidad explícita de acciones de negocio en Compras y Egresos (`AdminExpenses`) usando `create_audit_log`.
- [~] Extender tracking de acciones al resto de módulos críticos (Inventario, Ventas, Caja, Usuarios y Configuración).
- [ ] Estandarizar catálogo de acciones/notas de auditoría para consultas consistentes.
- [ ] Exponer vista/resumen operativo de auditoría por módulo y por usuario.
- [ ] Instrumentar métricas técnicas de RPC (latencia, errores, volumen) para monitoreo.

### Flujo operativo (interfaz actual)
El modulo se usa con enfoque **listado primero** para reducir complejidad:

1. Entrar a **Compras y egresos** y revisar el listado de ordenes de compra.
2. Seleccionar una orden para abrir su editor completo en la derecha.
3. Editar datos principales de la orden (proveedor, sucursal, estado, notas).
4. Gestionar todos los productos de la orden desde la misma pantalla:
- agregar productos;
- revisar cantidades pedidas/recibidas;
- eliminar productos si corresponde.
5. Ejecutar acciones contextuales desde esa orden:
- crear y confirmar recepcion de mercaderia;
- crear factura de proveedor desde la orden.
6. Registrar pago de factura en bloque separado y revisar libro de egresos.

Este enfoque evita mostrar muchos formularios simultaneos y mejora la navegacion para usuarios operativos.

Flujo de datos esperado:

1. Crear **orden de compra**: definir proveedor y sucursal.
2. Agregar **productos a la orden de compra**: cantidad y costo unitario.
3. Crear **recepcion de mercaderia** desde la orden.
4. Confirmar la recepcion:
- al confirmar, impacta stock en `branch_inventory`;
- se registra movimiento en `inventory_movements`.
5. Crear **factura de proveedor** con montos (subtotal, impuestos, descuentos, total).
6. Emitir factura y luego **registrar pago** (total o parcial).
7. Consultar **libro de egresos** para ver:
- devengado (`invoice`);
- caja (`payment` y `payment_reversal`).

### Progreso visual en pantalla
La vista de Compras y Egresos muestra una barra de progreso sobre 6 pasos:

1. Crear orden de compra.
2. Agregar productos a la orden.
3. Crear recepcion de mercaderia.
4. Confirmar recepcion.
5. Crear o emitir factura de proveedor.
6. Registrar pago al proveedor.

Cada paso se marca como `Completado` o `Pendiente` en base a datos reales guardados.

## 1. Objetivo del módulo
Construir un módulo de egresos que registre con precisión la salida de dinero por compras de mercadería, mantenga trazabilidad de costos por producto/variante y permita calcular márgenes reales en reportes (ganancia bruta y neta por período, sucursal y categoría).

## 2. Principios de diseño (para escalar)
- **Libro mayor inmutable**: no “pisar” movimientos; registrar eventos nuevos (ajuste, corrección, anulación) para auditoría completa.
- **Separación de responsabilidades**: compras/recepción, inventario, cuentas por pagar y reportes desacoplados en tablas y servicios.
- **Costo histórico por lote**: el costo de compra no debe depender del costo actual del producto.
- **Multi-tenant first**: todas las entidades críticas con `organization_id` y políticas RLS estrictas.
- **Cálculos pesados fuera del frontend**: agregaciones en SQL (vistas/materialized views/RPC), no en cliente.
- **Idempotencia operativa**: evitar duplicar recepciones o pagos por doble click/reintento.

## 3. Fases recomendadas de implementación

### Fase 1: Base contable-operativa mínima
1. Crear entidad `purchase_orders` (cabecera): proveedor, sucursal destino, moneda, estado, total esperado.
2. Crear `purchase_order_items`: producto/variante, cantidad pedida, costo unitario, impuestos, descuentos.
3. Crear `goods_receipts`: recepción real (parcial o total) vinculada a orden de compra.
4. Crear `goods_receipt_items`: cantidad recibida y **costo unitario real** por línea.
5. Al confirmar recepción:
- insertar movimiento de inventario tipo `receipt`;
- persistir costo recibido por lote;
- actualizar stock por sucursal.

**Entregable esperado de Fase 1**:
- Flujo operativo completo: crear OC -> recibir mercadería (parcial/total) -> impactar stock.
- Trazabilidad por documento y por movimiento de inventario.

### Fase 2: Registro de egresos monetarios
1. Crear `supplier_invoices` (documento fiscal del proveedor).
2. Crear `supplier_payments` (uno o múltiples pagos por factura: efectivo, transferencia, etc.).
3. Crear `expense_ledger` (libro de egresos consolidado): evento económico normalizado para reportes.
4. Soportar escenarios:
- compra y pago en el mismo momento;
- compra a crédito con pagos parciales;
- notas de crédito/devoluciones.

**Entregable esperado de Fase 2**:
- Egreso registrado con trazabilidad financiera (factura + pago/s).
- Consulta consolidada de egresos por fecha, proveedor, sucursal y estado.

### Fase 3: Costeo para márgenes reales
1. Definir método de costeo inicial recomendado: **promedio ponderado por sucursal**.
2. Guardar snapshot de costo aplicado al vender en `order_items` (`cost_at_sale`, `margin_at_sale`).
3. Evitar recalcular costos históricos con costo actual del producto.
4. Preparar compatibilidad futura con FIFO (si luego quieren mayor precisión contable).

### Fase 4: Reportes y performance
1. Crear vistas SQL para:
- egresos diarios/mensuales;
- ventas vs egresos;
- margen bruto por sucursal/categoría/producto;
- cuentas por pagar (aging).
2. Para alto volumen, migrar a `materialized views` + refresh programado.
3. Exponer RPCs paginados/filtrables (rango fechas, sucursal, proveedor, estado).
4. Agregar exportación a Excel desde backend (no armado manual grande en frontend).

### Fase 5: Gobierno de datos y observabilidad
1. Auditoría: `created_by`, `approved_by`, timestamps, motivo de ajustes.
2. Estados explícitos y máquinas de estado simples (draft, posted, cancelled).
3. Soft delete solo cuando aplique; para financiero, preferir reversos.
4. Métricas técnicas: tiempo de query, filas escaneadas, tasa de errores, timeouts.

Checklist ejecutable de Fase 5:

1. Auditoría funcional por módulo
- [x] Compras y Egresos: registrar acciones de crear/editar orden, agregar/eliminar ítems, recepción, factura, pago y reverso.
- [x] Inventario: ajustes, transferencias, recepciones manuales y cambios de umbrales.
- [x] Ventas: cubierto venta manual + cobro + cambios de estado/edición de orden, anulación completa con motivo y devoluciones parciales por ítem con restauración de stock.
- [x] Caja: apertura/cierre de sesión y eliminación de sesión.

2. Gobierno de estados
- [ ] Definir y documentar transiciones válidas por entidad (`purchase_orders`, `goods_receipts`, `supplier_invoices`, `supplier_payments`). **Pendiente para implementar luego**.
- [ ] Reforzar transiciones con validaciones en RPC/DB y mensajes claros de error. **Pendiente para implementar luego**.

3. Inmutabilidad financiera
- [ ] Revisar y bloquear edición destructiva en documentos posteados. **Pendiente para implementar luego**.
- [ ] Forzar flujo por reversos/asientos compensatorios donde corresponda. **Pendiente para implementar luego**.

4. Observabilidad técnica
- [ ] Crear RPC de health/metrics operativas para reportes críticos.
- [ ] Medir latencia y errores de RPC clave (`post_goods_receipt`, `post_supplier_invoice`, `register_supplier_payment`, reportes).
- [ ] Definir umbrales y alertas para degradación de performance.

## 4. Modelo de datos sugerido (alto nivel)
- `purchase_orders`
- `purchase_order_items`
- `goods_receipts`
- `goods_receipt_items`
- `supplier_invoices`
- `supplier_payments`
- `expense_ledger`
- `inventory_cost_layers` (si implementan costo por lote/FIFO)

Campos base recomendados para todas:
- `id`, `organization_id`, `branch_id` (cuando corresponda)
- `created_at`, `updated_at`, `created_by`
- `status`
- `metadata` JSONB para extensibilidad controlada

## 5. Recomendaciones técnicas de escalabilidad
- Índices compuestos en filtros más usados: `(organization_id, created_at)`, `(organization_id, branch_id, created_at)`, `(organization_id, supplier_id, status)`.
- Particionado por fecha cuando el volumen histórico crezca fuerte (ej. `expense_ledger`, `inventory_movements`).
- Jobs asíncronos para recalcular agregados pesados y exportaciones grandes.
- Contratos de API estables (DTOs/versionado) para no romper frontend al evolucionar tablas.
- Tests de concurrencia en recepciones y pagos (doble procesamiento).

## 6. Buenas prácticas funcionales
- Permitir recepción parcial de OC y cierre automático cuando completa.
- Bloquear edición de costos luego de “postear” documento; usar ajuste/reverso.
- Separar claramente `cantidad recibida` vs `cantidad facturada`.
- Registrar impuestos, descuentos y flete para costo real final.
- Manejar moneda y tipo de cambio si habrá compras multi-moneda.

## 7. Roadmap sugerido (orden de ejecución)
1. **Sprint 1**: tablas base + flujo recepción + movimiento de inventario + costo unitario recibido.
2. **Sprint 2**: facturas proveedor + pagos + egresos consolidados.
3. **Sprint 3**: costo en venta (`cost_at_sale`) + reporte de margen básico.
4. **Sprint 4**: optimización (vistas/materializadas), paginación backend y exportación robusta.

### Orden ejecutable inmediato (lo que haremos ahora)
1. Cerrar modelo de datos Fase 1-2 y migraciones.
2. Implementar funciones transaccionales de recepción y egresos.
3. Implementar pantallas operativas mínimas (OC, Recepción, Factura, Pago).
4. Exponer listado de egresos con filtros + paginación.
5. Validar casos borde (recepción parcial, pago parcial, reversos).

## 8. Riesgos y mitigaciones
- Riesgo: costos inconsistentes por ediciones manuales.
- Mitigación: estados inmutables + reversos.

- Riesgo: reportes lentos por crecer datos.
- Mitigación: índices + materialized views + RPCs filtrados.

- Riesgo: diferencias entre inventario y financiero.
- Mitigación: reconciliación diaria entre `goods_receipts`, `inventory_movements` y `expense_ledger`.

## 9. Criterios de éxito
- Toda recepción de mercadería genera movimiento de stock y evento de egreso trazable.
- Toda venta guarda costo aplicado al momento de vender.
- El reporte de margen por período/sucursal responde en tiempos aceptables con datos grandes.
- Auditoría completa de quién creó, aprobó, ajustó o revirtió cada documento.
