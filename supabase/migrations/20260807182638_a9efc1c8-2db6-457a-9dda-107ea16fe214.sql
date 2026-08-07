CREATE TABLE public.wp_agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  correlation_id text NOT NULL,
  prompt text,
  status text NOT NULL DEFAULT 'running',
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_json jsonb,
  error text,
  finished_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wp_agent_runs TO authenticated;
GRANT ALL ON public.wp_agent_runs TO service_role;

ALTER TABLE public.wp_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own agent runs select" ON public.wp_agent_runs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own agent runs insert" ON public.wp_agent_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_wp_site_owner(site_id));
CREATE POLICY "own agent runs update" ON public.wp_agent_runs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own agent runs delete" ON public.wp_agent_runs FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_wp_agent_runs_updated BEFORE UPDATE ON public.wp_agent_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wp_agent_runs_site_created ON public.wp_agent_runs (site_id, created_at DESC);