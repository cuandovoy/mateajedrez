-- Fix infinite recursion in user_profiles policies
-- The issue is that policies try to check if user is admin by querying user_profiles,
-- which requires passing the same policy, creating infinite recursion.

-- Drop existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create a helper function to check if user is admin
-- This function uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.user_id = user_id_param
    AND user_profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate policies for user_profiles without recursion
-- Users can view their own profile, and admins can view all profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())
  );

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile, admins can update any profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())
  );

-- Update policies for other tables to use the helper function
-- This avoids recursion issues

-- Categories policies
DROP POLICY IF EXISTS "Categories are insertable by admins" ON categories;
DROP POLICY IF EXISTS "Categories are updatable by admins" ON categories;
DROP POLICY IF EXISTS "Categories are deletable by admins" ON categories;

CREATE POLICY "Categories are insertable by admins"
  ON categories FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Categories are updatable by admins"
  ON categories FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Categories are deletable by admins"
  ON categories FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Products policies
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Products are insertable by admins" ON products;
DROP POLICY IF EXISTS "Products are updatable by admins" ON products;
DROP POLICY IF EXISTS "Products are deletable by admins" ON products;

CREATE POLICY "Active products are viewable by everyone"
  ON products FOR SELECT
  USING (
    is_active = true 
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Products are insertable by admins"
  ON products FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Products are updatable by admins"
  ON products FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Products are deletable by admins"
  ON products FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Orders policies
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR public.is_admin(auth.uid())
  );

-- Order items policies
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.user_id = auth.uid() 
        OR public.is_admin(auth.uid())
      )
    )
  );
