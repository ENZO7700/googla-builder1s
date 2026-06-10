
-- Switch ownership helper to SECURITY INVOKER (relies on RLS of wp_sites)
CREATE OR REPLACE FUNCTION public.is_wp_site_owner(_site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wp_sites
    WHERE id = _site_id AND user_id = auth.uid()
  );
$$;

-- Restrict bucket listing to file owner; direct public URL reads still work
DROP POLICY IF EXISTS "wp images public read" ON storage.objects;
CREATE POLICY "wp images owner list"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'wp-content-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
