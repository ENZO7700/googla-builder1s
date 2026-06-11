-- Migrácia: Pridanie webhook_secret do wp_sites
ALTER TABLE public.wp_sites
  ADD COLUMN IF NOT EXISTS webhook_secret UUID DEFAULT gen_random_uuid() NOT NULL;

-- Index pre rýchle overovanie webhookov
CREATE INDEX IF NOT EXISTS idx_wp_sites_webhook ON public.wp_sites(id, webhook_secret);
