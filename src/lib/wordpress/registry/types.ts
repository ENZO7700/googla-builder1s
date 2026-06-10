// wpBOX Data Blueprint v4.0 — shared registry types.

export type SeoMeta = {
  slug?: string;
  title?: string;
  description?: string;
  keywords?: string[];
  canonical_url?: string;
  noindex?: boolean;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_type?: 'website' | 'article' | 'product' | 'event';
  twitter_card?: 'summary' | 'summary_large_image';
  sitemap_priority?: '0.1' | '0.5' | '0.8' | '1.0';
  sitemap_changefreq?: 'daily' | 'weekly' | 'monthly';
};

export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';

export type SyncMeta = {
  sync_status: SyncStatus;
  content_hash?: string;
  wp_post_id?: number;
  wp_modified_at?: string;
  last_synced_at?: string;
  last_sync_error?: string;
};

export type CtaButton = {
  text: string;
  url: string;
  target: '_self' | '_blank';
  is_active?: boolean;
};

export type SocialLink = {
  platform: string;
  url: string;
  icon?: string;
};

export type MediaRef = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type SyncStrategy = 'supabase-wins' | 'wp-wins' | 'newest-wins' | 'manual' | 'none';

export type BlueprintFamily =
  | 'core'
  | 'content'
  | 'marketplace'
  | 'directory'
  | 'booking'
  | 'fundraising';

export type EntityKind = 'singleton' | 'repeater' | 'log' | 'queue';

export interface EntitySyncConfig {
  strategy: SyncStrategy;
  auto: boolean;
}

export interface EntityWpConfig {
  cpt?: string;
  taxonomy?: string;
  custom?: string;
}

export interface EntityDefinition {
  table: string;
  kind: EntityKind;
  blueprints: string[];
  family: BlueprintFamily;
  embedded?: Record<string, 'jsonb' | 'text[]' | 'enum'>;
  relations?: Record<string, string>;
  wp?: EntityWpConfig;
  sync?: EntitySyncConfig;
  publicRead?: boolean;
}

export interface BlueprintPage {
  id: string;
  path?: string;
  slots: string[];
}

export interface BlueprintManifest {
  id: string;
  version: string;
  label: string;
  family: BlueprintFamily;
  extends?: string[];
  entities: string[];
  pages?: BlueprintPage[];
  integrations?: string[];
  wp?: {
    cpts?: string[];
    taxonomies?: string[];
  };
  config?: Record<string, unknown>;
}
