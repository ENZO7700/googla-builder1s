import { describe, expect, it } from 'vitest';
import { normalizeRequestPath } from './path';

describe('normalizeRequestPath', () => {
  it('keeps root and wp-json root requests stable', () => {
    expect(normalizeRequestPath('/')).toBe('/');
    expect(normalizeRequestPath('/wp-json')).toBe('/');
    expect(normalizeRequestPath('/wp-json/')).toBe('/');
  });

  it('normalizes WordPress REST paths from multiple supported forms', () => {
    expect(normalizeRequestPath('/wp-json/wp/v2/users')).toBe('/wp/v2/users');
    expect(normalizeRequestPath('wp-json/wp/v2/settings')).toBe('/wp/v2/settings');
    expect(normalizeRequestPath('wp/v2/plugins')).toBe('/wp/v2/plugins');
    expect(normalizeRequestPath('users')).toBe('users');
  });

  it('rejects unsafe or empty paths', () => {
    expect(normalizeRequestPath('')).toBeNull();
    expect(normalizeRequestPath('   ')).toBeNull();
    expect(normalizeRequestPath('../users')).toBeNull();
    expect(normalizeRequestPath('https://evil.example.com/wp-json')).toBeNull();
    expect(normalizeRequestPath('wp-json/..')).toBeNull();
    expect(normalizeRequestPath('wp\\v2\\users')).toBeNull();
  });
});
