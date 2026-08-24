/**
 * Sanitize server-side errors before returning them to clients.
 * Prevents leaking env var names, stack traces, or internal paths in 5xx responses.
 */

const INTERNAL_ERROR = "Internal server error";

/** Patterns that indicate sensitive or internal details in error text. */
const SENSITIVE_PATTERNS = [
  /\bat\s+[\w./-]+:\d+:\d+\b/i,
  /\/(?:supabase|functions|node_modules)\//i,
  /\b[A-Z][A-Z0-9_]{2,}\b.*(?:not configured|is not set|missing|required)/i,
  /\b(?:password|secret|token|credential|api[_-]?key|private[_-]?key)\b/i,
  /ENOENT|ECONNREFUSED|EACCES|EPERM/i,
];

/**
 * Returns a client-safe error string. Falls back to a generic message when
 * the raw text looks like an internal/stack/config leak.
 */
export function sanitizeClientError(raw: string, fallback = INTERNAL_ERROR): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.includes("\n    at ") || trimmed.includes("\n\tat ")) return fallback;
  if (SENSITIVE_PATTERNS.some((re) => re.test(trimmed))) return fallback;
  return trimmed;
}

export function internalErrorBody(): { error: string } {
  return { error: INTERNAL_ERROR };
}

export function logAndSanitize(err: unknown, logPrefix = "edge function"): string {
  console.error(`${logPrefix} error:`, err);
  const raw = err instanceof Error ? err.message : String(err);
  return sanitizeClientError(raw);
}

export function jsonInternalError(
  err: unknown,
  corsHeaders: Record<string, string>,
  logPrefix = "edge function",
  status = 500,
): Response {
  logAndSanitize(err, logPrefix);
  return new Response(JSON.stringify(internalErrorBody()), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
