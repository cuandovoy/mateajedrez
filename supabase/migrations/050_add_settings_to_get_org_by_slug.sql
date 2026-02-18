-- Incluir settings en get_org_by_slug para que el storefront pueda formatear precios/fechas por org
-- DROP necesario porque PostgreSQL no permite cambiar el tipo de retorno de una función existente
DROP FUNCTION IF EXISTS public.get_org_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_org_by_slug(p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, logo_url TEXT, primary_color TEXT, settings JSONB)
AS $$
  SELECT o.id, o.name::TEXT, o.slug::TEXT, o.logo_url::TEXT, o.primary_color::TEXT, COALESCE(o.settings, '{}'::jsonb)
  FROM organizations o
  WHERE o.slug = p_slug AND o.subscription_status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
