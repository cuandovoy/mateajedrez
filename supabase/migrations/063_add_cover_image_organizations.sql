-- Imagen de portada para la tienda pública (hero/banner)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN organizations.cover_image_url IS 'URL de la imagen de portada/hero de la tienda pública';

-- Actualizar get_org_by_slug para devolver cover_image_url
DROP FUNCTION IF EXISTS public.get_org_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_org_by_slug(p_slug TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
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
    o.cover_image_url::TEXT,
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
