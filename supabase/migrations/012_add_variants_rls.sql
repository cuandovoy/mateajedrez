-- Add Row Level Security policies for product_variants
-- This migration adds RLS policies to secure the product_variants table

-- Enable RLS on product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active variants
CREATE POLICY "Variants are viewable by everyone"
  ON product_variants FOR SELECT
  USING (is_active = true);

-- Policy: Admins can view all variants (including inactive)
CREATE POLICY "Admins can view all variants"
  ON product_variants FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Policy: Admins can insert variants
CREATE POLICY "Variants are insertable by admins"
  ON product_variants FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update variants
CREATE POLICY "Variants are updatable by admins"
  ON product_variants FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can delete variants
CREATE POLICY "Variants are deletable by admins"
  ON product_variants FOR DELETE
  USING (public.is_admin(auth.uid()));
