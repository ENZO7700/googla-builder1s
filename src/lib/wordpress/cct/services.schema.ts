/**
 * wpBOX — JetEngine CCT services: Zod schemas
 *
 * Validates data coming from or going to the JetEngine REST API.
 * Follows the same pattern as `src/lib/wordpress/types.ts`.
 */

import { z } from 'zod';
import { SEO_ROBOTS_VALUES, SEO_ROBOTS_DEFAULT } from './services.types';

// ==================== SHARED HELPERS ====================

/** Slug must be lowercase alphanumeric + hyphens, 1-200 chars. */
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SlugSchema = z
  .string()
  .min(1, 'Slug je povinný.')
  .max(200, 'Slug je príliš dlhý (max 200 znakov).')
  .regex(slugRegex, 'Slug musí obsahovať iba malé písmená, čísla a pomlčky.');

const SeoRobotsSchema = z
  .enum(SEO_ROBOTS_VALUES)
  .default(SEO_ROBOTS_DEFAULT);

/**
 * Coerce a value that may arrive as a string from WP into a number | null.
 * Empty strings and explicit nulls become null.
 */
const coerceOptionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });



/**
 * Normalise ISO-ish datetime strings.
 * Accepts ISO 8601 and `datetime-local` format (without timezone).
 * Returns ISO 8601 string or empty string when blank/null.
 */
const normaliseDatetime = z
  .string()
  .optional()
  .default('')
  .transform((v): string => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  });

// ==================== FULL ITEM SCHEMA (read) ====================

export const ServiceCctItemSchema = z.object({
  _ID: z.number(),
  cct_status: z.string().default('publish'),
  cct_created: z.string().default(''),
  cct_modified: z.string().default(''),
  cct_author_id: z.number().default(0),

  title: z.string().min(1, 'Názov služby je povinný.'),
  slug: SlugSchema,
  tagline: z.string().default(''),
  description: z.string().default(''),
  start_datetime: normaliseDatetime,
  end_datetime: normaliseDatetime,
  capacity: coerceOptionalNumber,
  duration: coerceOptionalNumber,
  price: coerceOptionalNumber,
  service_type: z.string().default(''),
  service_category: z.string().default(''),
  image_id: z.string().default(''),

  seo_title: z.string().default(''),
  seo_description: z.string().default(''),
  seo_keywords: z.string().default(''),
  seo_canonical: z.string().default(''),
  seo_og_image: z.string().default(''),
  seo_robots: SeoRobotsSchema,
});

export type ServiceCctItemParsed = z.infer<typeof ServiceCctItemSchema>;

// ==================== DRAFT SCHEMA (write) ====================

export const ServiceCctDraftSchema = z.object({
  title: z.string().min(1, 'Názov služby je povinný.'),
  slug: SlugSchema,
  tagline: z.string().optional().default(''),
  description: z.string().optional().default(''),
  start_datetime: normaliseDatetime,
  end_datetime: normaliseDatetime,
  capacity: coerceOptionalNumber,
  duration: coerceOptionalNumber,
  price: coerceOptionalNumber,
  service_type: z.string().optional().default(''),
  service_category: z.string().optional().default(''),
  image_id: z.string().optional().default(''),

  seo_title: z.string().optional().default(''),
  seo_description: z.string().optional().default(''),
  seo_keywords: z.string().optional().default(''),
  seo_canonical: z.string().optional().default(''),
  seo_og_image: z.string().optional().default(''),
  seo_robots: SeoRobotsSchema,
});

export type ServiceCctDraftParsed = z.infer<typeof ServiceCctDraftSchema>;
