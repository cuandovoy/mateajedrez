# Feature Inventory — Axiostock
*Última actualización: 2026-06-26*

Inventario exhaustivo de todas las funcionalidades implementadas en el sistema. Base para generación de contenido de producto, marketing y documentación de usuario.

---

## 1. Dashboard principal

**Ruta:** `/`

### Lo que ve el usuario

- Tarjetas de métricas monetarias del mes en curso con comparativa vs. mes anterior:
  - Ingresos del mes (revenue cobrado)
  - Cantidad de órdenes
  - Ticket promedio por orden
  - Margen bruto en pesos y en porcentaje
- Indicadores de tendencia (flecha arriba/abajo + delta porcentual o absoluto)
- Alerta de margen: si el margen bruto cae por debajo del 45% aparece una tira de alerta automática
- Métricas operacionales: órdenes pendientes de asignación, sesiones de caja abiertas, productos con stock bajo
- Gráfico de barras con evolución mensual de ventas y egresos (últimos meses)
- Lista de productos con stock crítico con enlace directo al módulo de inventario
- Trends comparativos: semana actual vs. semana anterior

### Acciones disponibles

- Navegar desde las métricas de alerta directamente al módulo correspondiente (p. ej., click en "stock bajo" lleva a `/inventory?low_stock=true`)

### Flujo de onboarding (primera vez)

- Checklist de setup con 8 pasos y anillo de progreso porcentual:
  1. Subir logo y configurar colores de marca
  2. Completar datos de la sucursal (dirección, teléfono)
  3. Invitar al equipo
  4. Crear categorías de productos
  5. Cargar el primer producto
  6. Abrir la primera caja
  7. Registrar la primera venta
  8. Registrar un proveedor
- Cada paso es un link directo al módulo correspondiente
- El checklist se oculta permanentemente una vez completado o al cerrarlo manualmente

---

## 2. Gestión de productos (Catálogo)

**Ruta:** `/products`
**Permiso:** `catalogo:ver` / `catalogo:gestionar`

### Listado de productos

- Vista en tabla (list) o grilla (grid), conmutables
- Columnas tabla: imagen thumbnail con preview hover ampliado, nombre, SKU, categoría, precio, precio efectivo (con descuento), stock total en inventario (suma de todas las sucursales), estado activo/inactivo, variantes expandibles
- Filtros en barra inline siempre visible:
  - Búsqueda por nombre, descripción o SKU (con debounce de 400 ms)
  - Por categoría
  - Por proveedor
  - Por estado (activo / inactivo / todos)
  - Por nivel de stock (con stock / stock bajo / sin stock / todos)
  - Ordenamiento por: fecha de creación, nombre, SKU, precio, stock — con botón de dirección asc/desc
  - Selector de tamaño de página (10, 25, 50, 100)
  - Botón "Limpiar" solo visible cuando hay filtros activos
- Contador de resultados con indicador de página actual
- Exportación a PDF del listado filtrado (abre ventana de impresión con tabla formateada en A4 horizontal)

### Creación y edición de productos

- Campos del formulario: nombre, descripción, precio, SKU (código interno), estado activo/inactivo, categorías (múltiples vía junction table)
- Stock inicial con selección de sucursal destino (solo al crear, si stock > 0)
- Imágenes: upload de archivos (JPG, PNG, WEBP hasta 5 MB) o URL externa; múltiples imágenes con orden configurable por botones arriba/abajo; selección de imagen primaria; eliminación individual; límite de imágenes según plan (Starter: 1, Profesional: 3)
- Validación de límite de productos del plan al crear

### Acciones por producto

- Editar datos básicos
- Eliminar (con confirmación)
- Gestionar variantes (abre panel lateral)
- Gestionar códigos de barras
- Gestionar proveedores del producto
- Ajustar inventario (navega a `/inventory?search=SKU`)

### Selección masiva y acciones en lote

- Checkbox por producto; "seleccionar todos en la página"
- Barra flotante en la parte inferior con:
  - Cambiar estado (activo / inactivo) de N productos seleccionados
  - Cambiar categoría de N productos seleccionados
  - Ajustar precio en porcentaje (positivo o negativo) de N productos seleccionados

### Importación masiva de productos

- Modal de importación CSV
- Descarga de plantilla de ejemplo

### Tab de Descuentos

- Lista separada de productos con descuento activo (vigentes) y vencidos
- Por cada descuento muestra: nombre del producto, SKU, precio original, porcentaje de descuento, precio final, fecha de vencimiento, estado (vigente / vencido)
- Crear nuevo descuento: seleccionar producto por buscador, ingresar porcentaje (1–100), fecha de vencimiento opcional; previsualización del precio final en tiempo real
- Editar descuento existente
- Quitar descuento (poner en null)
- Descuentos sin fecha de vencimiento = permanentes

---

## 3. Variantes de productos

**Componente:** `VariantManager`

### Lo que ve el usuario

- Lista de variantes del producto seleccionado con: nombre, SKU, precio, stock en inventario, estado activo/inactivo, imagen propia

### Acciones disponibles

- Crear variante: nombre, SKU propio, precio, stock inicial, imagen, atributos personalizados (key-value: talla, color, etc.), umbral de stock bajo, stock mínimo
- Editar variante existente
- Activar / desactivar variante
- Eliminar variante

---

## 4. Códigos de barras

**Componente:** `BarcodeManager`

### Acciones disponibles

- Asignar uno o varios códigos de barras a un producto o a una variante específica
- Marcar un código como primario (el que aparece por defecto en POS)
- Eliminar código de barras
- Imprimir etiquetas de código de barras en formato A4 (vista de impresión)
- Soporte de múltiples formatos de código

---

## 5. Categorías

**Ruta:** `/categories`
**Permiso:** `catalogo:ver` / `catalogo:gestionar`

### Listado

- Vista tabla o grilla
- Búsqueda por nombre
- Ordenamiento por nombre, slug o fecha de creación (asc/desc)
- Soporte de subcategorías (parent_id)

### Acciones

- Crear categoría: nombre, slug auto-generado, descripción, imagen (upload hasta 5 MB), categoría padre (opcional)
- Editar categoría
- Eliminar categoría
- Upload de imagen de categoría a Supabase Storage

---

## 6. Inventario multi-sucursal

**Ruta:** `/inventory`
**Permiso:** `inventario:ver` / `inventario:gestionar`

### Dos vistas de inventario

**Vista "Por sucursal":**
- Tabla con: sucursal, imagen del producto (thumbnail con preview en hover), nombre de producto, variante, SKU, stock actual, stock mínimo, umbral de stock bajo, días de stock estimados (basado en ventas de últimos 30 días), fecha de última actividad (movimiento)
- Indicador visual: filas en amarillo cuando el stock está bajo, dato de días en rojo si < 7 o amarillo < 14
- Indicador de "stock muerto": ítem con stock > 0 y sin movimientos en más de 60 días
- Filtros en barra:
  - Búsqueda por nombre o SKU (productos y variantes)
  - Selector de sucursal (si hay más de una)
  - Toggle "Stock bajo" (muestra solo items bajo umbral con conteo)
  - Toggle "Stock muerto" (>60 días sin movimientos, con conteo)
  - Toggle "Ocultar sin stock"
  - Ordenamiento por stock asc/desc
  - Tamaño de página

**Vista "Por producto (cruzado)":**
- Tabla donde cada fila es un producto y cada columna es una sucursal
- Celda coloreada: verde (stock OK), amarillo (bajo umbral), rojo (sin stock)
- En mobile: cards verticales por producto con lista de sucursales
- Búsqueda por nombre, SKU o descripción
- Paginación propia

### Acciones por item de inventario

- Editar stock directamente en la tabla (inline edit con guardar/cancelar)
- Ingreso manual de stock ("recepción") — abre modal
- Ajuste de inventario — abre modal con motivo y cantidad
- Transferir a otra sucursal — abre modal (solo plan Profesional)
- Ver historial de movimientos — abre panel con todos los movimientos del item
- Sincronizar stock con el campo master del producto/variante (item a item)

### Acciones globales

- Exportar inventario completo a CSV (todos los registros, en batches de 1000)
- Sincronizar entradas faltantes: crea entradas en `branch_inventory` para productos activos sin registro
- Sincronizar todos los desincronizados: RPC masiva para igualar branch_inventory con el campo stock del producto (solo admin)
- Alertas en header: contador de "X sin inventario" con botón de sincronización, "X desincronizados" para admin, "X stock bajo"

### Historial de movimientos por item

- Lista cronológica de: tipo de movimiento (receipt / adjustment / transfer / sale / return / sync_stock), cantidad, stock anterior, stock nuevo, notas, fecha

---

## 7. Lotes (trazabilidad FIFO)

**Ruta:** `/inventory/lots`
**Permiso:** `inventario:ver` / `inventario:gestionar`

*Disponible solo cuando el método de costeo de la organización es FIFO.*

### Lo que ve el usuario

- Lista de lotes activos con: producto, SKU, sucursal, cantidad restante en el lote, días en almacenamiento, urgencia (crítico / advertencia / sin urgencia)
- Estadísticas de lotes: total, críticos, con advertencia
- Soporte de fechas de vencimiento por lote (si el producto lo requiere)

### Filtros

- Por sucursal
- Búsqueda por nombre o SKU
- Por urgencia: todos, críticos, advertencia, "stock estancado" (>60 días sin movimiento)

### Acciones

- Crear recepción de lote: producto, variante, sucursal, cantidad, costo unitario, número de lote externo, fecha de vencimiento
- Ver detalle del lote: movimientos de entrada y salida, consumo cronológico por ventas
- Dar de baja (write-off) un lote con motivo

---

## 8. Transferencias de inventario entre sucursales

**Ruta:** `/transfers`
**Permiso:** `inventario:ver` / `inventario:gestionar` — plan Profesional requerido

### Tipos de transferencia

- Transferencia regular (entre sucursales)
- Retiro de vendedora (seller_withdrawal)
- Rendición a depósito (seller_return)
- Pase entre vendedoras (seller_handoff)

### Lo que ve el usuario

- Lista de transferencias con: tipo, producto, variante, sucursal origen, sucursal destino, cantidad, estado (pending / in_transit / completed / cancelled), fecha

### Filtros

- Búsqueda
- Por estado

### Acciones

- Crear transferencia desde el panel de inventario (por item)
- Completar transferencia (acredita stock en destino)
- Cancelar transferencia (devuelve stock a origen)

### Flujo de consignación

- Modo especial: salida de mercadería en consignación desde depósito a vendedora, con posterior rendición o devolución

---

## 9. Reposición de inventario

**Ruta:** `/reposicion`
**Permiso:** `inventario:ver`

### Lo que ve el usuario

- Lista de productos bajo su umbral de stock bajo, con: producto, SKU, sucursal, stock actual, umbral de stock bajo, stock mínimo, ventas en los últimos 30 días, días de stock estimados, proveedor asignado
- Estadísticas: total de items a reponer, cantidad total de unidades

### Filtros y ordenamiento

- Búsqueda por nombre o SKU
- Por sucursal
- Por proveedor
- Ordenamiento por días de stock

### Acciones

- Selección individual o masiva de items a reponer (checkbox)
- Seleccionar todo / deseleccionar
- Crear orden de compra desde la selección:
  - Agrupa automáticamente los items por proveedor
  - Muestra cantidades sugeridas (editables) basadas en umbral × 2 − stock actual
  - Selección de sucursal destino
  - Genera purchase orders en el sistema

---

## 10. Punto de Venta (POS)

**Rutas:** `/pos` (selección de sucursal), `/pos/sale/:branchId` (venta)
**Layout:** sin sidebar, optimizado para tablet/móvil

### Selección de sucursal

- Lista de sucursales activas de la organización
- Estado de sesión de caja (abierta / cerrada) por sucursal
- Acceso directo al módulo de caja para abrir sesión

### Pantalla de venta (`/pos/sale/:branchId`)

**Tabs:** Buscar producto | Ver carrito

**Búsqueda de productos:**
- Input de búsqueda por nombre, SKU o código de barras (texto)
- Grilla de productos con imagen, nombre, precio efectivo (con descuento calculado), stock disponible
- Variantes mostradas como selector adicional cuando el producto las tiene
- Escaneo de código de barras por cámara (`POSBarcodeScanner`)
- Búsqueda y selección de cliente del CRM (`POSCustomerSearch`)

**Carrito:**
- Lista de items con imagen, nombre, variante, cantidad editable, precio unitario, subtotal
- Aumentar / disminuir cantidad
- Eliminar item del carrito
- Subtotal y cantidad de items en tiempo real
- Botón de checkout (deshabilitado si el carrito está vacío)

**Checkout del POS:**
- Panel con resumen del carrito
- Selección del método de pago (efectivo, transferencia, tarjeta, etc.)
- Condición de venta: contado o crédito
- Búsqueda y asociación de cliente (existente o ad-hoc)
- Opciones de descuento configuradas (reglas de descuento de la org)
- Integración Biller: toggle "Emitir CFE" con selección de tipo (e-Ticket / e-Factura) y datos del receptor
- Confirmación de venta: crea la orden, descuenta stock del inventario, registra el pago en la sesión de caja activa, opcionalmente emite CFE
- Mensaje de éxito con número de orden

### Comportamiento notable del POS

- Detecta si hay sesión de caja abierta en la sucursal; si no la hay, muestra advertencia pero permite continuar
- Verifica stock disponible antes de agregar al carrito
- La venta siempre se guarda primero; la emisión del CFE es un paso secundario que nunca bloquea la venta

---

## 11. Órdenes (Gestión de pedidos)

**Ruta:** `/orders`, `/orders/:id`
**Permiso:** `ventas:ver` / `ventas:gestionar`

### Listado de órdenes

- Tabla con: número de orden (formateado #000001), cliente, fecha, estado de orden, estado de cobro, total, badge CFE si tiene comprobante emitido, badge de descuento si tiene descuentos
- Actualización en tiempo real vía Supabase Realtime (INSERT y UPDATE en tabla `orders`)
- Filtros:
  - Búsqueda por ID, nombre, email, teléfono, RUT, dirección
  - Rango de fechas (desde / hasta)
  - Por estado de orden: todos, pendiente de asignación, pendiente, en proceso, enviado, entregado, cancelado
  - Por descuento: todos, con descuento, sin descuento
- Estado de cobro calculado dinámicamente: sin cobro, cobro parcial (muestra monto pendiente), cobrada, pendiente de cobro
- Nueva orden manual desde el listado

### Detalle de orden (`/orders/:id`)

**Información mostrada:**
- Número de orden, fecha de creación, estado, fuente (POS / tienda online / manual)
- Datos del cliente (nombre, email, teléfono, RUT si tiene)
- Dirección de envío
- Items de la orden: imagen, nombre, variante, SKU, atributos, cantidad, precio unitario, subtotal; cantidad ya devuelta por item
- Totales: subtotal antes de descuentos, total de descuentos, total final
- Historial de pagos: método, monto, fecha; indicador de monto pendiente
- Comprobantes CFE emitidos con enlace y estado (emitido / anulado)

**Acciones:**
- Cambiar estado de la orden (pipeline completo)
- Editar items de la orden: modificar cantidad, cambiar precio, agregar item manual (producto libre sin SKU), eliminar item
- Aplicar descuento a la orden o por item (seleccionar regla de descuento configurada o ingresar valor libre)
- Registrar pago: método de pago, monto, asociar a sesión de caja; soporte multi-pago en la misma orden
- Eliminar pago registrado
- Cancelar orden (con devolución de stock automática al inventario)
- Devolver items parcialmente: seleccionar items y cantidades, con reintegro de stock
- Emitir CFE (e-Ticket o e-Factura) vía Biller v2 desde el detalle
- Descargar PDF del comprobante fiscal
- Anular comprobante CFE ya emitido

### Nueva orden manual

- Modal / form accesible desde listado de órdenes y desde caja
- Búsqueda de productos por nombre o SKU
- Líneas de producto con cantidad y precio editable
- Líneas de item manual (sin SKU) para servicios u otros conceptos
- Búsqueda y asociación de cliente CRM
- Ingreso de datos de cliente ad-hoc (nombre, email, teléfono, RUT)
- Condición: contado o crédito
- Método de pago
- Nota interna
- Integración Biller para emitir CFE en el mismo paso

---

## 12. Clientes (CRM)

**Ruta:** `/customers`, `/customers/:id`, `/customers/deudores`
**Permiso:** `clientes:ver` / `clientes:gestionar`

### Listado de clientes

- Tabla con: nombre, email, teléfono, RUT (opcional), dirección, cantidad de órdenes activas, fecha de creación
- Filtros: búsqueda por nombre/email/teléfono/RUT, toggle "solo con órdenes activas"
- Ordenamiento: por nombre, email, fecha de alta, cantidad de órdenes
- Exportación a CSV de todos los clientes filtrados
- Acceso directo a perfil del cliente desde cada fila

### Creación y edición de clientes

- Campos: nombre completo, email, teléfono (con validación de formato uruguayo), RUT (opcional), dirección completa (calle, ciudad, departamento, código postal, país), notas internas

### Detalle de cliente (`/customers/:id`)

**Información mostrada:**
- Datos de contacto completos con atajos (enlace email, WhatsApp, llamada)
- KPIs del cliente: total de órdenes activas, monto comprado (ventas netas), monto cobrado, monto pendiente
- Top 3 productos más comprados
- Historial de órdenes del cliente: número, fecha, estado, total, monto cobrado, monto pendiente

**Acciones:**
- Editar datos del cliente (inline en la misma página)
- Ver orden individual desde el historial

### Deudores (`/customers/deudores`)

- Lista de clientes con monto pendiente de cobro (sin pagar o con cobro parcial)
- Muestra: nombre, teléfono, email, monto pendiente, cantidad de órdenes con deuda, fecha de última orden
- Acceso directo a perfil del cliente
- Botón "Enviar WhatsApp" con mensaje pre-armado de cobro (formato de número uruguayo automático)
- Exportación a CSV

---

## 13. Proveedores y Compras

**Ruta:** `/suppliers`, `/expenses`
**Permiso:** `compras:ver` / `compras:gestionar`

### Gestión de proveedores

- Lista de proveedores con vista tabla o grilla
- Búsqueda y ordenamiento (nombre, ciudad, país, fecha)
- Campos: nombre, RUT (formato UY XX.XXXXXX.001-X), email, teléfono, dirección, ciudad, país, sitio web, notas

### Vinculación producto-proveedor

- Desde cada producto se pueden asociar múltiples proveedores
- El proveedor principal se usa en la pantalla de reposición para agrupar órdenes de compra

### Módulo de egresos (`/expenses`)

El módulo tiene cuatro vistas (tabs):

**1. Órdenes de Compra (Purchase Orders)**
- Crear orden de compra: seleccionar proveedor, sucursal destino, agregar líneas de producto (con búsqueda), cantidad pedida, costo unitario, descuento por línea, impuesto por línea
- Ver PO con número interno, estado, total, proveedor
- Estados: borrador, enviada, parcialmente recibida, recibida, cancelada
- Recepción de mercadería: modal de recepción con cantidad recibida por línea; genera lote FIFO si el método de costeo es FIFO; actualiza stock en `branch_inventory`

**2. Facturas de Proveedores (Supplier Invoices)**
- Listar facturas con: número, proveedor, PO asociada, estado, monto total, monto pagado, saldo pendiente
- Crear factura de proveedor asociada o no a una PO
- Registrar pago contra la factura
- Cancelar factura con reversión de efectos en ledger
- El pago actualiza el ledger de egresos

**3. Libro de Egresos (Expense Ledger)**
- Vista completa de todos los asientos del libro de egresos con filtros:
  - Rango de fechas
  - Por proveedor
  - Tipo de asiento: todos, accrual (devengado) o cash (cobrado)
  - Tipo de evento: factura, pago, reversión de pago, ajuste manual, gasto directo

**4. Gastos directos (Direct Expenses)**
- Registrar un gasto no asociado a proveedor ni PO (alquiler, servicios, etc.)
- Campos: monto, descripción, categoría, fecha, método de pago, sesión de caja asociada (opcional)
- Lista de gastos directos con filtros por fecha y tipo

---

## 14. Caja (Cash Register)

**Ruta:** `/cash-register`
**Permiso:** `caja:ver` / `caja:gestionar`

### Sesiones de caja

- Lista de sesiones con: sucursal, operador que abrió, fecha/hora de apertura y cierre, monto de apertura, monto de cierre, monto esperado (apertura + cobros en efectivo), diferencia calculada, notas
- Filtros: búsqueda, por sucursal

### Apertura de sesión

- Formulario: selección de sucursal, monto de apertura en caja, notas opcionales
- Una sucursal puede tener solo una sesión abierta a la vez

### Cierre de sesión

- Ingresar monto físico contado al cerrar
- El sistema calcula la diferencia entre monto esperado y monto contado
- Notas de cierre opcionales
- El cierre queda registrado en auditoría con usuario que cerró, hora y diferencia

### Detalle de sesión de caja

- Historial de pagos asociados a la sesión: orden, monto, método de pago, fecha
- Vista de todos los pagos en efectivo cobrados durante la sesión
- Totales por método de pago

### Nueva venta manual desde caja

- Acceso directo al formulario de venta manual sin salir del módulo de caja
- El pago registrado queda asociado a la sesión de caja activa

---

## 15. Facturación electrónica DGI (Biller v2)

**Ruta:** `/billing/comprobantes`
**Permiso:** `ventas:ver` / `ventas:gestionar`

### Configuración del Biller

- La org debe tener configurado un `biller_config` con: ID de empresa en Biller, RUT, número de serie por tipo de comprobante, datos fiscales
- Configuración de impuestos (IVA básico / mínimo)

### Listado de comprobantes

- Tabla de CFE emitidos con: número interno, tipo (e-Ticket 101 / e-Factura 111), serie y número DGI, estado (emitido / anulado / error), orden asociada, fecha, total
- Filtros: búsqueda, rango de fechas, estado, tipo de comprobante
- Paginación de 25 por página

### Acciones por comprobante

- Descargar PDF del comprobante desde Biller API
- Ver orden asociada

### Emisión de CFE (desde distintos contextos)

- Desde detalle de orden
- Desde checkout de tienda pública (si la org tiene Biller activo)
- Desde checkout del POS
- Desde formulario de venta manual
- Tipos: e-Ticket (101) para consumidor final, e-Factura (111) con RUT del receptor
- La venta nunca es bloqueada si falla la emisión del CFE (flujo tolerante a fallos)
- PDF descargado directamente desde Biller API

---

## 16. Reportes de ventas

**Ruta:** `/reports/sales`
**Plan requerido:** Profesional
**Permiso:** `reportes:ver`

### Métricas disponibles

- Dos modos de período: mes específico (selector año/mes) o rango personalizado
- Resumen del período seleccionado:
  - Ventas brutas (gross sales antes de descuentos)
  - Descuentos otorgados
  - Ventas netas (gross − descuentos)
  - Revenue cobrado (ingresos reales de caja, excluyendo ventas a crédito no cobradas)
  - Cantidad de órdenes
  - Ticket promedio
- Comparativa automática con período anterior (delta porcentual)
- Tabla "Ventas por día": fecha, órdenes, revenue
- Tabla "Ventas por mes": para rangos multi-mes
- Gráfico de barras: ingresos por sucursal
- Tabla de métodos de pago: método, monto cobrado

### Filtros

- Selector de período (mes o custom)
- Selector de sucursal
- Filtro de fuente de orden (POS / tienda online / manual)

### Exportación

- Descarga de datos detallados a CSV con métricas de margen, descuentos y cobros

---

## 17. Reportes financieros

**Ruta:** `/reports/financial`
**Plan requerido:** Profesional
**Permiso:** `reportes:ver`

### Resumen financiero del período

- Revenue por ventas (base de ventas brutas)
- Ventas brutas, descuentos otorgados, ventas netas
- Ingresos cobrados (diferencia: créditos pendientes no incluidos)
- Margen bruto en pesos y porcentaje
- Egresos devengados (accrual) y egresos en efectivo (cash)
- Flujo de caja neto del período

### Serie temporal

- Gráfico de evolución diaria / mensual de: ventas, egresos, resultado neto

### Aging de cuentas por cobrar

- Antigüedad de saldos pendientes: corriente, 1–30 días, 31–60 días, 61–90 días, +90 días
- Total outstanding y cantidad de órdenes abiertas con saldo

### Cuentas por pagar (proveedores)

- Monto pendiente de pago por proveedor
- Enlace a módulo de egresos por proveedor

### Exportación

- CSV completo con todos los rubros del reporte financiero

---

## 18. Reportes de inventario

**Ruta:** `/reports/inventory`
**Plan requerido:** Profesional
**Permiso:** `reportes:ver`

### Valoración del inventario

- Tabla de valoración por producto, variante y sucursal: stock actual, costo unitario promedio (weighted average o FIFO según configuración), valor total en inventario
- Total de unidades en inventario y valor total en moneda
- Filtro por sucursal
- Exportación a CSV

---

## 19. Reportes de clientes

**Ruta:** `/reports/customers`
**Plan requerido:** Profesional
**Permiso:** `reportes:ver`

### Resumen del período

- Clientes activos (con al menos 1 orden en el período)
- Clientes nuevos (primera compra en el período)
- Clientes recurrentes (más de 1 compra histórica)
- Ticket promedio por cliente
- Órdenes promedio por cliente
- Ventas brutas, descuentos, ventas netas, ingresos cobrados

### Segmentación de clientes

- Filtros por segmento: todos, nuevos, recurrentes, en riesgo (sin comprar 31–90 días), con saldo pendiente

### Tabla de clientes

- Por cliente: órdenes, ventas brutas, descuentos, ventas netas, cobrado, pendiente, primera y última compra
- Ordenamiento por cualquier columna
- Enlace al perfil del cliente

### Visualizaciones

- Gráfico de barras: clientes activos y ventas netas por mes
- Distribución de recencia: activos (últimos 30 días), en riesgo (31–90 días), inactivos (+90 días)

### Exportación

- CSV con datos de la tabla de clientes del período filtrado

---

## 20. Logs de auditoría

**Ruta:** `/reports/audit-logs`
**Plan requerido:** Profesional
**Permiso:** `reportes:ver`

### Lo que registra el sistema

El sistema audita automáticamente cambios en:
- `organizations`, `organization_members`, `organization_payment_methods`
- `branches`, `user_profiles`
- `products`, `categories`, `product_variants`, `product_images`, `product_barcodes`, `product_suppliers`, `suppliers`
- `branch_inventory`, `inventory_movements`, `inventory_transfers`
- `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`
- `supplier_invoices`, `supplier_payments`, `expense_ledger`
- `order_returns`, `cash_sessions`

### Por cada evento registrado se muestra

- Tabla afectada, ID del registro
- Acción (INSERT / UPDATE / DELETE / SYNC / CANCEL, etc.)
- Usuario que realizó la acción (ID + email)
- Datos anteriores (old_data) y nuevos (new_data) en JSON
- Campos modificados
- Notas adicionales
- Fecha y hora

### Filtros

- Búsqueda por tabla, acción o ID
- Filtro por tabla específica (selector con todas las tablas auditadas)
- Paginación

---

## 21. Estadísticas de la tienda pública

**Ruta:** `/store/stats`
**Permiso:** `reportes:ver`

### Métricas de tráfico de la tienda online

- Vistas totales, visitantes únicos, páginas únicas vistas en el período
- Selección de período: última hora, últimas 24h, últimos 7 días, últimos 30 días
- Gráfico de área con evolución de vistas y visitantes en el tiempo
- Desglose por tipo de dispositivo: escritorio, móvil, tablet (ícono + vistas + visitantes)
- Top páginas más visitadas (ruta, vistas, visitantes)

---

## 22. Tienda pública (storefront)

**Rutas:** `/:slug`, `/:slug/products`, `/:slug/categories/:categorySlug`, `/:slug/product/:id`, `/:slug/cart`, `/:slug/checkout`, `/:slug/order-confirmation/:orderId`

La tienda es una SPA pública por slug de organización, sin autenticación requerida.

### Portada (`/:slug`)

- Header con efecto frosted glass (color primario de la org al 93% de opacidad + blur)
- Carousel de imágenes de portada si la org tiene varias configuradas (auto-rotación cada 7 segundos)
- Grid de categorías (estilo editorial con overlay de gradiente sobre la imagen)
- Grid de productos destacados/recientes con animación de entrada escalonada
- Filtros de búsqueda inline por chips (pills horizontales):
  - Búsqueda de texto con botón × para limpiar
  - Categorías activas / inactivas como chips
  - Rango de precio (dos inputs inline)
  - Botón "Limpiar" cuando hay filtros activos

### Catálogo de productos (`/:slug/products`)

- Grid responsivo: 2 columnas en mobile, 3 en sm, 4 en lg, 5 en xl
- Paginación tipo "Cargar más" (acumula resultados, 24 por página)
- Cada ProductCard muestra:
  - Imagen cuadrada con zoom en hover
  - Badge de descuento si el producto tiene descuento activo
  - Nombre, precio (tachado si hay descuento + precio efectivo)
  - Overlay "sin stock" si el stock es 0
  - Botón flotante "Agregar al carrito" (visible siempre en mobile, visible en hover en desktop)
  - Para productos con variantes, el click navega al detalle

### Categorías (`/:slug/categories/:categorySlug`)

- Mismo grid de productos filtrado por categoría
- Header de categoría con nombre e imagen si la tiene

### Detalle de producto (`/:slug/product/:id`)

- Galería de imágenes con imagen principal y thumbnails
- Nombre, descripción, precio con descuento calculado
- Selector de variantes si el producto las tiene (muestra precio de la variante seleccionada)
- Indicador de stock disponible
- Botón "Agregar al carrito" (deshabilitado sin stock)
- Navegación de regreso a la categoría

### Carrito (`/:slug/cart`)

- Lista de items con imagen, nombre, variante, precio unitario, selector de cantidad, precio total por item
- Botón de eliminar por item
- Subtotal calculado con descuentos
- Botón para continuar al checkout

### Checkout (`/:slug/checkout`)

- Formulario de contacto: nombre completo, email, teléfono
- Selección de método de pago (métodos habilitados por la organización)
- Integración Biller: toggle para emitir CFE con selector de tipo y RUT opcional
- Modo de asignación de stock configurable (inmediato o manual por el admin)
- Creación de la orden, descuento de stock, registro de pago, emisión opcional de CFE

### Confirmación de orden (`/:slug/order-confirmation/:orderId`)

- Número de orden formateado
- Resumen de items comprados
- Instrucciones de pago (si aplica)
- CTA para seguir comprando

---

## 23. Sucursales

**Ruta:** `/branches`
**Permiso:** `configuracion:gestionar`

### Tipos de sucursal

- **Tienda** (store): punto de venta con stock y caja
- **Depósito** (warehouse): almacén sin venta directa al público
- **Vendedor** (seller): persona que lleva mercadería en consignación

### Configuración por sucursal

- Nombre, dirección, teléfono, email
- País
- Tipo (store / warehouse / seller)
- Flags: puede despachar (can_dispatch), puede recibir (can_receive), puede vender (can_sell)
- Flag "depósito aislado" (is_isolated_warehouse): excluida del fulfillment automático de la tienda pública
- Activar/desactivar

### Acciones

- Crear sucursal (con límite según plan: Starter = 1, Profesional = ilimitadas)
- Editar sucursal
- Soft delete (desactivar) con posibilidad de restaurar
- Vista lista o grilla

---

## 24. Usuarios y equipo

**Ruta:** `/users`

### Lo que ve el usuario

- Lista de miembros con: nombre, email, rol base, rol customizado si tiene asignado, fecha de alta
- Paginación estándar

### Acciones

- Crear usuario nuevo: email, contraseña, nombre, teléfono, rol base
- Editar datos del usuario (nombre, teléfono)
- Cambiar rol del usuario (rol base + rol custom de la org si aplica)

---

## 25. Roles y permisos

**Ruta:** `/roles-permissions`

### Módulos del sistema (8 módulos)

| Módulo | Área |
|--------|------|
| Ventas | Órdenes, facturación |
| Catálogo | Productos, categorías |
| Inventario | Inventario, reposición, sucursales, transferencias |
| Compras | Egresos, proveedores |
| Clientes | CRM |
| Caja | Sesiones de caja |
| Reportes | Todos los reportes |
| Configuración | Ajustes de organización |

Cada módulo tiene dos acciones: **ver** y **gestionar**.

### Roles del sistema (no editables)

- **admin**: todos los permisos
- **manager**: todos excepto configuración
- **viewer**: solo ver en todos los módulos
- **user**: ver ventas y catálogo

### Roles custom

- Crear rol nuevo basado en un rol del sistema como plantilla
- Editar permisos granulares por módulo (toggle por permiso)
- El permiso `configuracion:gestionar` en el rol admin no puede desactivarse (anti-lockout)
- Asignar roles custom a usuarios desde el módulo de usuarios
- Eliminar rol custom (no elimina los roles del sistema)

---

## 26. Organizaciones

**Ruta:** `/organizations`

### Gestión de organización

- Ver y editar datos de la organización activa: nombre, slug (URL de la tienda pública), logo
- Subir logo (upload a Supabase Storage)
- Cambiar entre organizaciones si el usuario pertenece a más de una
- Crear nueva organización (solo admin)

### Personalización visual de la tienda pública

- Color primario, secundario y de acento (hex)
- Tipografía de cuerpo y de encabezados
- Radio de bordes (botones, cards)
- Estilo de botones
- Imagen de portada para el carousel del home de la tienda

### Configuraciones operativas de la org

- Timezone de la organización
- Moneda y símbolo
- Formato de fecha
- Umbral por defecto de stock bajo
- Método de costeo: promedio ponderado o FIFO
- Modo de fulfillment del checkout: sucursal principal fija o selección automática
- Excluir depósitos aislados del fulfillment público
- Modo de asignación de stock en checkout: inmediato o manual
- Soft delete (desactivar org sin eliminar datos)

---

## 27. Métodos de pago

**Componente:** `PaymentMethodsManager`

### Lo que puede configurar el usuario

- Activar / desactivar métodos de pago disponibles para la tienda pública y el POS
- Métodos disponibles: efectivo (cash), transferencia bancaria (transfer), tarjeta de crédito/débito (credit_card), PayPal
- Configuración por método: nombre de display, instrucciones específicas para el cliente (ej. datos de cuenta bancaria para transferencias)

---

## 28. Notificaciones

### Notificaciones in-app

- Campana con badge de conteo de notificaciones no leídas
- Lista de notificaciones recientes con título, mensaje, fecha
- Marcar como leída / marcar todas como leídas
- Tipos de notificación:
  - Stock bajo (generado automáticamente por trigger de DB cuando un item cruza el umbral)
  - Orden nueva
  - Otras notificaciones operacionales

### Resumen diario (plan Profesional)

- Resumen vía WhatsApp o SMS (integración Twilio)
- Toggle activar/desactivar, número de teléfono destinatario
- Hora de envío (selector de 0 a 23 hs)
- Timezone configurable
- Canal: WhatsApp o SMS
- Historial de envíos: fecha, ventas del día, órdenes, egresos, estado (enviado / fallido)

---

## 29. Planes y suscripción

**Ruta:** `/planes`

### Dos planes disponibles

| Plan | Precio | Límites |
|------|--------|---------|
| **Starter** | $UY 1.700/mes | 500 productos, 1 sucursal, 1 imagen por producto |
| **Profesional** | $UY 3.400/mes | Hasta 2000 productos, sucursales ilimitadas, 3 imágenes por producto, transferencias, reportes avanzados, notificaciones configurables, tienda y catálogo online |

### Funcionalidades exclusivas del plan Profesional

- Transferencias de inventario entre sucursales
- Reportes avanzados (ventas, financiero, inventario, clientes)
- Notificaciones configurables (resumen diario)
- Tienda online pública personalizable
- Sucursales ilimitadas

### Flujo de upgrade

- Página muestra los planes con sus features
- Botón de upgrade abre WhatsApp con mensaje pre-armado incluyendo nombre de la organización y plan actual

---

## 30. Autenticación y acceso

**Rutas:** `/login`, `/forgot-password`, `/reset-password`

- Login con email y contraseña (Supabase Auth)
- Recuperación de contraseña por email
- Reset de contraseña por link de email
- Cierre de sesión
- Soporte de múltiples organizaciones por usuario (switching de org en sidebar)
- Rutas protegidas por `ProtectedRoute` y `OrgAccessGate`
- Acceso a la tienda pública sin autenticación

---

## 31. PWA (Progressive Web App)

- Banner de instalación en el panel admin: detecta el evento `beforeinstallprompt` y muestra la opción de instalar
- Manifiesto y service worker configurados para agregar Axiostock al inicio del celular o escritorio

---

## 32. Descuentos y reglas de precio

### A nivel producto

- `discount_percentage` (0–100) y `discount_expires_at` (null = sin vencimiento)
- `getEffectivePrice()` y `hasActiveDiscount()` aplicados en toda la UI
- Visible en: tienda pública, POS, detalle de orden, reportes

### Reglas de descuento de la organización

- Reglas por orden o por item
- Tipos: porcentaje, monto fijo, precio de override
- Condición de monto mínimo de orden
- Tope máximo de descuento
- Aplicables desde el detalle de orden y desde la venta manual

---

## 33. Automatización y jobs (pg_cron)

El sistema ejecuta automáticamente las siguientes tareas programadas en PostgreSQL:

- **Reconciliador de pagos MercadoPago:** verifica periódicamente el estado de pagos MP pendientes
- **Limpieza de carritos abandonados:** elimina órdenes en estado inicial sin actividad después de X tiempo
- **Notificador de órdenes estancadas:** alerta cuando órdenes llevan tiempo sin avanzar de estado
- **Auditor de drift de inventario:** detecta inconsistencias en branch_inventory de forma automática
- **Resumen diario vía Twilio:** envío programado del resumen de ventas y egresos del día

---

## 34. Tracking de vistas de tienda pública

- Tabla `store_page_views` registra automáticamente cada visita a la tienda pública
- Campos capturados: organización, página visitada, tipo de dispositivo, visitante único, fecha y hora
- Datos consumidos por el módulo de estadísticas de tienda

---

## 35. Páginas legales y landing

- `/landing/app`: Landing page de Axiostock para adquisición de clientes
- `/facturacion-electronica`: Landing dedicada a la funcionalidad de facturación DGI
- `/legal/privacidad`: Política de privacidad
- `/legal/terminos`: Términos y condiciones

---

## Resumen por área funcional

| Área | Módulos |
|------|---------|
| **Ventas y comercio** | POS, Órdenes, Tienda pública, Checkout, Descuentos, Facturación CFE |
| **Inventario** | Gestión multi-sucursal, Transferencias, Lotes FIFO, Reposición |
| **Catálogo** | Productos, Variantes, Categorías, Códigos de barras, Imágenes |
| **Proveedores y compras** | Proveedores, Órdenes de compra, Facturas, Libro de egresos, Gastos directos |
| **Clientes** | CRM, Historial, Deudores, Reportes de clientes |
| **Caja** | Apertura/cierre, Auditoría de diferencias, Pagos por sesión |
| **Reportes** | Ventas, Financiero, Inventario (valoración), Clientes, Auditoría, Estadísticas de tienda |
| **Configuración** | Organización, Sucursales, Usuarios, Roles/Permisos, Métodos de pago, Notificaciones, Planes |
| **Automatización** | Notificaciones in-app, Resumen diario SMS/WhatsApp, Cron jobs de DB, Realtime |
