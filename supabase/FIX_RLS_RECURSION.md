# Solución al Error de Recursión Infinita en RLS

## Problema

Error al intentar acceder a datos:
```
infinite recursion detected in policy for relation "user_profiles"
```

## Causa

Las políticas de Row Level Security (RLS) están creando una recursión infinita. Esto sucede cuando:

1. Una política en `user_profiles` intenta verificar si el usuario es admin
2. Para verificar esto, necesita leer de `user_profiles`
3. Pero para leer de `user_profiles`, necesita pasar por la misma política
4. Esto crea un bucle infinito

**Ejemplo del problema:**
```sql
-- Esta política causa recursión infinita
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_profiles  -- ← Intenta leer user_profiles
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = 'admin'
  ));
```

## Solución

Se ha creado una migración (`004_fix_rls_recursion.sql`) que:

1. **Crea una función helper `is_admin()`**: 
   - Usa `SECURITY DEFINER` para ejecutarse con permisos de administrador
   - Puede leer `user_profiles` sin pasar por las políticas RLS
   - Evita la recursión

2. **Actualiza todas las políticas**:
   - Reemplaza las consultas directas a `user_profiles` con llamadas a `is_admin()`
   - Elimina la recursión en todas las tablas

## Pasos para Aplicar la Solución

1. **Ejecuta la nueva migración**:
   - Ve a Supabase Dashboard → SQL Editor
   - Copia y ejecuta el contenido de `supabase/migrations/004_fix_rls_recursion.sql`

2. **Verifica que la función se creó**:
   ```sql
   SELECT proname, prosecdef 
   FROM pg_proc 
   WHERE proname = 'is_admin';
   ```

3. **Prueba el acceso**:
   - Intenta acceder al panel de administración
   - Intenta crear/editar productos
   - Debería funcionar sin errores de recursión

## Cómo Funciona la Solución

### Antes (con recursión):
```sql
-- Política que causa recursión
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_profiles  -- ← Recursión aquí
    WHERE user_profiles.user_id = auth.uid()
    AND user_profiles.role = 'admin'
  ));
```

### Después (sin recursión):
```sql
-- Función helper que evita recursión
CREATE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.user_id = user_id_param
    AND user_profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Política que usa la función (sin recursión)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())  -- ← Usa función, no recursión
  );
```

## Tablas Afectadas

La migración actualiza las políticas en:
- ✅ `user_profiles` (principal causa del problema)
- ✅ `categories`
- ✅ `products`
- ✅ `orders`
- ✅ `order_items`

## Si el Error Persiste

1. **Verifica que todas las políticas antiguas se eliminaron**:
   ```sql
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE tablename = 'user_profiles';
   ```

2. **Verifica que la función existe y funciona**:
   ```sql
   SELECT public.is_admin(auth.uid());
   ```

3. **Si necesitas empezar de nuevo**:
   ```sql
   -- Eliminar todas las políticas
   DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
   DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
   DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
   
   -- Eliminar función
   DROP FUNCTION IF EXISTS public.is_admin(UUID);
   
   -- Luego ejecuta nuevamente 004_fix_rls_recursion.sql
   ```

## Notas Importantes

- La función `is_admin()` usa `SECURITY DEFINER`, lo que significa que se ejecuta con permisos de administrador
- La función está marcada como `STABLE` para optimización
- Todas las políticas ahora usan esta función en lugar de consultar directamente `user_profiles`
- Esto elimina completamente la recursión infinita
