-- Tighten chat_messages INSERT to verify session ownership
DROP POLICY IF EXISTS "Users can create own messages" ON public.chat_messages;
CREATE POLICY "Users can create own messages"
ON public.chat_messages
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id
  AND session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
);

-- Explicitly deny UPDATE on chat_messages (immutable history)
DROP POLICY IF EXISTS "No updates on chat messages" ON public.chat_messages;
CREATE POLICY "No updates on chat messages"
ON public.chat_messages
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

-- Storage: restrict UPDATE on chat-attachments to owner folder
DROP POLICY IF EXISTS "Users can update own chat attachments" ON storage.objects;
CREATE POLICY "Users can update own chat attachments"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
