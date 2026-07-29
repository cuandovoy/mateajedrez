# Cupones de descuento para la tienda

Documento de traspaso técnico de la implementación de cupones para checkout público.

## Objetivo

Habilitar cupones que:

1. Los cree el admin desde el panel.
2. Tengan un código, un valor y una fecha de validez.
3. Se puedan aplicar en el checkout público.
4. Descuenten del total antes de pagar.
5. Apliquen tanto para monto fijo como para porcentaje.
6. Queden reflejados en la orden, en la confirmación y en los reportes.

## Alcance funcional

El sistema actual soporta:

- Cupones de `monto fijo`.
- Cupones de `porcentaje`.
- Vigencia por fecha.
- Activación y desactivación manual.
- Validación pública desde checkout.
- Persistencia del descuento en la orden.
- Ajuste del flujo de Mercado Pago cuando el cupón deja el total en cero.

## Flujo general

### 1. Administración

El admin crea un cupón con:

- `code`
- `kind`:
  - `fixed_amount`
  - `percentage`
- `amount`
- `valid_until`
- `is_active`

### 2. Checkout público

El cliente ingresa un código en checkout.

El frontend:

- normaliza el código
- consulta la RPC `validate_store_coupon`
- calcula el descuento según el tipo de cupón
- actualiza el total final
- guarda el descuento en la orden

### 3. Orden creada

La orden guarda:

- `subtotal_before_discount`
- `discount_total`
- `discount_metadata`
- `total`

### 4. Mercado Pago

Si el total final es mayor que cero:

- se crea la preferencia de Mercado Pago
- se redirige al checkout de MP

Si el cupón cubre el total completo:

- no se crea preferencia
- no se intenta cobrar por Mercado Pago
- la pantalla de confirmación lo muestra explícitamente

## Cambios de base de datos

### Nueva tabla

Se agregó la tabla `public.store_coupons`.

Campos principales:

- `id`
- `organization_id`
- `code`
- `kind`
- `amount`
- `valid_until`
- `is_active`
- `created_by`
- `created_at`
- `updated_at`

### Reglas de negocio

- `code` se normaliza a mayúsculas y sin espacios.
- `amount` siempre debe ser mayor a cero.
- Si `kind = 'percentage'`, el valor máximo permitido es `100`.
- El cupón solo se considera válido si:
  - pertenece a la organización
  - está activo
  - no venció

### Seguridad

- RLS activado en `store_coupons`
- Políticas para admin/manager de la organización
- RPC pública de validación con `SECURITY DEFINER`

## Migraciones creadas

### `supabase/migrations/148_storefront_coupons.sql`

Primera versión de la funcionalidad.

Incluye:

- creación de `store_coupons`
- normalización del código
- RLS
- RPC `validate_store_coupon`
- grants

### `supabase/migrations/149_storefront_coupons_percentage.sql`

Extiende el modelo para soportar:

- `fixed_amount`
- `percentage`

Además:

- agrega la columna `kind`
- ajusta constraints
- actualiza la RPC para devolver `kind`

## Helpers agregados

### `src/lib/coupons.ts`

Se agregaron helpers reutilizables:

- `normalizeCouponCode(value)`
- `generateCouponCode(prefix, length)`
- `calculateCouponDiscountAmount(kind, value, subtotal)`
- `StoreCouponKind`

`calculateCouponDiscountAmount` centraliza la lógica para que:

- `fixed_amount` descuente un monto fijo
- `percentage` descuente un porcentaje del subtotal
- nunca se descuente más que el subtotal

## Tipos

### `src/types/database.types.ts`

Se actualizó el tipo de `store_coupons` para incluir:

- `kind: 'fixed_amount' | 'percentage'`

### `src/types/index.ts`

Se mantiene la exportación de tipos de cupones para consumo en UI y lógica.

## Panel admin

### Nueva pantalla

`src/pages/admin/AdminCoupons.tsx`

Permite:

- crear cupones
- editarlos
- activarlos/desactivarlos
- eliminarlos
- copiar el código

### Campos del formulario

- código
- tipo:
  - monto fijo
  - porcentaje
- valor
- fecha de validez
- activo/inactivo

### Validaciones del formulario

- el código no puede estar vacío
- el valor debe ser mayor a cero
- si el tipo es porcentaje, no puede superar 100
- la fecha de validez es obligatoria

### Vista de listado

Cada cupón muestra:

- código
- estado
- tipo
- valor
- fecha de vencimiento

## Navegación admin

### `src/components/layout/AdminLayout.tsx`

Se agregó acceso a `Cupones` en el menú lateral.

### `src/App.tsx`

Se registró la ruta:

- `/coupons`

### Permisos

### `src/lib/permissions.ts`

Se sumó `/coupons` al módulo de ventas.

### `src/lib/queryKeys.ts`

Se agregó la query key:

- `queryKeys.coupons.all(orgId)`

## Checkout público

### `src/pages/Checkout.tsx`

Se agregaron:

- estado local para cupón
- validación remota
- cálculo del descuento
- visualización del descuento
- persistencia en la orden

### Validación del cupón

El checkout llama a la RPC:

- `validate_store_coupon`

Se valida:

- existencia
- organización correcta
- activo
- no vencido

### Cálculo del descuento

Se calcula según `kind`:

- `fixed_amount` => descuento = valor fijo
- `percentage` => descuento = subtotal x porcentaje / 100

Luego se aplica:

- `discount_total`
- `total`

### Persistencia en la orden

La orden guarda:

- `subtotal_before_discount`
- `discount_total`
- `discount_metadata`

`discount_metadata` incluye:

- `source: 'coupon'`
- `coupon_id`
- `code`
- `kind`
- `value`
- `applied_amount`
- `valid_until`
- `applied_at`

### Mercado Pago

Si el total final es mayor a cero:

- se crea la preferencia
- se redirige a Mercado Pago

Si el total final es cero:

- no se crea preferencia
- no se redirige a Mercado Pago

## Confirmación de orden

### `src/pages/OrderConfirmation.tsx`

Se ajustó para mostrar:

- subtotal antes del descuento
- valor del cupón
- descuento aplicado
- total final

También se ajustó el comportamiento visual para órdenes con total cero:

- no muestra el banner de `Pago en proceso`
- muestra un banner específico de que el cupón cubrió el total
- etiqueta Mercado Pago como `sin pago requerido`

## Mercado Pago

### `supabase/functions/create-mp-preference/index.ts`

Se agregó un guard:

- si el total de la orden es `0`, la función devuelve error y no crea la preferencia

Esto evita:

- crear preferencias inválidas
- redirigir innecesariamente al checkout externo

### `supabase/functions/mp-webhook/index.ts`

No requirió cambios funcionales para el cupón.

La pasarela sigue trabajando sobre el total final de la orden.

### `supabase/functions/mp-refresh-payment/index.ts`

No requirió cambios funcionales para el cupón.

Sigue refrescando el estado del pago sobre la orden ya creada.

## Estado final del cupón

El cupón puede ser:

- `fixed_amount`
- `percentage`

Ejemplos:

- `fixed_amount`, valor `500` => descuenta $500
- `percentage`, valor `10` => descuenta 10% del subtotal

## Orden de implementación recomendada para portar a otro repo

1. Crear la migración de `store_coupons`.
2. Agregar el helper de cupones.
3. Actualizar tipos generados de Supabase.
4. Crear la pantalla admin.
5. Registrar ruta y navegación.
6. Actualizar checkout.
7. Ajustar confirmación de orden.
8. Proteger la creación de preferencia de Mercado Pago si el total es cero.
9. Validar build y typecheck.

## Archivos tocados

- `supabase/migrations/148_storefront_coupons.sql`
- `supabase/migrations/149_storefront_coupons_percentage.sql`
- `src/lib/coupons.ts`
- `src/types/database.types.ts`
- `src/pages/admin/AdminCoupons.tsx`
- `src/components/layout/AdminLayout.tsx`
- `src/App.tsx`
- `src/lib/permissions.ts`
- `src/lib/queryKeys.ts`
- `src/pages/Checkout.tsx`
- `src/pages/OrderConfirmation.tsx`
- `supabase/functions/create-mp-preference/index.ts`

## Verificación realizada

Se validó con:

- `npm run type-check`
- `npm run build`

## Notas para el repo destino

- Si el repo destino usa migraciones generadas automáticamente, esta implementación se puede copiar como dos pasos:
  - tabla base de cupones
  - migración de `kind`
- Si la app tiene otro naming para permisos o layout admin, solo hay que mapear:
  - ruta `coupons`
  - permiso `ventas:gestionar`
- Si el checkout usa otra pasarela, el cálculo de descuento queda igual:
  - validar cupón
  - calcular descuento
  - persistir subtotal, descuento y metadata

