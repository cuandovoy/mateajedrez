-- Migration: Consolidate organizations INSERT policy
--
-- PROBLEM:
--   Multiple overlapping INSERT policies on the organizations table
--   left the RLS state inconsistent — platform admins (user_profiles.role = 'admin')
--   were getting 42501 despite the policy intending to allow them.
--
-- FIX:
--   Drop every INSERT policy and create exactly one, clearly named policy.
--   Also drop the now-unused can_create_organization() helper function.

-- =============================================================================
-- 1. Drop all existing INSERT policies on organizations
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can create organization" ON organizations;
DROP POLICY IF EXISTS "Auth create org"                             ON organizations;
DROP POLICY IF EXISTS "Org admins can create organization"         ON organizations;
DROP POLICY IF EXISTS "Managers can create organization"           ON organizations;

-- =============================================================================
-- 2. Drop old helper and recreate as SECURITY DEFINER
--
--    A subquery inside a WITH CHECK runs under the calling user's RLS context.
--    If user_profiles has its own RLS, the subquery can return NULL instead of
--    the real role, making the admin check silently fail.
--    SECURITY DEFINER bypasses row-level security when reading user_profiles.
-- =============================================================================

DROP FUNCTION IF EXISTS public.can_create_organization();

CREATE OR REPLACE FUNCTION public.can_create_organization()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      -- Platform admin (reads user_profiles bypassing RLS)
      (SELECT role::TEXT FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) = 'admin'
      OR
      -- Bootstrap: user has no organizations yet
      NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid())
    );
$$;

-- =============================================================================
-- 3. Single, canonical INSERT policy using the SECURITY DEFINER function
-- =============================================================================

CREATE POLICY "organizations_insert"
  ON organizations
  FOR INSERT
  WITH CHECK (public.can_create_organization());
