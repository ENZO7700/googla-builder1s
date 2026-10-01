import { describe, it, expect } from 'vitest';
import { normalizeWpBaseUrl, wpComSiteHost } from '../../supabase/functions/_shared/wp-url';

describe('WordPress URL normalizácia (regresia)', () => {
  const cases: [string, string][] = [
    ['example.com', 'https://example.com'],
    ['Https://Example.com/', 'https://example.com'],
    ['https://example.com/wp-admin', 'https://example.com'],
    ['https://example.com/wp-admin/index.php', 'https://example.com'],
    ['https://example.com/wp-login.php', 'https://example.com'],
    ['https://example.com/wp-json/wp/v2/posts', 'https://example.com'],
    ['https://example.com/blog/wp-admin/', 'https://example.com/blog'],
    ['https://example.com/?a=1#x', 'https://example.com'],
    ['http://localhost:8080/', 'http://localhost:8080'],
  ];
  it.each(cases)('%s → %s', (input, out) => {
    expect(normalizeWpBaseUrl(input)).toBe(out);
  });

  it('prázdny vstup vráti prázdny reťazec', () => {
    expect(normalizeWpBaseUrl('')).toBe('');
    expect(normalizeWpBaseUrl('   ')).toBe('');
  });

  it('REST endpoint sa skladá bez dvojitých lomítok', () => {
    const base = normalizeWpBaseUrl('https://example.com/wp-admin/');
    expect(`${base}/wp-json/wp/v2/posts`).toBe('https://example.com/wp-json/wp/v2/posts');
  });

  it('WordPress.com host bez schémy a cesty', () => {
    expect(wpComSiteHost('https://MySite.wordpress.com/wp-admin')).toBe('mysite.wordpress.com');
  });
});
