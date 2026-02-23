-- Fijar tu usuario como admin de plataforma (crear perfil si no existe).
-- User id: 19307bc3-252c-429e-976c-8e55563eba86 (lucasciceri59@gmail.com)
-- Ejecutar en Supabase → SQL Editor → Run.

-- Crear o actualizar user_profiles con role = 'admin'
INSERT INTO public.user_profiles (user_id, role, full_name)
VALUES (
  '19307bc3-252c-429e-976c-8e55563eba86'::uuid,
  'admin',
  'Lucas Ciceri'
)
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name;

-- Verificar
SELECT up.user_id, up.role, up.full_name, u.email
FROM user_profiles up
JOIN auth.users u ON u.id = up.user_id
WHERE up.user_id = '19307bc3-252c-429e-976c-8e55563eba86'::uuid;
