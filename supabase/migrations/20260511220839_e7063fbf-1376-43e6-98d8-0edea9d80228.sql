
-- ============= helper trigger =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============= owner check helper =============
CREATE OR REPLACE FUNCTION public.is_wp_site_owner(_site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wp_sites
    WHERE id = _site_id AND user_id = auth.uid()
  );
$$;

-- ============= STATIC SINGLETONS =============

CREATE TABLE public.wp_company_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  name text,
  tagline text,
  description text,
  email text,
  phone text,
  address text,
  vat_id text,
  logo_url text,
  cover_url text,
  social jsonb NOT NULL DEFAULT '{}'::jsonb,
  wp_post_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_company_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_company_info FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_company_info_updated BEFORE UPDATE ON public.wp_company_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wp_about (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  title text,
  subtitle text,
  content_html text,
  image_url text,
  wp_post_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_about ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_about FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_about_updated BEFORE UPDATE ON public.wp_about
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wp_header (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  logo_url text,
  menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_label text,
  cta_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_header ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_header FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_header_updated BEFORE UPDATE ON public.wp_header
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wp_footer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  logo_url text,
  copyright text,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_footer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_footer FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_footer_updated BEFORE UPDATE ON public.wp_footer
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= DYNAMIC REPEATERS =============

CREATE TABLE public.wp_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text,
  excerpt text,
  description_html text,
  icon text,
  image_url text,
  price text,
  link_url text,
  order_index integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  wp_post_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_services FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_services_updated BEFORE UPDATE ON public.wp_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_services_site ON public.wp_services(site_id, order_index);

CREATE TABLE public.wp_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  client_name text,
  project_title text NOT NULL,
  description_html text,
  image_url text,
  link_url text,
  completed_at date,
  order_index integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  wp_post_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_references FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_references_updated BEFORE UPDATE ON public.wp_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_references_site ON public.wp_references(site_id, order_index);

CREATE TABLE public.wp_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text,
  excerpt text,
  content_html text,
  cover_url text,
  published_at timestamptz,
  order_index integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  wp_post_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_news FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_news_updated BEFORE UPDATE ON public.wp_news
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_news_site ON public.wp_news(site_id, order_index);

CREATE TABLE public.wp_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  bio text,
  photo_url text,
  email text,
  link_url text,
  order_index integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_members FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_members_updated BEFORE UPDATE ON public.wp_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_members_site ON public.wp_members(site_id, order_index);

-- ============= INQUIRIES =============

CREATE TABLE public.wp_inquiry_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_email text,
  success_message text DEFAULT 'Ďakujeme, ozveme sa.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);
ALTER TABLE public.wp_inquiry_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.wp_inquiry_forms FOR ALL
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE TRIGGER trg_wp_inquiry_forms_updated BEFORE UPDATE ON public.wp_inquiry_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wp_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.wp_sites(id) ON DELETE CASCADE,
  form_slug text NOT NULL DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  email text,
  name text,
  phone text,
  message text,
  source_url text,
  ip_hash text,
  user_agent text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wp_inquiries ENABLE ROW LEVEL SECURITY;
-- Owner can read/update/delete; INSERTs go through edge function (service role bypasses RLS)
CREATE POLICY "owner select" ON public.wp_inquiries FOR SELECT
  USING (public.is_wp_site_owner(site_id));
CREATE POLICY "owner update" ON public.wp_inquiries FOR UPDATE
  USING (public.is_wp_site_owner(site_id))
  WITH CHECK (public.is_wp_site_owner(site_id));
CREATE POLICY "owner delete" ON public.wp_inquiries FOR DELETE
  USING (public.is_wp_site_owner(site_id));
CREATE INDEX idx_wp_inquiries_site_created ON public.wp_inquiries(site_id, created_at DESC);

-- ============= STORAGE =============

INSERT INTO storage.buckets (id, name, public)
VALUES ('wp-content-images', 'wp-content-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "wp images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wp-content-images');

CREATE POLICY "wp images user upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'wp-content-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "wp images user update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'wp-content-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "wp images user delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'wp-content-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
