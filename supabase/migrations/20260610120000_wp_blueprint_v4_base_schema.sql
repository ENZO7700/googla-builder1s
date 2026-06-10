
-- ============= wpBOX Data Blueprint v4.0 — BASE SCHEMA (Phase 1) =============
-- Ordering: wp_service_categories before wp_services.category_id and wp_faq.category_id FKs

-- ============= NEW: service categories =============

CREATE TABLE public.wp_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
  wp_term_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);
ALTER TABLE public.wp_service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_service_categories FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_service_categories_updated BEFORE UPDATE ON public.wp_service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_service_categories_site ON public.wp_service_categories(site_id, order_index);
CREATE INDEX idx_wp_service_categories_sync ON public.wp_service_categories(site_id, sync_status);

-- ============= ALTER: wp_services (category_id requires wp_service_categories) =============

ALTER TABLE public.wp_services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.wp_service_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS wp_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wp_services_sync_status_check'
      AND conrelid = 'public.wp_services'::regclass
  ) THEN
    ALTER TABLE public.wp_services
      ADD CONSTRAINT wp_services_sync_status_check
      CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wp_services_category ON public.wp_services(site_id, category_id);
CREATE INDEX IF NOT EXISTS idx_wp_services_sync ON public.wp_services(site_id, sync_status);

-- ============= NEW: FAQ =============

CREATE TABLE public.wp_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  category_id uuid REFERENCES public.wp_service_categories(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
  wp_post_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_faq FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_faq_updated BEFORE UPDATE ON public.wp_faq
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_faq_site ON public.wp_faq(site_id, order_index);
CREATE INDEX idx_wp_faq_sync ON public.wp_faq(site_id, sync_status);

-- ============= NEW: galleries =============

CREATE TABLE public.wp_galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT true,
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_galleries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_galleries FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_galleries_updated BEFORE UPDATE ON public.wp_galleries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_galleries_site ON public.wp_galleries(site_id, order_index);
CREATE INDEX idx_wp_galleries_sync ON public.wp_galleries(site_id, sync_status);

-- ============= NEW: sync outbox =============

CREATE TABLE public.wp_sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  entity text NOT NULL,
  record_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload jsonb NOT NULL,
  idempotency_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_sync_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_sync_outbox FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE INDEX idx_wp_sync_outbox_site ON public.wp_sync_outbox(site_id);
CREATE INDEX idx_wp_sync_outbox_status ON public.wp_sync_outbox(site_id, status, next_retry_at);

-- ============= NEW: blueprint instances =============

CREATE TABLE public.wp_blueprint_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  blueprint_id text NOT NULL,
  blueprint_version text NOT NULL DEFAULT '4.0',
  enabled_entities text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_blueprint_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_blueprint_instances FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_blueprint_instances_updated BEFORE UPDATE ON public.wp_blueprint_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_blueprint_instances_blueprint ON public.wp_blueprint_instances(blueprint_id);

-- ============= ALTER: existing content tables =============

ALTER TABLE public.wp_news
  ADD COLUMN IF NOT EXISTS author_member_id uuid REFERENCES public.wp_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_wp_news_author ON public.wp_news(site_id, author_member_id);
CREATE INDEX IF NOT EXISTS idx_wp_news_featured ON public.wp_news(site_id, featured) WHERE featured = true;

ALTER TABLE public.wp_members
  ADD COLUMN IF NOT EXISTS position text CHECK (position IN ('founder', 'ceo', 'manager', 'employee', 'other')),
  ADD COLUMN IF NOT EXISTS social jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_wp_members_position ON public.wp_members(site_id, position);

ALTER TABLE public.wp_header
  ADD COLUMN IF NOT EXISTS cta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.wp_footer
  ADD COLUMN IF NOT EXISTS social jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.wp_references
  ADD COLUMN IF NOT EXISTS logo_alt text,
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_wp_references_featured ON public.wp_references(site_id, featured) WHERE featured = true;

ALTER TABLE public.wp_company_info
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.wp_about
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS wp_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wp_about_sync_status_check'
      AND conrelid = 'public.wp_about'::regclass
  ) THEN
    ALTER TABLE public.wp_about
      ADD CONSTRAINT wp_about_sync_status_check
      CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wp_about_sync ON public.wp_about(site_id, sync_status);
