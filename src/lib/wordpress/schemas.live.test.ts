import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PluginSchema,
  PostSchema,
  SettingsSchema,
  UserSchema,
} from './types';

const WP_BASE = process.env.WP_HEALTH_WEB24?.replace(/\/$/, '');
const WP_USER = process.env.WP_APP_USER;
const WP_PASS = process.env.WP_APP_PASSWORD;

const canRunLive = Boolean(WP_BASE && WP_USER && WP_PASS);

async function wpFetch<T>(path: string): Promise<T> {
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const res = await fetch(`${WP_BASE}/wp-json${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`WP ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function wpFetchResponse(path: string): Promise<Response> {
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  return fetch(`${WP_BASE}/wp-json${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
}

describe.skipIf(!canRunLive)('WordPress live API contract (web24)', () => {
  it('GET /wp/v2/posts matches PostSchema', async () => {
    const data = await wpFetch<unknown[]>('/wp/v2/posts?per_page=1&context=edit');
    expect(data.length).toBeGreaterThan(0);
    PostSchema.parse(data[0]);
  });

  it('GET /wp/v2/settings matches SettingsSchema', async () => {
    const data = await wpFetch<unknown>('/wp/v2/settings');
    const parsed = SettingsSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it('GET /wp/v2/plugins matches PluginSchema[]', async () => {
    const res = await wpFetchResponse('/wp/v2/plugins');
    if (res.status === 403) {
      const body = await res.json();
      expect(body.code).toBe('rest_cannot_view_plugins');
      return;
    }
    if (!res.ok) {
      throw new Error(`WP /wp/v2/plugins → HTTP ${res.status}`);
    }
    const data = await res.json() as unknown[];
    expect(data.length).toBeGreaterThan(0);
    z.array(PluginSchema).parse(data.slice(0, 3));
  });

  it('GET /wp/v2/users/me matches UserSchema', async () => {
    const data = await wpFetch<unknown>('/wp/v2/users/me?context=edit');
    const user = UserSchema.parse(data);
    expect(user.roles.length).toBeGreaterThan(0);
  });
});
