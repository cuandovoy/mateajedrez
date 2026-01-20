# Solución al Error de RLS en user_profiles

## Problema

Error al registrarse:
```
new row violates row-level security policy for table "user_profiles"
```

## Causa

La política de Row Level Security (RLS) está bloqueando la inserción del perfil de usuario durante el registro, porque el usuario aún no está completamente autenticado cuando se intenta crear el perfil.

## Solución

Se ha creado una migración (`003_auto_create_profile.sql`) que:

1. **Crea un trigger automático**: Cuando se crea un usuario en `auth.users`, automáticamente se crea su perfil en `user_profiles`
2. **Usa SECURITY DEFINER**: La función se ejecuta con permisos de administrador, por lo que puede insertar sin restricciones de RLS
3. **Actualiza el código**: El store de autenticación ya no intenta crear el perfil manualmente

## Pasos para Aplicar la Solución

1. **Ejecuta la nueva migración**:
   - Ve a Supabase Dashboard → SQL Editor
   - Copia y ejecuta el contenido de `supabase/migrations/003_auto_create_profile.sql`

2. **Verifica que el trigger se creó**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

3. **Prueba el registro**:
   - Intenta registrarte nuevamente desde la aplicación
   - El perfil debería crearse automáticamente sin errores

## Si el Error Persiste

Si después de ejecutar la migración aún tienes problemas:

1. **Verifica que el trigger existe**:
   ```sql
   SELECT tgname, tgrelid::regclass 
   FROM pg_trigger 
   WHERE tgname = 'on_auth_user_created';
   ```

2. **Verifica que la función existe**:
   ```sql
   SELECT proname, prosecdef 
   FROM pg_proc 
   WHERE proname = 'handle_new_user';
   ```

3. **Prueba crear un usuario manualmente**:
   ```sql
   -- Esto debería crear automáticamente el perfil
   INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
   VALUES (
     gen_random_uuid(),
     'test@example.com',
     crypt('password', gen_salt('bf')),
     NOW()
   );
   ```

4. **Si necesitas eliminar y recrear**:
   ```sql
   -- Eliminar trigger y función
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   DROP FUNCTION IF EXISTS public.handle_new_user();
   
   -- Luego ejecuta nuevamente 003_auto_create_profile.sql
   ```

## Notas Importantes

- El trigger se ejecuta automáticamente cuando se crea un usuario
- El perfil se crea con rol 'user' por defecto
- El nombre completo se toma de `raw_user_meta_data` si está disponible
- Si el perfil ya existe, se ignora (ON CONFLICT DO NOTHING)
