/**
 * Helpers for normalizing wordpress-cct-proxy errors.
 */

const CCT_ROUTE = '/wp-json/jet-cct/services';
const CCT_SETUP_HINT =
  'Zapni JetEngine > Custom Content Types > services > REST API endpointy na WordPress webe.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function routeMissingMessage(): string {
  return `WordPress CCT endpoint ${CCT_ROUTE} nie je na tomto webe registrovaný. ${CCT_SETUP_HINT}`;
}

/**
 * Normalize already-parsed proxy payloads.
 * Used both for direct JSON responses and for text bodies that we decode elsewhere.
 */
export function normalizeCctProxyErrorPayload(
  payload: unknown,
  fallback = 'Edge function call failed',
): string {
  if (isRecord(payload)) {
    if (payload.ok === false) {
      if (typeof payload.error === 'string' && payload.error.trim()) {
        const error = payload.error.trim();
        if (/rest_no_route/i.test(error) || /jet-cct/i.test(error)) {
          return routeMissingMessage();
        }

        if (typeof payload.details === 'string' && payload.details.trim()) {
          return `${error} ${payload.details.trim()}`;
        }

        return error;
      }
    }

    if (typeof payload.code === 'string' && payload.code === 'rest_no_route') {
      return routeMissingMessage();
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      const message = payload.message.trim();
      if (/rest_no_route/i.test(message) || /Nebola nájdená žiadna cesta/i.test(message)) {
        return routeMissingMessage();
      }

      if (typeof payload.details === 'string' && payload.details.trim()) {
        return `${message} ${payload.details.trim()}`;
      }

      return message;
    }
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) {
      return fallback;
    }

    if (/rest_no_route/i.test(trimmed) || /Nebola nájdená žiadna cesta/i.test(trimmed)) {
      return routeMissingMessage();
    }

    return trimmed;
  }

  return fallback;
}

/**
 * Read a Supabase edge-function invoke error and extract the best message we can.
 */
export async function normalizeCctProxyInvokeError(
  error: unknown,
  fallback = 'Edge function call failed',
): Promise<string> {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const text = await error.context.clone().text();
      if (text.trim()) {
        try {
          return normalizeCctProxyErrorPayload(JSON.parse(text), fallback);
        } catch {
          return normalizeCctProxyErrorPayload(text, fallback);
        }
      }
    } catch {
      // fall through to generic handling
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
