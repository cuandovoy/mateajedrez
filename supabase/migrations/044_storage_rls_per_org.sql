-- Storage RLS por organización: admins y managers pueden subir/editar/eliminar
-- imágenes solo de su organización. Path: {orgId}/{filename}

CREATE OR REPLACE FUNCTION public.can_manage_storage_object(p_bucket_id TEXT, p_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Path con prefijo org: orgId/filename
  IF position('/' IN p_path) > 0 THEN
    BEGIN
      v_org_id := (split_part(p_path, '/', 1))::UUID;
      RETURN public.is_org_admin_or_manager(v_org_id);
    EXCEPTION WHEN OTHERS THEN
      -- Path mal formado, fallback a is_admin
      RETURN EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      );
    END;
  ELSE
    -- Path legacy sin org (ej: filename.jpg) - solo admins
    RETURN EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    );
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Product images
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

CREATE POLICY "Org admins/managers upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND public.can_manage_storage_object(bucket_id, name)
  );

CREATE POLICY "Org admins/managers update product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images' AND public.can_manage_storage_object(bucket_id, name)
  );

CREATE POLICY "Org admins/managers delete product images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images' AND public.can_manage_storage_object(bucket_id, name)
  );

-- Category images
DROP POLICY IF EXISTS "Admins upload category images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload category images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update category images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete category images" ON storage.objects;

CREATE POLICY "Org admins/managers upload category images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'category-images' AND public.can_manage_storage_object(bucket_id, name)
  );

CREATE POLICY "Org admins/managers update category images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'category-images' AND public.can_manage_storage_object(bucket_id, name)
  );

CREATE POLICY "Org admins/managers delete category images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'category-images' AND public.can_manage_storage_object(bucket_id, name)
  );
