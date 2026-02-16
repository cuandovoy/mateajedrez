-- Migration: 034_add_organizations.sql
-- Fase 1: Crear tablas organizations y organization_members para multi-tenant
-- Ejecutar antes de 035, 036, 037

-- ============================================
-- 1. TABLA ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color VARCHAR(7),
  settings JSONB DEFAULT '{}',
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. TABLA ORGANIZATION_MEMBERS
-- ============================================
-- Un usuario puede pertenecer a múltiples organizaciones con diferentes roles
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. FUNCIONES HELPER PARA MULTI-TENANT
-- ============================================

-- Obtener IDs de organizaciones donde el usuario es miembro
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar si el usuario es miembro de una organización
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verificar si el usuario es admin o manager en una organización
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verificar si el usuario es admin en una organización
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Mantener is_admin() para compatibilidad durante migración (usa user_profiles)
-- Se deprecará cuando todo use organization_members
-- No modificamos is_admin() aquí para no romper RLS existente

-- ============================================
-- 4. RLS EN ORGANIZATIONS Y ORGANIZATION_MEMBERS
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations: miembros pueden ver su org
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Organizations: solo admins pueden insertar (para crear org - se hará con service role o función)
CREATE POLICY "Authenticated users can create organization"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Organizations: solo admins de la org pueden actualizar
CREATE POLICY "Org admins can update organization"
  ON organizations FOR UPDATE
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- Organization members: usuarios pueden ver miembros de sus orgs
CREATE POLICY "Members can view org members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Organization members: admins de la org pueden insertar (invitar)
CREATE POLICY "Org admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

-- Organization members: admins pueden actualizar (cambiar rol)
CREATE POLICY "Org admins can update members"
  ON organization_members FOR UPDATE
  USING (public.is_org_admin_or_manager(organization_id));

-- Organization members: admins pueden eliminar miembros
CREATE POLICY "Org admins can delete members"
  ON organization_members FOR DELETE
  USING (public.is_org_admin_or_manager(organization_id));
