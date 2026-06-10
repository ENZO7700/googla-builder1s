
CREATE TABLE public.wp_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  base_url TEXT NOT NULL,
  site_type TEXT NOT NULL CHECK (site_type IN ('com', 'self')),
  username TEXT,
  app_password_encrypted TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, base_url)
);

ALTER TABLE public.wp_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own WP sites"
  ON public.wp_sites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own WP sites"
  ON public.wp_sites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own WP sites"
  ON public.wp_sites FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own WP sites"
  ON public.wp_sites FOR DELETE
  USING (user_id = auth.uid());

CREATE TABLE public.wp_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  status TEXT CHECK (status IN ('success', 'error', 'pending')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their sites"
  ON public.wp_audit_log FOR SELECT
  USING (site_id IN (SELECT id FROM public.wp_sites WHERE user_id = auth.uid()));

CREATE INDEX idx_wp_sites_user_id ON public.wp_sites(user_id);
CREATE INDEX idx_wp_audit_log_site_id ON public.wp_audit_log(site_id);
CREATE INDEX idx_wp_audit_log_created ON public.wp_audit_log(created_at DESC);
