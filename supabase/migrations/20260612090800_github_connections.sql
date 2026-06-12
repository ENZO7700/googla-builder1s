-- Migration: 20260612090800_github_connections
-- Vytvorenie tabuliek pre prepojenie s GitHub a auditovanie github aktivít

CREATE TABLE IF NOT EXISTS public.github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  token_encrypted TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own GitHub connection"
  ON public.github_connections FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own GitHub connection"
  ON public.github_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own GitHub connection"
  ON public.github_connections FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own GitHub connection"
  ON public.github_connections FOR DELETE
  USING (user_id = auth.uid());

-- Audit log tabuľka
CREATE TABLE IF NOT EXISTS public.github_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT NOT NULL,
  target TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error', 'info')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.github_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own github audit logs"
  ON public.github_audit_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own github audit logs"
  ON public.github_audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_github_connections_user ON public.github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_github_audit_log_user ON public.github_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_github_audit_log_created ON public.github_audit_log(created_at DESC);
