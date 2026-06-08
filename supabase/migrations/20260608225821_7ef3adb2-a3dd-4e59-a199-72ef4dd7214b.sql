
-- 1) Restrict wp_sites policies to authenticated role (no anon)
DROP POLICY IF EXISTS "Users can view their own WP sites" ON public.wp_sites;
DROP POLICY IF EXISTS "Users can insert their own WP sites" ON public.wp_sites;
DROP POLICY IF EXISTS "Users can update their own WP sites" ON public.wp_sites;
DROP POLICY IF EXISTS "Users can delete their own WP sites" ON public.wp_sites;

CREATE POLICY "Users can view their own WP sites"
  ON public.wp_sites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own WP sites"
  ON public.wp_sites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own WP sites"
  ON public.wp_sites FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own WP sites"
  ON public.wp_sites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2) Explicit deny for direct INSERT/UPDATE/DELETE on wp_audit_log
-- (service_role bypasses RLS, so server-side writes still work)
CREATE POLICY "Block direct inserts to audit log"
  ON public.wp_audit_log FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "Block direct updates to audit log"
  ON public.wp_audit_log FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "Block direct deletes from audit log"
  ON public.wp_audit_log FOR DELETE TO authenticated, anon
  USING (false);

-- 3) Explicit block for direct INSERT to wp_inquiries
-- (inquiries-submit edge function uses service role to bypass)
CREATE POLICY "Block direct inquiry inserts"
  ON public.wp_inquiries FOR INSERT TO authenticated, anon
  WITH CHECK (false);

-- 4) Storage: explicit deny for direct uploads to inquiry-attachments
-- (uploads go through inquiries-submit edge function via service role)
CREATE POLICY "Block direct uploads to inquiry attachments"
  ON storage.objects FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id <> 'inquiry-attachments');
