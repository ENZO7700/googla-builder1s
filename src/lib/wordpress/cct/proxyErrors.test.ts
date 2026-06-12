import { describe, expect, it } from 'vitest';
import { normalizeCctProxyErrorPayload } from './proxyErrors';

describe('normalizeCctProxyErrorPayload', () => {
  it('maps rest_no_route to a JetEngine setup hint', () => {
    const message = normalizeCctProxyErrorPayload({
      code: 'rest_no_route',
      message: 'Nebola nájdená žiadna cesta zhodujúca sa s URL a požadovanou metódou.',
      data: { status: 404 },
    });

    expect(message).toContain('/wp-json/jet-cct/services');
    expect(message).toContain('JetEngine');
  });

  it('preserves proxy validation errors', () => {
    const message = normalizeCctProxyErrorPayload({
      ok: false,
      error: 'Site not found or access denied.',
      details: 'User does not own this site.',
    });

    expect(message).toBe('Site not found or access denied. User does not own this site.');
  });

  it('falls back to the original text for plain responses', () => {
    expect(normalizeCctProxyErrorPayload('Forbidden')).toBe('Forbidden');
  });
});
