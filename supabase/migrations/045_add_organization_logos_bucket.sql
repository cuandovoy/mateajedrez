-- Bucket para logos de organizaciones. Path: {orgId}/filename

INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT: público (logos visibles en tienda)
CREATE POLICY "Organization logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'organization-logos');

-- INSERT/UPDATE/DELETE: solo admins de la org (path = orgId/filename)
CREATE POLICY "Org admins upload logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'organization-logos' AND public.can_manage_storage_object(bucket_id, name)
  );

CREATE POLICY "Org admins update logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'organization-logos' AND public.can_manage_storage_object(bucket_id, name)
  );

CREATE POLICY "Org admins delete logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'organization-logos' AND public.can_manage_storage_object(bucket_id, name)
  );
