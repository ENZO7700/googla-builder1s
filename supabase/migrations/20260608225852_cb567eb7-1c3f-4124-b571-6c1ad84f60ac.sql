
-- chat_messages
DROP POLICY IF EXISTS "No updates on chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
CREATE POLICY "No updates on chat messages" ON public.chat_messages FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Users can create own messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND (session_id IN (SELECT chat_sessions.id FROM chat_sessions WHERE chat_sessions.user_id = auth.uid())));
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- chat_sessions
DROP POLICY IF EXISTS "Users can create own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.chat_sessions;
CREATE POLICY "Users can create own sessions" ON public.chat_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.chat_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.chat_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own sessions" ON public.chat_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- wp_about / wp_company_info / wp_footer / wp_header / wp_inquiry_forms / wp_members / wp_news / wp_references / wp_services
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wp_about','wp_company_info','wp_footer','wp_header','wp_inquiry_forms','wp_members','wp_news','wp_references','wp_services'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "owner all" ON public.%I FOR ALL TO authenticated USING (is_wp_site_owner(site_id)) WITH CHECK (is_wp_site_owner(site_id))', t);
  END LOOP;
END $$;

-- wp_audit_log
DROP POLICY IF EXISTS "Users can view audit logs for their sites" ON public.wp_audit_log;
CREATE POLICY "Users can view audit logs for their sites" ON public.wp_audit_log FOR SELECT TO authenticated
  USING (site_id IN (SELECT wp_sites.id FROM wp_sites WHERE wp_sites.user_id = auth.uid()));

-- wp_inquiries owner policies
DROP POLICY IF EXISTS "owner delete" ON public.wp_inquiries;
DROP POLICY IF EXISTS "owner select" ON public.wp_inquiries;
DROP POLICY IF EXISTS "owner update" ON public.wp_inquiries;
CREATE POLICY "owner delete" ON public.wp_inquiries FOR DELETE TO authenticated USING (is_wp_site_owner(site_id));
CREATE POLICY "owner select" ON public.wp_inquiries FOR SELECT TO authenticated USING (is_wp_site_owner(site_id));
CREATE POLICY "owner update" ON public.wp_inquiries FOR UPDATE TO authenticated USING (is_wp_site_owner(site_id)) WITH CHECK (is_wp_site_owner(site_id));
