/**
 * wpBOX — JetEngine Custom Content Type: services
 *
 * Pure type definitions. No API calls, no UI, no side effects.
 */

// ==================== ENUMS ====================

export const SEO_ROBOTS_VALUES = [
  'index,follow',
  'index,nofollow',
  'noindex,follow',
  'noindex,nofollow',
] as const;

export type SeoRobots = (typeof SEO_ROBOTS_VALUES)[number];

export const SEO_ROBOTS_DEFAULT: SeoRobots = 'index,follow';

// ==================== CCT ITEM (read from WP) ====================

/**
 * Represents a fully-hydrated row returned by JetEngine CCT REST API.
 * `_ID` is the auto-increment primary key assigned by the CCT table.
 */
export interface ServiceCctItem {
  _ID: number;
  cct_status: string;
  cct_created: string;
  cct_modified: string;
  cct_author_id: number;

  // --- content fields ---
  title: string;
  slug: string;
  tagline: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  capacity: number | null;
  duration: number | null;
  price: number | null;
  service_type: string;
  service_category: string;
  image_id: string;

  // --- SEO fields ---
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  seo_canonical: string;
  seo_og_image: string;
  seo_robots: SeoRobots;
}

// ==================== CCT DRAFT (write to WP) ====================

/**
 * Draft payload used to create or update a CCT services item.
 * Only `title` and `slug` are required; everything else
 * falls back to sensible defaults during normalisation.
 */
export interface ServiceCctDraft {
  title: string;
  slug: string;
  tagline?: string;
  description?: string;
  start_datetime?: string;
  end_datetime?: string;
  capacity?: number | string | null;
  duration?: number | string | null;
  price?: number | string | null;
  service_type?: string;
  service_category?: string;
  image_id?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_canonical?: string;
  seo_og_image?: string;
  seo_robots?: SeoRobots | string;
}

// ==================== VALIDATION RESULT ====================

export interface ServiceValidationResult {
  ok: boolean;
  errors: string[];
}
