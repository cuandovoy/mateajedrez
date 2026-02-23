-- Asignar rol admin de plataforma (user_profiles.role = 'admin') a un usuario.
-- Ejecutar en Supabase SQL Editor (como owner del proyecto).
-- Así ese usuario podrá crear organizaciones (política RLS can_create_organization).

-- Opción A: Por email del usuario (reemplazá el email)
UPDATE user_profiles up
SET role = 'admin'
FROM auth.users u
WHERE up.user_id = u.id
  AND u.email = 'TU_EMAIL@ejemplo.com';

-- Opción B: Por user_id (reemplazá el UUID)
-- UPDATE user_profiles SET role = 'admin' WHERE user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- Verificar: listar user_profiles con su email
-- SELECT up.user_id, up.role, u.email
-- FROM user_profiles up
-- JOIN auth.users u ON u.id = up.user_id;
