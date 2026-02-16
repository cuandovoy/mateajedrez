-- Migration: 037_update_rls_multi_tenant.sql
-- Fase 1: Actualizar RLS para multi-tenant usando organization_id y organization_members
-- Requiere: 036_add_organization_id_part2.sql

-- ============================================
-- 1. FUNCIÓN: Usuario tiene permiso en organización
-- ============================================
CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN roles r ON r.key = om.role
    JOIN roles_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE om.user_id = auth.uid()
    AND om.organization_id = p_org_id
    AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 2. RPC PÚBLICO: Obtener org por slug (para store frontend)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_org_by_slug(p_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, logo_url TEXT, primary_color TEXT)
AS $$
  SELECT o.id, o.name::TEXT, o.slug::TEXT, o.logo_url::TEXT, o.primary_color::TEXT
  FROM organizations o
  WHERE o.slug = p_slug AND o.subscription_status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 3. RPC PÚBLICO: Productos activos por org (store sin auth)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_public_products(p_org_id UUID)
RETURNS SETOF products
AS $$
  SELECT * FROM products
  WHERE organization_id = p_org_id AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 4. RPC PÚBLICO: Categorías por org (store sin auth)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_public_categories(p_org_id UUID)
RETURNS SETOF categories
AS $$
  SELECT * FROM categories WHERE organization_id = p_org_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 5. CATEGORIES - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Categories are insertable by admins" ON categories;
DROP POLICY IF EXISTS "Categories are updatable by admins" ON categories;
DROP POLICY IF EXISTS "Categories are deletable by admins" ON categories;

CREATE POLICY "Categories select by org member"
  ON categories FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Categories insert by org admin"
  ON categories FOR INSERT
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Categories update by org admin"
  ON categories FOR UPDATE
  USING (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Categories delete by org admin"
  ON categories FOR DELETE
  USING (public.is_org_admin_or_manager(organization_id));

-- ============================================
-- 6. PRODUCTS - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Products are insertable by admins" ON products;
DROP POLICY IF EXISTS "Products are updatable by admins" ON products;
DROP POLICY IF EXISTS "Products are deletable by admins" ON products;

CREATE POLICY "Products select by org member or public"
  ON products FOR SELECT
  USING (
    is_active = true
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Products insert by org admin"
  ON products FOR INSERT
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Products update by org admin"
  ON products FOR UPDATE
  USING (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Products delete by org admin"
  ON products FOR DELETE
  USING (public.is_org_admin_or_manager(organization_id));

-- ============================================
-- 7. CART_ITEMS - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

CREATE POLICY "Cart items select own in org"
  ON cart_items FOR SELECT
  USING (
    auth.uid() = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Cart items insert own in org"
  ON cart_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Cart items update own in org"
  ON cart_items FOR UPDATE
  USING (
    auth.uid() = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Cart items delete own in org"
  ON cart_items FOR DELETE
  USING (
    auth.uid() = user_id
    AND organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 8. ORDERS - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders, guest orders, or admins can view all" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders or guest orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;

CREATE POLICY "Orders select own or org admin or guest"
  ON orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Orders insert own or org member or guest"
  ON orders FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Orders update own or org admin"
  ON orders FOR UPDATE
  USING (
    auth.uid() = user_id
    OR organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================
-- 9. ORDER_ITEMS - Hereda de orders (ya tiene org en orders)
-- ============================================
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can view order items from own orders, guest orders, or admins can view all" ON order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert order items for own orders or guest orders" ON order_items;

CREATE POLICY "Order items select via orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR o.user_id IS NULL
        OR o.organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
      )
    )
  );

CREATE POLICY "Order items insert via orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR o.user_id IS NULL OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
    )
  );

-- ============================================
-- 10. SUPPLIERS - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS "Suppliers are viewable by everyone" ON suppliers;
DROP POLICY IF EXISTS "Suppliers are insertable by admins" ON suppliers;
DROP POLICY IF EXISTS "Suppliers are updatable by admins" ON suppliers;
DROP POLICY IF EXISTS "Suppliers are deletable by admins" ON suppliers;

CREATE POLICY "Suppliers select by org member"
  ON suppliers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Suppliers insert by org admin"
  ON suppliers FOR INSERT
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Suppliers update by org admin"
  ON suppliers FOR UPDATE
  USING (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Suppliers delete by org admin"
  ON suppliers FOR DELETE
  USING (public.is_org_admin_or_manager(organization_id));

-- ============================================
-- 11. BRANCHES - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS "Branches are viewable by everyone" ON branches;
DROP POLICY IF EXISTS "Branches are insertable by admins" ON branches;
DROP POLICY IF EXISTS "Branches are updatable by admins" ON branches;
DROP POLICY IF EXISTS "Branches are deletable by admins" ON branches;

CREATE POLICY "Branches select by org member"
  ON branches FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Branches insert by org admin"
  ON branches FOR INSERT
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Branches update by org admin"
  ON branches FOR UPDATE
  USING (public.is_org_admin_or_manager(organization_id));

CREATE POLICY "Branches delete by org admin"
  ON branches FOR DELETE
  USING (public.is_org_admin_or_manager(organization_id));

-- ============================================
-- 12. CUSTOMERS - Políticas multi-tenant
-- ============================================
DROP POLICY IF EXISTS customers_select_own ON customers;
DROP POLICY IF EXISTS customers_select_admin ON customers;
DROP POLICY IF EXISTS customers_insert_admin ON customers;
DROP POLICY IF EXISTS customers_insert_guest ON customers;
DROP POLICY IF EXISTS customers_update_admin ON customers;
DROP POLICY IF EXISTS customers_delete_admin ON customers;

CREATE POLICY "Customers select own or org admin"
  ON customers FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND (public.has_org_permission(organization_id, 'customers:view') OR public.is_org_admin(organization_id))
    )
  );

CREATE POLICY "Customers insert org admin or guest"
  ON customers FOR INSERT
  WITH CHECK (
    (user_id IS NULL AND full_name IS NOT NULL AND phone IS NOT NULL)
    OR public.is_org_admin_or_manager(organization_id)
    OR public.has_org_permission(organization_id, 'customers:create')
  );

CREATE POLICY "Customers update org admin"
  ON customers FOR UPDATE
  USING (
    public.is_org_admin_or_manager(organization_id)
    OR public.has_org_permission(organization_id, 'customers:edit')
  );

CREATE POLICY "Customers delete org admin"
  ON customers FOR DELETE
  USING (
    public.is_org_admin_or_manager(organization_id)
    OR public.has_org_permission(organization_id, 'customers:delete')
  );

-- ============================================
-- 13. PRODUCT_SUPPLIERS - Via product (product->organization_id)
-- ============================================
DROP POLICY IF EXISTS "Product suppliers are viewable by everyone" ON product_suppliers;
DROP POLICY IF EXISTS "Product suppliers are insertable by admins" ON product_suppliers;
DROP POLICY IF EXISTS "Product suppliers are updatable by admins" ON product_suppliers;
DROP POLICY IF EXISTS "Product suppliers are deletable by admins" ON product_suppliers;

CREATE POLICY "Product suppliers select by product org"
  ON product_suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Product suppliers insert by product org admin"
  ON product_suppliers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

CREATE POLICY "Product suppliers update by product org admin"
  ON product_suppliers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

CREATE POLICY "Product suppliers delete by product org admin"
  ON product_suppliers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

-- ============================================
-- 14. BRANCH_INVENTORY - Via branch
-- ============================================
DROP POLICY IF EXISTS "Branch inventory is viewable by admins" ON branch_inventory;
DROP POLICY IF EXISTS "Branch inventory is insertable by admins" ON branch_inventory;
DROP POLICY IF EXISTS "Branch inventory is updatable by admins" ON branch_inventory;
DROP POLICY IF EXISTS "Branch inventory is deletable by admins" ON branch_inventory;

CREATE POLICY "Branch inventory select by branch org"
  ON branch_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_inventory.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Branch inventory insert by branch org admin"
  ON branch_inventory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_inventory.branch_id
      AND public.is_org_admin_or_manager(b.organization_id)
    )
  );

CREATE POLICY "Branch inventory update by branch org admin"
  ON branch_inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_inventory.branch_id
      AND public.is_org_admin_or_manager(b.organization_id)
    )
  );

CREATE POLICY "Branch inventory delete by branch org admin"
  ON branch_inventory FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = branch_inventory.branch_id
      AND public.is_org_admin_or_manager(b.organization_id)
    )
  );

-- ============================================
-- 15. CASH_SESSIONS - Via branch
-- ============================================
DROP POLICY IF EXISTS "Cash sessions are viewable by admins" ON cash_sessions;
DROP POLICY IF EXISTS "Cash sessions are insertable by admins" ON cash_sessions;
DROP POLICY IF EXISTS "Cash sessions are updatable by admins" ON cash_sessions;
DROP POLICY IF EXISTS "Cash sessions are deletable by admins" ON cash_sessions;

CREATE POLICY "Cash sessions select by branch org"
  ON cash_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = cash_sessions.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Cash sessions insert by branch org"
  ON cash_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = cash_sessions.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      AND (public.has_org_permission(b.organization_id, 'cash_register:access') OR public.is_org_admin_or_manager(b.organization_id))
    )
  );

CREATE POLICY "Cash sessions update by branch org"
  ON cash_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = cash_sessions.branch_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- 16. ORDER_PAYMENTS - Via order
-- ============================================
DROP POLICY IF EXISTS "Order payments are viewable by order owner or admins" ON order_payments;
DROP POLICY IF EXISTS "Order payments are insertable by admins" ON order_payments;
DROP POLICY IF EXISTS "Order payments are updatable by admins" ON order_payments;
DROP POLICY IF EXISTS "Order payments are deletable by admins" ON order_payments;

CREATE POLICY "Order payments select via order"
  ON order_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
      AND (
        o.user_id = auth.uid()
        OR o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Order payments insert via order"
  ON order_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_payments.order_id
      AND o.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- 17. INVENTORY_MOVEMENTS - Via branch_inventory->branch
-- ============================================
DROP POLICY IF EXISTS "Admins can view all inventory movements" ON inventory_movements;
DROP POLICY IF EXISTS "System can insert inventory movements" ON inventory_movements;

CREATE POLICY "Inventory movements select by org"
  ON inventory_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branch_inventory bi
      JOIN branches b ON b.id = bi.branch_id
      WHERE bi.id = inventory_movements.branch_inventory_id
      AND b.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Inventory movements insert by org"
  ON inventory_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM branch_inventory bi
      JOIN branches b ON b.id = bi.branch_id
      WHERE bi.id = inventory_movements.branch_inventory_id
      AND public.is_org_admin_or_manager(b.organization_id)
    )
  );

-- ============================================
-- 18. INVENTORY_TRANSFERS - Via branches
-- ============================================
DROP POLICY IF EXISTS "Admins can view all inventory transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "Admins can insert inventory transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "Admins can update inventory transfers" ON inventory_transfers;

CREATE POLICY "Inventory transfers select by org"
  ON inventory_transfers FOR SELECT
  USING (
    from_branch_id IN (SELECT id FROM branches WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
    OR to_branch_id IN (SELECT id FROM branches WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Inventory transfers insert by org"
  ON inventory_transfers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = inventory_transfers.from_branch_id
      AND public.is_org_admin_or_manager(b.organization_id)
    )
  );

CREATE POLICY "Inventory transfers update by org"
  ON inventory_transfers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = inventory_transfers.from_branch_id
      AND public.is_org_admin_or_manager(b.organization_id)
    )
  );

-- ============================================
-- 19. AUDIT_LOGS - Por organization_id (nullable)
-- ============================================
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Audit logs select by org"
  ON audit_logs FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- ============================================
-- 20. PRODUCT_VARIANTS, PRODUCT_IMAGES, PRODUCT_BARCODES - Via product
-- ============================================
DROP POLICY IF EXISTS "Variants are viewable by everyone" ON product_variants;
DROP POLICY IF EXISTS "Admins can view all variants" ON product_variants;
DROP POLICY IF EXISTS "Variants are insertable by admins" ON product_variants;
DROP POLICY IF EXISTS "Variants are updatable by admins" ON product_variants;
DROP POLICY IF EXISTS "Variants are deletable by admins" ON product_variants;

CREATE POLICY "Product variants select by product org"
  ON product_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND (p.is_active = true OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Product variants insert by product org admin"
  ON product_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

CREATE POLICY "Product variants update by product org admin"
  ON product_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

CREATE POLICY "Product variants delete by product org admin"
  ON product_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

-- Product images
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON product_images;
DROP POLICY IF EXISTS "Product images are insertable by admins" ON product_images;
DROP POLICY IF EXISTS "Product images are updatable by admins" ON product_images;
DROP POLICY IF EXISTS "Product images are deletable by admins" ON product_images;

CREATE POLICY "Product images select by product org"
  ON product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND (p.is_active = true OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Product images insert by product org admin"
  ON product_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

CREATE POLICY "Product images update by product org admin"
  ON product_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

CREATE POLICY "Product images delete by product org admin"
  ON product_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_images.product_id
      AND public.is_org_admin_or_manager(p.organization_id)
    )
  );

-- Product barcodes
DROP POLICY IF EXISTS "Product barcodes are viewable by everyone" ON product_barcodes;
DROP POLICY IF EXISTS "Product barcodes are insertable by admins" ON product_barcodes;
DROP POLICY IF EXISTS "Product barcodes are updatable by admins" ON product_barcodes;
DROP POLICY IF EXISTS "Product barcodes are deletable by admins" ON product_barcodes;

CREATE POLICY "Product barcodes select by product org"
  ON product_barcodes FOR SELECT
  USING (
    COALESCE(
      (SELECT p.organization_id FROM products p WHERE p.id = product_barcodes.product_id),
      (SELECT p.organization_id FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id)
    ) IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Product barcodes insert by product org admin"
  ON product_barcodes FOR INSERT
  WITH CHECK (
    (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_barcodes.product_id AND public.is_org_admin_or_manager(p.organization_id)))
    OR (variant_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id AND public.is_org_admin_or_manager(p.organization_id)))
  );

CREATE POLICY "Product barcodes update by product org admin"
  ON product_barcodes FOR UPDATE
  USING (
    (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_barcodes.product_id AND public.is_org_admin_or_manager(p.organization_id)))
    OR (variant_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id AND public.is_org_admin_or_manager(p.organization_id)))
  );

CREATE POLICY "Product barcodes delete by product org admin"
  ON product_barcodes FOR DELETE
  USING (
    (product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_barcodes.product_id AND public.is_org_admin_or_manager(p.organization_id)))
    OR (variant_id IS NOT NULL AND EXISTS (SELECT 1 FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = product_barcodes.variant_id AND public.is_org_admin_or_manager(p.organization_id)))
  );
