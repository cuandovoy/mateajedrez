# Instrucciones de Migración

Este documento explica cómo ejecutar las migraciones de base de datos en Supabase.

## 📋 Pasos para Ejecutar las Migraciones

### Opción 1: SQL Editor en Supabase Dashboard (Recomendado)

1. **Accede a tu proyecto en Supabase**
   - Ve a [supabase.com](https://supabase.com)
   - Inicia sesión y selecciona tu proyecto

2. **Abre el SQL Editor**
   - En el menú lateral, haz clic en "SQL Editor"
   - Haz clic en "New query"

3. **Ejecuta la primera migración**
   - Copia todo el contenido de `supabase/migrations/001_initial_schema.sql`
   - Pégalo en el editor SQL
   - Haz clic en "Run" o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
   - Verifica que no haya errores

4. **Ejecuta las migraciones restantes en orden**
   - `002_row_level_security.sql` - Políticas de seguridad RLS
   - `003_auto_create_profile.sql` - Trigger para crear perfiles automáticamente
   - `004_fix_rls_recursion.sql` - Corrección de recursión infinita en RLS
   - `005_add_subcategories_and_storage.sql` - Subcategorías y almacenamiento de imágenes
   - `006_allow_guest_orders.sql` - Permitir órdenes de invitados (sin usuario)
   - `007_add_payment_method.sql` - Métodos de pago y descuento automático de stock
   - Para cada una: copia el contenido, pégalo en el editor SQL, haz clic en "Run" y verifica que no haya errores

### Opción 2: Supabase CLI (Avanzado)

Si tienes Supabase CLI instalado:

```bash
# Inicializar Supabase (solo la primera vez)
supabase init

# Vincular tu proyecto
supabase link --project-ref tu-project-ref

# Ejecutar migraciones
supabase db push
```

## ✅ Verificación

Después de ejecutar las migraciones, verifica que las tablas se hayan creado:

1. Ve a "Table Editor" en el dashboard de Supabase
2. Deberías ver las siguientes tablas:
   - `categories`
   - `products`
   - `user_profiles`
   - `cart_items`
   - `orders`
   - `order_items`

## 🔐 Crear Usuario Admin

Para crear un usuario administrador:

1. **Registra un usuario desde la aplicación**
   - Ve a `/register` en tu app
   - Crea una cuenta con tu email

2. **Actualiza el rol a admin**
   - Ve a SQL Editor en Supabase
   - Ejecuta la siguiente consulta (reemplaza `TU_EMAIL` con tu email):

```sql
UPDATE user_profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'TU_EMAIL'
);
```

3. **Verifica el cambio**
   - Cierra sesión y vuelve a iniciar sesión
   - Deberías ver el botón "Admin" en el header

## 📝 Notas Importantes

- **Ejecuta las migraciones en orden numérico**: `001`, `002`, `003`, `004`, `005`, `006`, `007`
- **No ejecutes las migraciones dos veces**: Si ya las ejecutaste, no es necesario volver a hacerlo
- **Backup**: Siempre haz backup de tu base de datos antes de ejecutar migraciones en producción
- **Migración 006**: Esta migración permite que usuarios no autenticados creen órdenes (guest orders)
- **Migración 007**: Agrega métodos de pago (transferencia, mercado pago) y descuenta automáticamente el stock cuando se crea una orden

## 🐛 Solución de Problemas

### Error: "relation already exists"
- Esto significa que las tablas ya existen
- Puedes ignorar este error o eliminar las tablas manualmente si necesitas empezar de nuevo

### Error: "permission denied"
- Asegúrate de estar usando el SQL Editor con permisos de administrador
- Verifica que estés conectado a la base de datos correcta

### Error: "extension already exists"
- El error sobre la extensión UUID es normal si ya existe
- Puedes ignorarlo de forma segura

## 🔄 Rollback (Si es necesario)

Si necesitas revertir las migraciones, ejecuta:

```sql
-- Eliminar triggers
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

-- Eliminar función
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Eliminar tablas (en orden inverso)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Eliminar tipos
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS user_role;
```

**⚠️ ADVERTENCIA**: Esto eliminará todos los datos. Úsalo solo en desarrollo.
