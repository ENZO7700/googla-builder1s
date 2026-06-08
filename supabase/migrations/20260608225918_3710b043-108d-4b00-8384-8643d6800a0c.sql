
-- chat attachments update
DROP POLICY IF EXISTS "Users can update own chat attachments" ON storage.objects;
CREATE POLICY "Users can update own chat attachments" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- inquiry attachments owner read/delete (rely on public.is_wp_site_owner)
DROP POLICY IF EXISTS "inquiry attachments owner read" ON storage.objects;
DROP POLICY IF EXISTS "inquiry attachments owner delete" ON storage.objects;
CREATE POLICY "inquiry attachments owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inquiry-attachments' AND public.is_wp_site_owner(((storage.foldername(name))[1])::uuid));
CREATE POLICY "inquiry attachments owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'inquiry-attachments' AND public.is_wp_site_owner(((storage.foldername(name))[1])::uuid));

-- wp images bucket policies (public read still served by bucket-level public flag; owner-only writes)
DROP POLICY IF EXISTS "wp images owner list" ON storage.objects;
DROP POLICY IF EXISTS "wp images user delete" ON storage.objects;
DROP POLICY IF EXISTS "wp images user update" ON storage.objects;
DROP POLICY IF EXISTS "wp images user upload" ON storage.objects;
CREATE POLICY "wp images owner list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wp images user upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wp images user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wp images user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);
