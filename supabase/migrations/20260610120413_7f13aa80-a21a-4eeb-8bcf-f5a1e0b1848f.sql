-- Restrict storage policies to authenticated role only (not anon)
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "inquiry attachments owner delete" ON storage.objects;
DROP POLICY IF EXISTS "inquiry attachments owner read" ON storage.objects;
DROP POLICY IF EXISTS "wp images owner list" ON storage.objects;
DROP POLICY IF EXISTS "wp images user delete" ON storage.objects;
DROP POLICY IF EXISTS "wp images user update" ON storage.objects;

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own chat attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "inquiry attachments owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inquiry-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "inquiry attachments owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inquiry-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "wp images owner list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "wp images user update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "wp images user delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wp-content-images' AND auth.uid()::text = (storage.foldername(name))[1]);