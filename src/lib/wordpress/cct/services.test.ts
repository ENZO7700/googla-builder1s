import { describe, expect, it } from 'vitest';
import {
  ServiceCctItemSchema,
  ServiceCctDraftSchema,
} from './services.schema';
import {
  validateServiceDraft,
  isValidSlug,
  slugify,
  normaliseNumber,
  normaliseDatetime,
  buildServiceCctPayload,
} from './services.validation';
import type { ServiceCctDraft } from './services.types';

// ==================== FIXTURES ====================

/** Minimal valid draft — only title and slug are required. */
const VALID_DRAFT: ServiceCctDraft = {
  title: 'Zlatý balík',
  slug: 'zlaty-balik',
};

const FULL_DRAFT: ServiceCctDraft = {
  title: 'Premium konzultácia',
  slug: 'premium-konzultacia',
  tagline: 'Naša vlajková služba',
  description: 'Popis služby.',
  start_datetime: '2026-07-01T10:00',
  end_datetime: '2026-07-01T11:00',
  capacity: 10,
  duration: 60,
  price: 149.99,
  service_type: 'consultation',
  service_category: 'premium',
  image_id: '42',
  seo_title: 'Premium konzultácia | Gold Taxi',
  seo_description: 'Meta popis.',
  seo_keywords: 'konzultácia, premium',
  seo_canonical: 'https://example.com/premium-konzultacia',
  seo_og_image: 'https://example.com/og.jpg',
  seo_robots: 'noindex,nofollow',
};

const VALID_ITEM = {
  _ID: 1,
  cct_status: 'publish',
  cct_created: '2026-06-01T00:00:00',
  cct_modified: '2026-06-10T12:00:00',
  cct_author_id: 1,
  title: 'Basic ride',
  slug: 'basic-ride',
  tagline: '',
  description: '',
  start_datetime: '',
  end_datetime: '',
  capacity: null,
  duration: null,
  price: null,
  service_type: '',
  service_category: '',
  image_id: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  seo_canonical: '',
  seo_og_image: '',
  seo_robots: 'index,follow',
};

// ==================== SCHEMA: ITEM ====================

describe('ServiceCctItemSchema', () => {
  it('parses a valid item', () => {
    const parsed = ServiceCctItemSchema.parse(VALID_ITEM);
    expect(parsed._ID).toBe(1);
    expect(parsed.slug).toBe('basic-ride');
    expect(parsed.seo_robots).toBe('index,follow');
  });

  it('accepts item without duration (null)', () => {
    const parsed = ServiceCctItemSchema.parse({ ...VALID_ITEM, duration: null });
    expect(parsed.duration).toBeNull();
  });

  it('accepts item without duration (undefined)', () => {
    const { duration: _, ...noDuration } = VALID_ITEM;
    const parsed = ServiceCctItemSchema.parse(noDuration);
    expect(parsed.duration).toBeNull();
  });

  it('coerces string duration to number', () => {
    const parsed = ServiceCctItemSchema.parse({ ...VALID_ITEM, duration: '45' });
    expect(parsed.duration).toBe(45);
  });

  it('coerces string capacity to number', () => {
    const parsed = ServiceCctItemSchema.parse({ ...VALID_ITEM, capacity: '20' });
    expect(parsed.capacity).toBe(20);
  });

  it('normalises datetime to ISO 8601', () => {
    const parsed = ServiceCctItemSchema.parse({
      ...VALID_ITEM,
      start_datetime: '2026-07-01T10:00',
    });
    expect(parsed.start_datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('defaults seo_robots to index,follow when missing', () => {
    const { seo_robots: _, ...item } = VALID_ITEM;
    const parsed = ServiceCctItemSchema.parse(item);
    expect(parsed.seo_robots).toBe('index,follow');
  });

  it('rejects missing title', () => {
    expect(() =>
      ServiceCctItemSchema.parse({ ...VALID_ITEM, title: '' }),
    ).toThrow();
  });

  it('rejects invalid slug', () => {
    expect(() =>
      ServiceCctItemSchema.parse({ ...VALID_ITEM, slug: 'UPPER CASE SPACES' }),
    ).toThrow();
  });

  it('rejects invalid seo_robots value', () => {
    expect(() =>
      ServiceCctItemSchema.parse({ ...VALID_ITEM, seo_robots: 'noindex' }),
    ).toThrow();
  });
});

// ==================== SCHEMA: DRAFT ====================

describe('ServiceCctDraftSchema', () => {
  it('parses minimal valid draft (only title + slug)', () => {
    const parsed = ServiceCctDraftSchema.parse(VALID_DRAFT);
    expect(parsed.title).toBe('Zlatý balík');
    expect(parsed.slug).toBe('zlaty-balik');
    expect(parsed.seo_robots).toBe('index,follow');
    expect(parsed.tagline).toBe('');
    expect(parsed.duration).toBeNull();
  });

  it('parses full draft with all fields', () => {
    const parsed = ServiceCctDraftSchema.parse(FULL_DRAFT);
    expect(parsed.seo_robots).toBe('noindex,nofollow');
    expect(parsed.price).toBe(149.99);
    expect(parsed.duration).toBe(60);
    expect(parsed.start_datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts draft without duration', () => {
    const parsed = ServiceCctDraftSchema.parse({ title: 'Test', slug: 'test' });
    expect(parsed.duration).toBeNull();
  });

  it('rejects draft without title', () => {
    expect(() =>
      ServiceCctDraftSchema.parse({ slug: 'abc' }),
    ).toThrow();
  });

  it('rejects draft without slug', () => {
    expect(() =>
      ServiceCctDraftSchema.parse({ title: 'Test' }),
    ).toThrow();
  });

  it('rejects draft with invalid slug', () => {
    expect(() =>
      ServiceCctDraftSchema.parse({ title: 'Test', slug: 'BAD SLUG!' }),
    ).toThrow();
  });

  it('rejects draft with empty title', () => {
    expect(() =>
      ServiceCctDraftSchema.parse({ title: '', slug: 'valid-slug' }),
    ).toThrow();
  });
});

// ==================== VALIDATION HELPERS ====================

describe('validateServiceDraft', () => {
  it('returns ok for valid draft (title + slug only)', () => {
    const result = validateServiceDraft(VALID_DRAFT);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns ok for draft without duration', () => {
    const result = validateServiceDraft({ title: 'Svc', slug: 'svc' });
    expect(result.ok).toBe(true);
  });

  it('returns errors for empty object', () => {
    const result = validateServiceDraft({});
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('includes field path in error messages', () => {
    const result = validateServiceDraft({ title: '', slug: 'a' });
    expect(result.errors.some((e) => e.includes('title'))).toBe(true);
  });
});

// ==================== SLUG HELPERS ====================

describe('isValidSlug', () => {
  it.each([
    ['basic-ride', true],
    ['a', true],
    ['hello-world-123', true],
    ['UPPERCASE', false],
    ['has spaces', false],
    ['trailing-', false],
    ['-leading', false],
    ['', false],
  ])('isValidSlug(%s) → %s', (input, expected) => {
    expect(isValidSlug(input)).toBe(expected);
  });
});

describe('slugify', () => {
  it('lowercases and strips diacritics', () => {
    expect(slugify('Zlatý Balík')).toBe('zlaty-balik');
  });

  it('replaces special chars with hyphens', () => {
    expect(slugify('Hello & World!')).toBe('hello-world');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('--test--')).toBe('test');
  });

  it('truncates to 200 chars', () => {
    const long = 'a'.repeat(300);
    expect(slugify(long).length).toBeLessThanOrEqual(200);
  });
});

// ==================== NORMALISATION ====================

describe('normaliseNumber', () => {
  it.each([
    [42, 42],
    ['42', 42],
    ['3.14', 3.14],
    ['', null],
    [null, null],
    [undefined, null],
    ['abc', null],
  ])('normaliseNumber(%s) → %s', (input, expected) => {
    expect(normaliseNumber(input)).toBe(expected);
  });
});

describe('normaliseDatetime', () => {
  it('converts datetime-local to ISO', () => {
    const result = normaliseDatetime('2026-07-01T10:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('returns empty for invalid date', () => {
    expect(normaliseDatetime('not-a-date')).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(normaliseDatetime('')).toBe('');
  });

  it('returns empty for non-string', () => {
    expect(normaliseDatetime(null)).toBe('');
  });
});

// ==================== PAYLOAD BUILDER ====================

describe('buildServiceCctPayload', () => {
  it('returns ok + payload for minimal draft (no duration)', () => {
    const result = buildServiceCctPayload(VALID_DRAFT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.title).toBe('Zlatý balík');
      expect(result.payload.slug).toBe('zlaty-balik');
      expect(result.payload.duration).toBeNull();
      expect(result.payload.seo_robots).toBe('index,follow');
    }
  });

  it('returns ok + payload with duration when provided', () => {
    const result = buildServiceCctPayload({ ...VALID_DRAFT, duration: 90 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.duration).toBe(90);
    }
  });

  it('trims whitespace from string fields', () => {
    const result = buildServiceCctPayload({
      ...VALID_DRAFT,
      title: '  Spaced  ',
      tagline: ' tag ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.title).toBe('Spaced');
      expect(result.payload.tagline).toBe('tag');
    }
  });

  it('returns errors when title is missing', () => {
    const result = buildServiceCctPayload({
      title: '',
      slug: 'valid-slug',
    });
    expect(result.ok).toBe(false);
    const { errors } = result as { ok: false; errors: string[] };
    expect(errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('returns errors when slug is missing', () => {
    const result = buildServiceCctPayload({
      title: 'Valid',
      slug: '',
    });
    expect(result.ok).toBe(false);
    const { errors } = result as { ok: false; errors: string[] };
    expect(errors.some((e) => e.includes('slug'))).toBe(true);
  });

  it('returns errors when slug is invalid', () => {
    const result = buildServiceCctPayload({
      title: 'Valid',
      slug: 'BAD SLUG!',
    });
    expect(result.ok).toBe(false);
    const { errors } = result as { ok: false; errors: string[] };
    expect(errors.some((e) => e.includes('slug'))).toBe(true);
  });

  it('coerces string numbers in payload', () => {
    const result = buildServiceCctPayload({
      ...VALID_DRAFT,
      price: '99.50',
      capacity: '15',
      duration: '45',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.price).toBe(99.5);
      expect(result.payload.capacity).toBe(15);
      expect(result.payload.duration).toBe(45);
    }
  });
});
