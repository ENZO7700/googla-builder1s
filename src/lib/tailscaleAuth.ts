type SupabaseSessionTokens = {
  access_token: string;
  refresh_token: string;
};

type SessionSetter = {
  auth: {
    setSession: (session: SupabaseSessionTokens) => Promise<{ error: Error | null }>;
  };
};

export type TailscaleAuthConfig = {
  authUrl: string | null;
  origin: string | null;
  timeoutMs: number;
};

type TailscaleSessionResponse = {
  ok: true;
  session: SupabaseSessionTokens;
  tailscaleUserLogin?: string | null;
};

const DEFAULT_TIMEOUT_MS = 2500;
const MANUAL_SIGNOUT_KEY = "wpbox.tailscale.manual-signout";

let autoLoginPromise: Promise<boolean> | null = null;

function parseTimeout(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function getWindowOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

export function getTailscaleAuthConfig(origin = getWindowOrigin()): TailscaleAuthConfig {
  const rawUrl = import.meta.env.VITE_TAILSCALE_AUTH_URL?.trim();
  return {
    authUrl: rawUrl ? rawUrl : null,
    origin,
    timeoutMs: parseTimeout(import.meta.env.VITE_TAILSCALE_AUTH_TIMEOUT_MS),
  };
}

export function isTailscaleSessionResponse(value: unknown): value is TailscaleSessionResponse {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const session = candidate.session;
  if (candidate.ok !== true || !session || typeof session !== "object") return false;

  const accessToken = (session as Record<string, unknown>).access_token;
  const refreshToken = (session as Record<string, unknown>).refresh_token;

  return typeof accessToken === "string" && accessToken.length > 0
    && typeof refreshToken === "string" && refreshToken.length > 0;
}

export function isTailscaleAutoLoginSuppressed(storage = typeof sessionStorage === "undefined" ? null : sessionStorage): boolean {
  return storage?.getItem(MANUAL_SIGNOUT_KEY) === "1";
}

export function suppressTailscaleAutoLogin(storage = typeof sessionStorage === "undefined" ? null : sessionStorage) {
  storage?.setItem(MANUAL_SIGNOUT_KEY, "1");
}

export function clearTailscaleAutoLoginSuppression(storage = typeof sessionStorage === "undefined" ? null : sessionStorage) {
  storage?.removeItem(MANUAL_SIGNOUT_KEY);
}

export function resetTailscaleAutoLoginState() {
  autoLoginPromise = null;
}

export async function requestTailscaleSession(
  config = getTailscaleAuthConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<SupabaseSessionTokens | null> {
  if (!config.authUrl || isTailscaleAutoLoginSuppressed()) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(config.authUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ origin: config.origin }),
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!isTailscaleSessionResponse(payload)) {
      return null;
    }

    return payload.session;
  } catch (_error) {
    return null;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function tryTailscaleAutoLogin(
  client: SessionSetter,
  config = getTailscaleAuthConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const session = await requestTailscaleSession(config, fetchImpl);
  if (!session) {
    return false;
  }

  const { error } = await client.auth.setSession(session);
  if (error) {
    return false;
  }

  clearTailscaleAutoLoginSuppression();
  return true;
}

export async function tryTailscaleAutoLoginOnce(
  client: SessionSetter,
  config = getTailscaleAuthConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!autoLoginPromise) {
    autoLoginPromise = tryTailscaleAutoLogin(client, config, fetchImpl).finally(() => {
      autoLoginPromise = null;
    });
  }

  return autoLoginPromise;
}
