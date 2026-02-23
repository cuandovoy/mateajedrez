-- Migration: 058_add_store_styles_to_organizations.sql
-- Agregar campos de estilo para personalización de tienda pública

-- Agregar columnas de estilo a la tabla organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7),
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7),
  ADD COLUMN IF NOT EXISTS font_family VARCHAR(100),
  ADD COLUMN IF NOT EXISTS font_heading VARCHAR(100),
  ADD COLUMN IF NOT EXISTS border_radius VARCHAR(20),
  ADD COLUMN IF NOT EXISTS button_style VARCHAR(50);

-- Comentarios para documentación
COMMENT ON COLUMN organizations.secondary_color IS 'Color secundario para acentos en la tienda pública (formato hex: #RRGGBB)';
COMMENT ON COLUMN organizations.accent_color IS 'Color de acento para elementos destacados (formato hex: #RRGGBB)';
COMMENT ON COLUMN organizations.font_family IS 'Familia de fuente para texto general (ej: Poppins, Inter, Roboto)';
COMMENT ON COLUMN organizations.font_heading IS 'Familia de fuente para títulos (opcional, si difiere de font_family)';
COMMENT ON COLUMN organizations.border_radius IS 'Radio de bordes (rounded, rounded-lg, rounded-xl, rounded-full)';
COMMENT ON COLUMN organizations.button_style IS 'Estilo de botones (rounded, pill, square)';
