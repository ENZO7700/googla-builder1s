
CREATE TABLE public.wp_action_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('rest','cli')),
  target text NOT NULL,
  before_json jsonb,
  planned_patch jsonb,
  planned_call jsonb NOT NULL,
  risk text NOT NULL DEFAULT 'medium' CHECK (risk IN ('low','medium','high')),
  proceed_token text NOT NULL UNIQUE,
  token_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','applied','rolled_back','failed','expired','cancelled')),
  applied_at timestamptz,
  rolled_back_at timestamptz,
  result_json jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wp_action_snapshots TO authenticated;
GRANT ALL ON public.wp_action_snapshots TO service_role;
ALTER TABLE public.wp_action_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots select" ON public.wp_action_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own snapshots insert" ON public.wp_action_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_wp_site_owner(site_id));
CREATE POLICY "own snapshots update" ON public.wp_action_snapshots FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_wp_action_snapshots_updated BEFORE UPDATE ON public.wp_action_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_action_snapshots_site ON public.wp_action_snapshots(site_id, created_at DESC);
CREATE INDEX idx_wp_action_snapshots_token ON public.wp_action_snapshots(proceed_token);

CREATE TABLE public.wp_readiness_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score int,
  breakdown jsonb,
  pdf_path text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wp_readiness_runs TO authenticated;
GRANT ALL ON public.wp_readiness_runs TO service_role;
ALTER TABLE public.wp_readiness_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own readiness select" ON public.wp_readiness_runs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own readiness insert" ON public.wp_readiness_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_wp_site_owner(site_id));
CREATE POLICY "own readiness update" ON public.wp_readiness_runs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_wp_readiness_runs_updated BEFORE UPDATE ON public.wp_readiness_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_readiness_runs_site ON public.wp_readiness_runs(site_id, started_at DESC);
