-- Fix RLS: wrap auth.uid() in scalar subqueries (SELECT auth.uid()) so it's
-- evaluated once per statement instead of once per row. Improves performance at scale.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security

-- =============================================================================
-- 1. HELPER FUNCTIONS - use (SELECT auth.uid()) internally
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = (SELECT auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN roles r ON r.key = om.role
    JOIN roles_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE om.user_id = (SELECT auth.uid())
    AND om.organization_id = p_org_id
    AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = (SELECT auth.uid()) AND organization_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = (SELECT auth.uid()) AND organization_id = p_org_id AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = (SELECT auth.uid()) AND organization_id = p_org_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_create_organization()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT auth.uid()) IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
      )
      OR
      NOT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = (SELECT auth.uid())
      )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_storage_object(p_bucket_id TEXT, p_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF position('/' IN p_path) > 0 THEN
    BEGIN
      v_org_id := (split_part(p_path, '/', 1))::UUID;
      RETURN public.is_org_admin_or_manager(v_org_id);
    EXCEPTION WHEN OTHERS THEN
      RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
      );
    END;
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    );
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 2. ORGANIZATIONS
-- =============================================================================
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
CREATE POLICY "Members can view their organization" ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())));

-- =============================================================================
-- 3. CATEGORIES
-- =============================================================================
DROP POLICY IF EXISTS "Categories select by org member" ON categories;
CREATE POLICY "Categories select by org member" ON categories FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())));

-- =============================================================================
-- 4. PRODUCTS
-- =============================================================================
DROP POLICY IF EXISTS "Products select by org member or public" ON products;
CREATE POLICY "Products select by org member or public" ON products FOR SELECT
  USING (
    is_active = true
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

-- =============================================================================
-- 5. CART_ITEMS
-- =============================================================================
DROP POLICY IF EXISTS "Cart items select own in org" ON cart_items;
CREATE POLICY "Cart items select own in org" ON cart_items FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Cart items insert own in org" ON cart_items;
CREATE POLICY "Cart items insert own in org" ON cart_items FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Cart items update own in org" ON cart_items;
CREATE POLICY "Cart items update own in org" ON cart_items FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Cart items delete own in org" ON cart_items;
CREATE POLICY "Cart items delete own in org" ON cart_items FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

-- =============================================================================
-- 6. ORDERS
-- =============================================================================
DROP POLICY IF EXISTS "Orders select own or org admin or guest" ON orders;
CREATE POLICY "Orders select own or org admin or guest" ON orders FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Orders insert own or org member or guest" ON orders;
CREATE POLICY "Orders insert own or org member or guest" ON orders FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Orders update own or org admin" ON orders;
CREATE POLICY "Orders update own or org admin" ON orders FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'manager')
    )
  );

-- =============================================================================
-- 7. ORDER_ITEMS
-- =============================================================================
DROP POLICY IF EXISTS "Order items select via orders" ON order_items;
CREATE POLICY "Order items select via orders" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND (
        o.user_id = (SELECT auth.uid())
        OR o.user_id IS NULL
        OR o.organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'manager')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Order items insert via orders" ON order_items;
CREATE POLICY "Order items insert via orders" ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND (o.user_id = (SELECT auth.uid()) OR o.user_id IS NULL OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())))
    )
  );

-- =============================================================================
-- 8. SUPPLIERS
-- =============================================================================
DROP POLICY IF EXISTS "Suppliers select by org member" ON suppliers;
CREATE POLICY "Suppliers select by org member" ON suppliers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())));

-- =============================================================================
-- 9. BRANCHES
-- =============================================================================
DROP POLICY IF EXISTS "Branches select by org member" ON branches;
CREATE POLICY "Branches select by org member" ON branches FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())));

-- =============================================================================
-- 10. CUSTOMERS
-- =============================================================================
DROP POLICY IF EXISTS "Customers select own or org admin" ON customers;
CREATE POLICY "Customers select own or org admin" ON customers FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
      AND (public.has_org_permission(organization_id, 'customers:view') OR public.is_org_admin(organization_id))
    )
  );

-- =============================================================================
-- 11. PRODUCT_VARIANTS
-- =============================================================================
DROP POLICY IF EXISTS "Product variants select by product org" ON product_variants;
CREATE POLICY "Product variants select by product org" ON product_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND (p.is_active = true OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())))
    )
  );

-- =============================================================================
-- 12. PRODUCT_IMAGES
-- =============================================================================
DROP POLICY IF EXISTS "Product images select by product org" ON product_images;
CREATE POLICY "Product images select by product org" ON product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (p.is_active = true OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())))
    )
  );

-- =============================================================================
-- 13. PRODUCT_BARCODES
-- =============================================================================
DROP POLICY IF EXISTS "Product barcodes select by product org" ON product_barcodes;
CREATE POLICY "Product barcodes select by product org" ON product_barcodes FOR SELECT
  USING (
    COALESCE(
      (SELECT p.organization_id FROM products p WHERE p.id = product_barcodes.product_id),
      (SELECT p.organization_id FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id)
    ) IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
  );

-- =============================================================================
-- 14. PRODUCT_SUPPLIERS
-- =============================================================================
DROP POLICY IF EXISTS "Product suppliers select by product org" ON product_suppliers;
CREATE POLICY "Product suppliers select by product org" ON product_suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
    )
  );

-- =============================================================================
-- 15. BRANCH_INVENTORY
-- =============================================================================
DROP POLICY IF EXISTS "Branch inventory select by branch org" ON branch_inventory;
CREATE POLICY "Branch inventory select by branch org" ON branch_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_inventory.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
    )
  );

-- =============================================================================
-- 16. CASH_SESSIONS
-- =============================================================================
DROP POLICY IF EXISTS "Cash sessions select by branch org" ON cash_sessions;
CREATE POLICY "Cash sessions select by branch org" ON cash_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = cash_sessions.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Cash sessions insert by branch org" ON cash_sessions;
CREATE POLICY "Cash sessions insert by branch org" ON cash_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = cash_sessions.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
      AND (public.has_org_permission(b.organization_id, 'cash_register:access') OR public.is_org_admin_or_manager(b.organization_id))
    )
  );

DROP POLICY IF EXISTS "Cash sessions update by branch org" ON cash_sessions;
CREATE POLICY "Cash sessions update by branch org" ON cash_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = cash_sessions.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
    )
  );

-- =============================================================================
-- 17. ORDER_PAYMENTS
-- =============================================================================
DROP POLICY IF EXISTS "Order payments select via order" ON order_payments;
DROP POLICY IF EXISTS "Order payments select via order owner or admins" ON order_payments;
CREATE POLICY "Order payments select via order" ON order_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
      AND (
        o.user_id = (SELECT auth.uid())
        OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "Order payments insert via order" ON order_payments;
CREATE POLICY "Order payments insert via order" ON order_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
      AND o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
    )
  );

-- =============================================================================
-- 18. INVENTORY_MOVEMENTS
-- =============================================================================
DROP POLICY IF EXISTS "Inventory movements select by org" ON inventory_movements;
CREATE POLICY "Inventory movements select by org" ON inventory_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branch_inventory bi
      JOIN branches b ON b.id = bi.branch_id
      WHERE bi.id = inventory_movements.branch_inventory_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()))
    )
  );

-- =============================================================================
-- 19. INVENTORY_TRANSFERS
-- =============================================================================
DROP POLICY IF EXISTS "Inventory transfers select by org" ON inventory_transfers;
CREATE POLICY "Inventory transfers select by org" ON inventory_transfers FOR SELECT
  USING (
    from_branch_id IN (SELECT id FROM branches WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())))
    OR to_branch_id IN (SELECT id FROM branches WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())))
  );

-- =============================================================================
-- 20. AUDIT_LOGS
-- =============================================================================
DROP POLICY IF EXISTS "Audit logs select" ON audit_logs;
DROP POLICY IF EXISTS "Audit logs select by org" ON audit_logs;
CREATE POLICY "Audit logs select by org" ON audit_logs FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('admin', 'manager'))
  );

-- =============================================================================
-- 21. USER_PROFILES
-- =============================================================================
DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users view own profile" ON user_profiles FOR SELECT
  USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Users insert profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users insert profile" ON user_profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users update profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users update profile" ON user_profiles FOR UPDATE
  USING ((SELECT auth.uid()) = user_id OR user_id IS NULL OR public.is_admin((SELECT auth.uid())));

-- =============================================================================
-- 22. USER_PERMISSIONS
-- =============================================================================
DROP POLICY IF EXISTS "User permissions select" ON user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
CREATE POLICY "User permissions select" ON user_permissions FOR SELECT
  USING ((SELECT auth.uid()) = user_id OR public.is_admin((SELECT auth.uid())));

-- =============================================================================
-- 23. RBAC_AUDIT_LOG
-- =============================================================================
DROP POLICY IF EXISTS "RBAC audit select" ON rbac_audit_log;
CREATE POLICY "RBAC audit select" ON rbac_audit_log FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));
