# Analisis tecnico completo del software (para NotebookLM)

Fecha del relevamiento: 2026-04-20
Repositorio: ecommerce-supabase saas

## 1) Resumen ejecutivo
Este software es una plataforma SaaS de ecommerce multi-tenant construida sobre React + Supabase.

Opera en dos superficies principales:
1. Tienda publica por `slug` de organizacion (`/:slug/...`) para catalogo, carrito y checkout.
2. Panel administrativo en raiz (`/`) para operacion comercial, inventario, reportes, roles y configuracion.

El backend funcional real vive mayormente en Postgres/Supabase (migraciones SQL, triggers y RPC), con Edge Functions para integraciones externas (Mercado Pago, Biller, Resend, Twilio, OG preview).

## 2) Tamano y alcance actual del sistema
Metricas del codigo relevado:
- `src/`: 47,005 lineas
- `supabase/migrations`: 21,612 lineas
- `supabase/functions`: 1,647 lineas
- Archivos TS/TSX en `src`: 153
- Migraciones SQL: 122
- Tablas SQL detectadas por migraciones: 50
- Funciones SQL (`CREATE FUNCTION`): 226
- Triggers SQL (`CREATE TRIGGER`): 100
- Politicas RLS (`CREATE POLICY`): 368
- Tablas con RLS habilitado: 74
- Edge Functions con `index.ts`: 6
- Paginas admin: 25

Conclusiones de alcance:
- Es un sistema grande y maduro en funcionalidad.
- La complejidad principal esta en SQL (logica de negocio en BD), no solo en frontend.

## 3) Stack tecnologico
Frontend:
- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand (estado global)
- TanStack React Query (cache y fetching)
- React Hook Form + Zod (formularios y validaciones)
- Recharts (graficos/reportes)

Backend / datos:
- Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- RLS intensivo por organizacion
- SQL procedural con funciones y triggers

Integraciones externas:
- Mercado Pago (checkout + webhook)
- Biller v2 (CFE/facturacion electronica)
- Resend (emails)
- Twilio (resumen diario WhatsApp/SMS)

## 4) Arquitectura funcional
### 4.1 Frontera de capas
- Capa UI React: vistas y formularios
- Capa de estado: `authStore`, `organizationStore`, `cartStore`, `toastStore`
- Capa de acceso a datos: consultas Supabase + RPC
- Capa de dominio SQL: reglas de stock, descuentos, reportes, suscripcion, auditoria

### 4.2 Multi-tenant
El aislamiento de datos se centra en `organization_id` + RLS.

Patron general:
- Casi todas las entidades operativas tienen `organization_id`.
- RLS filtra por membresia en `organization_members`.
- UI selecciona organizacion activa y trabaja bajo ese contexto.

### 4.3 Multi-sucursal (branch-aware)
La operacion de stock y caja es por sucursal:
- `branches`
- `branch_inventory`
- `inventory_movements`
- `inventory_transfers`
- `cash_sessions`

## 5) Modulos de negocio implementados
### 5.1 Tienda publica
Rutas principales:
- `/:slug`
- `/:slug/products`
- `/:slug/categories/:categorySlug`
- `/:slug/product/:id`
- `/:slug/cart`
- `/:slug/checkout`
- `/:slug/order-confirmation/:orderId`

Capacidades:
- Catalogo por organizacion con categorias/subcategorias
- Productos con variantes e imagenes multiples
- Carrito guest en `localStorage` y sincronizacion al login
- Tracking de visitas de tienda (`store_page_views`)
- Branding por organizacion (logo, colores, tipografias, hero)

### 5.2 Checkout y ventas
- Resolucion de sucursal de fulfillment (`main` o `auto` segun settings)
- Validacion de stock por branch antes de crear orden
- Modo de asignacion de stock configurable (`immediate` vs `manual/pending_allocation`)
- Creacion y reutilizacion de cliente en `customers`
- Creacion de `orders`, `order_items`, `order_payments`
- Integracion opcional Mercado Pago (edge function)
- Emision opcional CFE via Biller en flujo de checkout

### 5.3 Panel admin (dominios)
Dominios visibles en rutas/paginas:
1. Dashboard ejecutivo (dinero, operativo, tendencias)
2. Productos (incluye imagenes, variantes, categorias multiples, proveedores, descuentos por producto)
3. Categorias
4. Proveedores
5. Ordenes y detalle de orden
6. Comprobantes fiscales (Biller)
7. Clientes + reportes de clientes
8. Inventario (movimientos, ajustes, recepciones, transferencias)
9. Transferencias entre sucursales (completar/cancelar)
10. Caja / punto de venta (`cash_sessions` + pagos)
11. Compras y egresos (PO, recepciones, facturas proveedor, pagos, ledger, gastos directos)
12. Reportes de ventas
13. Reporte financiero
14. Auditoria
15. Organizaciones
16. Planes
17. Usuarios
18. Roles y permisos por organizacion
19. Estadisticas de tienda publica

### 5.4 Roles, permisos y gobernanza
Modelo mixto:
- Roles base globales: `roles`, `permissions`, `roles_permissions`
- Roles custom por organizacion: `organization_roles`, `organization_role_permissions`
- Override por usuario: `user_permissions`
- Membresia en `organization_members` con `organization_role_id`

Helpers clave SQL:
- `is_org_member`
- `is_org_admin`
- `is_org_admin_or_manager`
- `has_org_permission`

### 5.5 Planes y suscripcion
- Tier: `starter` / `profesional`
- Limites y features por plan en frontend + validaciones SQL
- Trial de 10 dias y estado de suscripcion en `organizations`
- Pagos de suscripcion en `organization_payments`
- RPC `register_org_payment` para reactivar/extender acceso
- Gating de features en UI (`PlanGate`, `usePlanLimits`, `OrgAccessGate`)

## 6) Modelo de datos por dominio
### 6.1 Catalogo y venta
- `categories`
- `products`
- `product_images`
- `product_variants`
- `product_barcodes`
- `product_categories`
- `cart_items`
- `orders`
- `order_items`
- `order_payments`
- `customers`
- `sales_discount_rules`

### 6.2 Organizacion, usuarios y acceso
- `organizations`
- `organization_members`
- `organization_payment_methods`
- `organization_payments`
- `organization_order_counters`
- `user_profiles`
- `roles`, `permissions`, `roles_permissions`, `user_permissions`
- `organization_roles`, `organization_role_permissions`
- `rbac_audit_log`
- `audit_logs`

### 6.3 Inventario y sucursales
- `branches`
- `branch_inventory`
- `inventory_movements`
- `inventory_transfers`
- `order_returns`
- `order_return_items`

### 6.4 Compras y egresos
- `suppliers`
- `product_suppliers`
- `purchase_orders`
- `purchase_order_items`
- `goods_receipts`
- `goods_receipt_items`
- `supplier_invoices`
- `supplier_payments`
- `expense_ledger`
- `direct_expenses`

### 6.5 Notificaciones, analitica y facturacion
- `notification_config`
- `notification_queue`
- `user_notifications`
- `daily_summary_logs`
- `store_page_views`
- `biller_config`
- `biller_comprobantes`

## 7) Evolucion funcional por bloques de migraciones
### 000-015
Base ecommerce inicial: catalogo, ordenes, variantes, imagenes, proveedores, RLS inicial.

### 016-028
Multi-sucursal, inventario por branch, caja/pagos iniciales y movimientos de stock.

### 029-033
RBAC y robustez de onboarding/auth.

### 034-063
SaaS multi-organizacion, branding de tienda, payment methods por org, plan limits.

### 064-084
Optimizacion de reportes, finanzas y margen, descuentos de ventas, cancelaciones/devoluciones.

### 085-099
RUT opcional cliente, sincronizacion stock, consignacion y modos de asignacion de stock.

### 100-119
Notificaciones in-app, Twilio resumen diario, billing de suscripcion, Biller, analytics de tienda, dashboard RPCs, cancelacion de transferencias, descuentos por producto.

Nota: existen numeraciones duplicadas de migracion (`100_*` y `101_*`), lo cual es un riesgo operativo para despliegues y trazabilidad.

## 8) RPC y logica SQL relevante
Flujos clave en SQL:
- Stock y disponibilidad:
  - `get_product_stock`, `get_products_stock`
  - `decrement_branch_inventory`, `restore_branch_inventory`
  - `allocate_order_branch_inventory`
- Transferencias:
  - `create_inventory_transfer`
  - `complete_inventory_transfer`
  - `cancel_inventory_transfer`
- Compras/egresos:
  - `post_goods_receipt`
  - `post_supplier_invoice`
  - `register_supplier_payment`
  - `cancel_supplier_invoice`
- Reportes:
  - `get_sales_report_summary`
  - `get_financial_report_summary`
  - `export_financial_report_rows`
  - `get_dashboard_money_metrics`
  - `get_dashboard_operational_metrics`
  - `get_dashboard_trends`
- Notificaciones:
  - `notify_inapp_new_order`
  - `notify_inapp_low_stock`
  - `notify_low_stock`
  - `mark_notifications_read`
- SaaS:
  - `register_org_payment`
  - `get_org_by_slug`

## 9) Edge Functions e integraciones
Funciones detectadas:
1. `create-mp-preference`: crea preferencia de pago MP desde una orden
2. `mp-webhook`: procesa webhook MP, actualiza estado de orden y upsert en `order_payments`
3. `send-notification`: procesa `notification_queue` y envia emails via Resend
4. `daily-sales-summary`: resume ventas/egresos y envia por Twilio
5. `biller-proxy`: proxy server-side para Biller (crear/anular/pdf CFE)
6. `og-preview`: genera OG tags para links de tienda por slug

`supabase/config.toml` marca `verify_jwt = false` en:
- `daily-sales-summary`
- `biller-proxy`

El control de seguridad en esos casos se implementa manualmente dentro del handler.

## 10) Seguridad aplicada
Controles positivos observados:
- RLS muy extendido en tablas expuestas
- Politicas por membresia de organizacion
- Helpers SQL para permisos organizacionales
- Aislamiento por `organization_id`
- Integraciones sensibles en edge/server (no en cliente)

Areas a vigilar:
- Gran uso de `as any` en frontend para saltear tipado en RPC/tablas nuevas
- Security Definer functions numerosas: requiere auditoria continua de privilegios

## 11) Estado tecnico de tipado y calidad
### 11.1 Tipado DB vs esquema real
`src/types/database.types.ts` esta desactualizado frente a migraciones.

Tablas presentes en migraciones pero no en tipos generados (21):
- `biller_comprobantes`
- `biller_config`
- `daily_summary_logs`
- `direct_expenses`
- `expense_ledger`
- `goods_receipt_items`
- `goods_receipts`
- `order_return_items`
- `order_returns`
- `organization_order_counters`
- `organization_payments`
- `organization_role_permissions`
- `organization_roles`
- `product_categories`
- `purchase_order_items`
- `purchase_orders`
- `sales_discount_rules`
- `store_page_views`
- `supplier_invoices`
- `supplier_payments`
- `user_notifications`

Impacto:
- Se pierde seguridad de tipos.
- Se incrementa deuda tecnica y riesgo de errores silenciosos.

### 11.2 Resultado de chequeos ejecutados
Comandos corridos durante este analisis:
1. `npm run type-check` -> OK
2. `npm run test` -> FALLA 1 test

Falla observada:
- Archivo: `src/lib/schemas.test.ts`
- Caso: `productSchema > rechaza category_id vacio`
- Motivo: el schema actual permite `category_id` opcional, pero el test espera rechazo.

## 12) Observaciones tecnicas importantes (riesgos)
1. Documentacion de base desactualizada:
- `README.md` aun describe setup de pocas migraciones iniciales, no refleja estado actual de 122 migraciones.

2. Tipos de Supabase desactualizados:
- El tipado no incluye 21 tablas reales.

3. Numeracion duplicada de migraciones:
- Existen duplicados `100_*` y `101_*`.

4. Posible bug en `create-mp-preference`:
- Se usa `currencyId` antes de su declaracion en el armado de `mpItems`.

5. Script con hardcode riesgoso:
- `scripts/load-products-from-csv.js` fija `organizationId` hardcodeado, ignorando el argumento ingresado.

6. Cobertura de pruebas parcial:
- Hay tests de utilidades y validaciones, pero no hay suite integral de flujos end-to-end del negocio.

7. Ruta potencialmente no expuesta:
- Existe `AdminNotificationSettings.tsx`, pero no aparece registrada en `App.tsx` como ruta navegable directa.

## 13) Mapa de archivos clave
Nucleo app:
- `src/App.tsx`
- `src/main.tsx`

Estado global:
- `src/store/authStore.ts`
- `src/store/organizationStore.ts`
- `src/store/cartStore.ts`

Infra cliente:
- `src/lib/supabase.ts`
- `src/lib/stock.ts`
- `src/lib/permissions.ts`
- `src/lib/planLimits.ts`

Panel admin:
- `src/components/layout/AdminLayout.tsx`
- `src/pages/admin/*`

Tienda publica:
- `src/components/layout/PublicStoreWrapper.tsx`
- `src/components/layout/PublicStoreLayout.tsx`
- `src/pages/PublicStore.tsx`
- `src/pages/Products.tsx`
- `src/pages/ProductDetail.tsx`
- `src/pages/Checkout.tsx`

Supabase:
- `supabase/migrations/*`
- `supabase/functions/*`

## 14) Flujo de datos de extremo a extremo (resumen)
1. Usuario navega tienda por `slug`.
2. Se resuelve organizacion via RPC `get_org_by_slug`.
3. Catalogo/stock se consulta por tablas + RPCs de stock.
4. En checkout se valida stock por branch y se crea orden + items + pago.
5. Si MP: se crea preferencia y webhook actualiza estado/pago.
6. Si Biller activo: emite CFE y guarda traza en `biller_comprobantes`.
7. Triggers SQL generan movimientos, notificaciones y recalculos.
8. Panel admin explota reportes y operacion por sucursal/organizacion.

## 15) Recomendaciones priorizadas
Prioridad alta:
1. Regenerar `database.types.ts` y eliminar `as any` donde sea posible.
2. Corregir test fallando en `schemas.test.ts` (alinear contrato de `category_id`).
3. Corregir bug de `currencyId` en `create-mp-preference`.
4. Resolver duplicados de numeracion de migraciones y definir convension unica.
5. Actualizar `README.md` a estado real del sistema.

Prioridad media:
1. Revisar ruta/uso de `AdminNotificationSettings`.
2. Corregir script `load-products-from-csv.js` para respetar org por parametro.
3. Agregar pruebas end-to-end de checkout + stock + pagos + webhooks.

Prioridad de gobernanza:
1. Mantener checklist de seguridad para funciones `SECURITY DEFINER`.
2. Definir pipeline CI para validar migraciones + tests + type generation.

## 16) Nota de uso para NotebookLM
Este documento esta pensado para servir como "source of truth" tecnica inicial.

Si NotebookLM se usa para profundizar, conviene cargar ademas:
- `src/App.tsx`
- `src/store/*.ts`
- `src/pages/admin/*.tsx` (modulos clave)
- `supabase/migrations/*.sql` (especialmente 066+, 082+, 089+, 094+, 104+)
- `supabase/functions/*.ts`
