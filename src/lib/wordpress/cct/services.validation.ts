/**
 * wpBOX — JetEngine CCT services: validation & payload builder
 *
 * Pure functions. No network calls, no UI, no Supabase writes.
 */

import { ServiceCctDraftSchema } from './services.schema';
import type { ServiceCctDraft, ServiceValidationResult } from './services.types';
import { SEO_ROBOTS_DEFAULT } from './services.types';

// ==================== VALIDATION ====================

/**
 * Validate a draft against the Zod schema and return a structured result.
 * Never throws — always returns `{ ok, errors }`.
 */
export function validateServiceDraft(draft: unknown): ServiceValidationResult {
  const result = ServiceCctDraftSchema.safeParse(draft);
  if (result.success) {
    return { ok: true, errors: [] };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`,
  );
  return { ok: false, errors };
}

// ==================== SLUG HELPERS ====================

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Check if a string is a valid CCT slug. */
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 200;
}

/** Best-effort slug generation from a title. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// ==================== NUMBER / DATETIME NORMALISATION ====================

/** Coerce string/null → number | null (mirrors schema transform). */
export function normaliseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Coerce string → ISO 8601 or empty string. */
export function normaliseDatetime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

// ==================== PAYLOAD BUILDER ====================

/**
 * Build a normalised, validated payload ready to POST/PUT to JetEngine CCT REST.
 *
 * 1. Fills missing optional fields with defaults.
 * 2. Coerces numbers and datetimes.
 * 3. Validates via Zod.
 * 4. Returns `{ ok: true, payload }` or `{ ok: false, errors }`.
 */
export function buildServiceCctPayload(
  draft: ServiceCctDraft,
): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: string[] } {
  // Pre-normalise before schema parse
  const raw = {
    title: draft.title?.trim() ?? '',
    slug: draft.slug?.trim() ?? '',
    tagline: draft.tagline?.trim() ?? '',
    description: draft.description?.trim() ?? '',
    start_datetime: draft.start_datetime ?? '',
    end_datetime: draft.end_datetime ?? '',
    capacity: draft.capacity,
    duration: draft.duration,
    price: draft.price,
    service_type: draft.service_type?.trim() ?? '',
    service_category: draft.service_category?.trim() ?? '',
    image_id: draft.image_id?.trim() ?? '',
    seo_title: draft.seo_title?.trim() ?? '',
    seo_description: draft.seo_description?.trim() ?? '',
    seo_keywords: draft.seo_keywords?.trim() ?? '',
    seo_canonical: draft.seo_canonical?.trim() ?? '',
    seo_og_image: draft.seo_og_image?.trim() ?? '',
    seo_robots: draft.seo_robots ?? SEO_ROBOTS_DEFAULT,
  };

  const result = ServiceCctDraftSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return { ok: false, errors };
  }

  return { ok: true, payload: result.data as unknown as Record<string, unknown> };
}
