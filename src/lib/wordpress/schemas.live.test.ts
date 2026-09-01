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

function restUrls(pathWithQuery: string): { primary: string; fallback: string } {
  const qIndex = pathWithQuery.indexOf('?');
  const routePath = qIndex >= 0 ? pathWithQuery.slice(0, qIndex) : pathWithQuery;
  const queryString = qIndex >= 0 ? pathWithQuery.slice(qIndex + 1) : '';
  const fallbackBase = `${WP_BASE}/index.php?rest_route=${encodeURIComponent(routePath)}`;
  return {
    primary: `${WP_BASE}/wp-json${pathWithQuery}`,
    fallback: queryString ? `${fallbackBase}&${queryString}` : fallbackBase,
  };
}

async function shouldRetryWithIndexPhp(res: Response): Promise<boolean> {
  if (res.status !== 404) return false;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return false;
  if (contentType.includes('text/html')) return true;
  const text = await res.clone().text();
  return text.trimStart().startsWith('<');
}

async function wpFetchResponse(path: string): Promise<Response> {
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const { primary, fallback } = restUrls(path);

  let res = await fetch(primary, { headers });
  if (await shouldRetryWithIndexPhp(res)) {
    res = await fetch(fallback, { headers });
  }
  return res;
}

async function wpFetch<T>(path: string): Promise<T> {
  const res = await wpFetchResponse(path);
  if (!res.ok) {
    throw new Error(`WP ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

describe.skipIf(!canRunLive)('WordPress live API contract', () => {
  it('GET /wp/v2/posts matches PostSchema', async () => {
    const data = await wpFetch<unknown[]>('/wp/v2/posts?per_page=1&context=edit');
    if (data.length === 0) {
      return;
    }
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
