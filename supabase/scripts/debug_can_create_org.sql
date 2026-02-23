-- Ejecutar debug_can_create_org (diagnóstico RLS para crear organizaciones)
-- En SQL Editor auth.uid() suele ser null. Para ver tu usuario real: en la app, página
-- Organizaciones, hacé clic en el ícono de bug (🐛) junto a "Crear Organización".

SELECT * FROM public.debug_can_create_org();
