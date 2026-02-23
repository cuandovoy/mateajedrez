-- Migration: 059_update_get_org_by_slug_with_styles.sql
-- Actualizar función get_org_by_slug para incluir campos de estilo

-- DROP necesario porque PostgreSQL no permite cambiar el tipo de retorno de una función existente
DROP FUNCTION IF EXISTS public.get_org_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_org_by_slug(p_slug TEXT)
RETURNS TABLE(
  id UUID, 
  name TEXT, 
  slug TEXT, 
  logo_url TEXT, 
  primary_color TEXT, 
  secondary_color TEXT,
  accent_color TEXT,
  font_family TEXT,
  font_heading TEXT,
  border_radius TEXT,
  button_style TEXT,
  settings JSONB
)
AS $$
  SELECT 
    o.id, 
    o.name::TEXT, 
    o.slug::TEXT, 
    o.logo_url::TEXT, 
    o.primary_color::TEXT,
    o.secondary_color::TEXT,
    o.accent_color::TEXT,
    o.font_family::TEXT,
    o.font_heading::TEXT,
    o.border_radius::TEXT,
    o.button_style::TEXT,
    COALESCE(o.settings, '{}'::jsonb)
  FROM organizations o
  WHERE o.slug = p_slug AND o.subscription_status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
