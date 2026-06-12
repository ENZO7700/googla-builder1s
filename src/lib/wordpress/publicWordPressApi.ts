import { supabase } from '@/integrations/supabase/client';

export interface PublicWpStats {
  siteName: string;
  description: string;
  url: string;
  posts: number;
  pages: number;
  comments: number;
  users: number;
  media: number;
  customNamespaces: string[];
}

export type PublicWpCheckStatus = 'ok' | 'protected' | 'error';

export interface PublicWpCheck {
  label: string;
  endpoint: string;
  status: PublicWpCheckStatus;
  httpStatus: number;
  detail: string;
  durationMs: number;
}

export interface AuthenticatedWpUser {
  id: number;
  name: string;
  slug: string;
  link?: string;
  roles: string[];
  capabilities: string[];
  avatarUrl?: string;
}

export type AuthenticatedWpConnectionResult =
  | {
      ok: true;
      httpStatus: number;
      user: AuthenticatedWpUser;
      durationMs: number;
    }
  | {
      ok: false;
      httpStatus: number;
      message: string;
      durationMs: number;
    };

export interface TestWordPressAuthInput {
  baseUrl: string;
  username: string;
  applicationPassword: string;
}

const READ_ENDPOINTS = [
  { label: 'REST root', endpoint: '/', protectedOk: false },
  { label: 'Posts', endpoint: '/wp/v2/posts?per_page=1&_fields=id,slug,title,status', protectedOk: false },
  { label: 'Pages', endpoint: '/wp/v2/pages?per_page=1&_fields=id,slug,title,status', protectedOk: false },
  { label: 'Media', endpoint: '/wp/v2/media?per_page=1&_fields=id,slug,title,source_url', protectedOk: false },
  { label: 'Comments', endpoint: '/wp/v2/comments?per_page=1&_fields=id,post,author_name,status', protectedOk: false },
  { label: 'Users', endpoint: '/wp/v2/users?per_page=1&_fields=id,name,slug', protectedOk: true },
  { label: 'Types', endpoint: '/wp/v2/types', protectedOk: false },
  { label: 'Custom namespace', endpoint: '/webdo24h/v1', protectedOk: true },
  { label: 'Custom schema', endpoint: '/webdo24h/v1/schema', protectedOk: true },
  { label: 'Settings', endpoint: '/wp/v2/settings', protectedOk: true },
  { label: 'Plugins', endpoint: '/wp/v2/plugins', protectedOk: true },
] as const;

export async function getPublicWordPressStats(baseUrl: string, siteId?: string): Promise<PublicWpStats> {
  const [root, posts, pages, comments, media] = await Promise.all([
    requestJson(baseUrl, '/', siteId),
    requestJson(baseUrl, '/wp/v2/posts?per_page=1&_fields=id', siteId),
    requestJson(baseUrl, '/wp/v2/pages?per_page=1&_fields=id', siteId),
    requestJson(baseUrl, '/wp/v2/comments?per_page=1&_fields=id', siteId),
    requestJson(baseUrl, '/wp/v2/media?per_page=1&_fields=id', siteId),
  ]);

  const rootBody = root.body as { name?: string; description?: string; url?: string; namespaces?: string[] };
  return {
    siteName: rootBody.name ?? 'WordPress',
    description: rootBody.description ?? '',
    url: rootBody.url ?? normalizeBaseUrl(baseUrl),
    posts: totalFrom(posts),
    pages: totalFrom(pages),
    comments: totalFrom(comments),
    users: 0, // Users endpoint requires auth; not available publicly
    media: totalFrom(media),
    customNamespaces: (rootBody.namespaces ?? []).filter(ns => !ns.startsWith('wp/') && !ns.startsWith('oembed/')),
  };
}

export async function runPublicWordPressChecks(baseUrl: string, siteId?: string): Promise<PublicWpCheck[]> {
  const { data: { session } } = siteId ? await supabase.auth.getSession() : { data: { session: null } };

  return Promise.all(READ_ENDPOINTS.map(async check => {
    const start = performance.now();
    try {
      let response: Response;
      if (siteId && session) {
        response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wordpress-proxy`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            siteId,
            method: 'GET',
            path: check.endpoint,
          }),
        });
      } else if (!check.protectedOk) {
        // Only call public endpoints directly when no siteId
        response = await fetch(wordPressUrl(baseUrl, check.endpoint), {
          headers: { Accept: 'application/json' },
        });
      } else {
        // Skip protected endpoints without siteId/valid session
        return {
          label: check.label,
          endpoint: check.endpoint,
          status: 'protected',
          httpStatus: 0,
          detail: 'Requires saved connection and Supabase session',
          durationMs: 0,
        };
      }

      const durationMs = Math.round(performance.now() - start);
      const body = await response.json().catch(() => null) as { message?: string; namespace?: string; name?: string } | null;
      const isProtected = response.status === 401 || response.status === 403;

      if (response.ok) {
        return {
          label: check.label,
          endpoint: check.endpoint,
          status: 'ok',
          httpStatus: response.status,
          detail: body?.namespace ? `Namespace ${body.namespace}` : body?.name ? body.name : 'Endpoint odpovedá',
          durationMs,
        };
      }

      if (check.protectedOk && isProtected) {
        return {
          label: check.label,
          endpoint: check.endpoint,
          status: 'protected',
          httpStatus: response.status,
          detail: protectedEndpointDetail(check.label),
          durationMs,
        };
      }

      return {
        label: check.label,
        endpoint: check.endpoint,
        status: 'error',
        httpStatus: response.status,
        detail: body?.message ?? `HTTP ${response.status}`,
        durationMs,
      };
    } catch (error) {
      return {
        label: check.label,
        endpoint: check.endpoint,
        status: 'error',
        httpStatus: 0,
        detail: error instanceof Error ? error.message : 'Network error',
        durationMs: Math.round(performance.now() - start),
      };
    }
  }));
}

export async function testWordPressApplicationPassword({
  baseUrl,
  username,
  applicationPassword,
}: TestWordPressAuthInput): Promise<AuthenticatedWpConnectionResult> {
  const startedAt = performance.now();
  const cleanBaseUrl = normalizeBaseUrl(baseUrl.trim());
  const cleanUsername = username.trim();
  const cleanPassword = applicationPassword.trim();

  if (!cleanBaseUrl || !cleanUsername || !cleanPassword) {
    return {
      ok: false,
      httpStatus: 0,
      message: 'Vyplňte WordPress URL, username a Application Password.',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  try {
    const response = await fetch(`${cleanBaseUrl}/wp-json/wp/v2/users/me?context=edit`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${encodeBasicAuth(cleanUsername, cleanPassword)}`,
      },
    });

    const durationMs = Math.round(performance.now() - startedAt);
    const body = await response.json().catch(() => null) as WpMeResponse | WpErrorResponse | null;

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        message: authenticatedWpErrorMessage(response.status, body),
        durationMs,
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      user: mapWpMeResponse(body),
      durationMs,
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: 0,
      message: error instanceof Error
        ? 'Nepodarilo sa pripojiť z browsera. Skontrolujte URL, HTTPS a CORS/Authorization hlavičky na WordPresse.'
        : 'Nepodarilo sa pripojiť k WordPressu.',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function totalFrom(result: { response: Response }) {
  return Number(result.response.headers.get('X-WP-Total') ?? '0');
}

async function requestJson(baseUrl: string, endpoint: string, siteId?: string) {
  let response: Response;
  
  if (siteId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wordpress-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId,
          method: 'GET',
          path: endpoint,
        }),
      });
    } else {
      response = await fetch(wordPressUrl(baseUrl, endpoint), {
        headers: { Accept: 'application/json' },
      });
    }
  } else {
    response = await fetch(wordPressUrl(baseUrl, endpoint), {
      headers: { Accept: 'application/json' },
    });
  }

  if (!response.ok) {
    throw new Error(`${endpoint}: HTTP ${response.status}`);
  }
  return {
    response,
    body: await response.json() as unknown,
  };
}

function wordPressUrl(baseUrl: string, endpoint: string) {
  const cleanBase = normalizeBaseUrl(baseUrl);
  return `${cleanBase}/wp-json${endpoint}`;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

interface WpErrorResponse {
  code?: string;
  message?: string;
}

interface WpMeResponse {
  id?: number;
  name?: string;
  slug?: string;
  link?: string;
  roles?: string[];
  capabilities?: Record<string, boolean>;
  avatar_urls?: Record<string, string>;
}

function encodeBasicAuth(username: string, applicationPassword: string) {
  const bytes = new TextEncoder().encode(`${username}:${applicationPassword}`);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function mapWpMeResponse(body: WpMeResponse | WpErrorResponse | null): AuthenticatedWpUser {
  const data = (body ?? {}) as WpMeResponse;
  const capabilities = Object.entries(data.capabilities ?? {})
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)
    .sort();

  return {
    id: data.id ?? 0,
    name: data.name ?? 'WordPress user',
    slug: data.slug ?? '',
    link: data.link,
    roles: data.roles ?? [],
    capabilities,
    avatarUrl: data.avatar_urls?.['96'] ?? data.avatar_urls?.['48'] ?? data.avatar_urls?.['24'],
  };
}

function authenticatedWpErrorMessage(status: number, body: WpMeResponse | WpErrorResponse | null) {
  if (status === 401) {
    return 'WordPress odmietol údaje. Skontrolujte username a Application Password.';
  }

  if (status === 403) {
    return 'Údaje sú prijaté, ale používateľ nemá oprávnenie čítať /users/me?context=edit.';
  }

  const message = (body as WpErrorResponse | null)?.message;
  return message ? stripHtml(message) : `WordPress vrátil HTTP ${status}.`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').trim();
}

// Test WordPress credentials via Supabase Edge Function (no direct browser calls)
export async function testWordPressConnectionViaProxy(
  baseUrl: string,
  username: string,
  applicationPassword: string,
  accessToken: string
): Promise<AuthenticatedWpConnectionResult> {
  const startedAt = performance.now();
  
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wordpress-connection`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: 'test',
          baseUrl,
          username,
          appPassword: applicationPassword,
        }),
      }
    );

    const durationMs = Math.round(performance.now() - startedAt);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        httpStatus: response.status,
        message: errorData.error ?? errorData.message ?? `Proxy test failed with HTTP ${response.status}`,
        durationMs,
      };
    }

    const data = await response.json();
    
    if (!data.ok) {
      return {
        ok: false,
        httpStatus: data.httpStatus ?? 0,
        message: data.message ?? data.error ?? 'WordPress credentials validation failed',
        durationMs,
      };
    }

    // Map the response to match AuthenticatedWpConnectionResult
    return {
      ok: true,
      httpStatus: 200,
      user: data.user,
      durationMs,
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: 0,
      message: error instanceof Error 
        ? error.message 
        : 'Network error during proxy connection test',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function protectedEndpointDetail(label: string) {
  if (label === 'Plugins') {
    return 'Chránené podľa očakávania. Správa pluginov potrebuje WordPress admin prístup.';
  }

  if (label === 'Settings') {
    return 'Chránené podľa očakávania. Nastavenia webu potrebujú WordPress Application Password.';
  }

  return 'Chránené podľa očakávania. Na čítanie tejto schémy treba autentifikáciu.';
}
