-- Allow guest orders (orders without user_id)
-- This migration enables anonymous users to create orders

-- First, allow user_id to be NULL in orders table
ALTER TABLE orders 
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Re-add foreign key constraint but allow NULL
ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Drop existing INSERT policy for orders
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

-- Create new INSERT policy that allows:
-- 1. Authenticated users to insert orders with their own user_id
-- 2. Anyone (including guests) to insert orders with user_id = NULL
CREATE POLICY "Users can insert own orders or guest orders"
  ON orders FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
  );

-- Update SELECT policy to allow viewing:
-- 1. Own orders (for authenticated users)
-- 2. Orders with user_id = NULL (guest orders can be viewed by anyone who knows the order ID)
-- 3. All orders (for admins)
DROP POLICY IF EXISTS "Users can view own orders" ON orders;

CREATE POLICY "Users can view own orders, guest orders, or admins can view all"
  ON orders FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR public.is_admin(auth.uid())
  );

-- Update order_items INSERT policy to allow inserting items for guest orders
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;

CREATE POLICY "Users can insert order items for own orders or guest orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.user_id = auth.uid()
        OR orders.user_id IS NULL
      )
    )
  );

-- Update order_items SELECT policy to allow viewing items from guest orders
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

CREATE POLICY "Users can view order items from own orders, guest orders, or admins can view all"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.user_id = auth.uid()
        OR orders.user_id IS NULL
        OR public.is_admin(auth.uid())
      )
    )
  );
