/**
 * wordpress-cct-proxy — Supabase Edge Function
 *
 * Secure proxy for JetEngine Custom Content Type REST endpoints.
 * Reuses credential decrypt, audit log, and CORS patterns from wordpress-proxy.
 *
 * Allowed CCT slugs: ["services"] (allowlist, not arbitrary).
 * No credentials are ever exposed to the frontend.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { decryptSecret, encodeBasicAuth } from "../_shared/wordpress-credentials.ts";

// ==================== CONSTANTS ====================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Allowlisted CCT slugs — only these can be proxied. */
const ALLOWED_CCT_SLUGS = ["services"] as const;
type AllowedCct = (typeof ALLOWED_CCT_SLUGS)[number];

const ALLOWED_ACTIONS = ["list", "get", "create", "update", "delete"] as const;
type CctAction = (typeof ALLOWED_ACTIONS)[number];

// ==================== REQUEST TYPES ====================

interface CctProxyRequest {
  siteId: string;
  cct: AllowedCct;
  action: CctAction;
  itemId?: number;
  payload?: Record<string, unknown>;
  confirm?: boolean;
}

// ==================== HELPERS ====================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(error: string, status: number, details?: string): Response {
  return jsonResponse({ ok: false, error, ...(details ? { details } : {}) }, status);
}

function isValidUuid(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// ==================== VALIDATION ====================

function validateRequest(raw: unknown): { ok: true; data: CctProxyRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const r = raw as Record<string, unknown>;

  // siteId
  if (!isValidUuid(r.siteId)) {
    return { ok: false, error: "siteId must be a valid UUID." };
  }

  // cct
  if (typeof r.cct !== "string" || !(ALLOWED_CCT_SLUGS as readonly string[]).includes(r.cct)) {
    return { ok: false, error: `cct must be one of: ${ALLOWED_CCT_SLUGS.join(", ")}` };
  }

  // action
  if (typeof r.action !== "string" || !(ALLOWED_ACTIONS as readonly string[]).includes(r.action)) {
    return { ok: false, error: `action must be one of: ${ALLOWED_ACTIONS.join(", ")}` };
  }

  const action = r.action as CctAction;

  // itemId required for get/update/delete
  if (["get", "update", "delete"].includes(action)) {
    if (!isPositiveInt(r.itemId)) {
      return { ok: false, error: `itemId must be a positive integer for action "${action}".` };
    }
  }

  // payload required for create/update
  if (["create", "update"].includes(action)) {
    if (!r.payload || typeof r.payload !== "object" || Array.isArray(r.payload)) {
      return { ok: false, error: `payload must be a non-empty object for action "${action}".` };
    }
    // Minimal content validation: title and slug required for create
    if (action === "create") {
      const p = r.payload as Record<string, unknown>;
      if (typeof p.title !== "string" || !p.title.trim()) {
        return { ok: false, error: "payload.title is required for create." };
      }
      if (typeof p.slug !== "string" || !p.slug.trim()) {
        return { ok: false, error: "payload.slug is required for create." };
      }
    }
  }

  // delete requires explicit confirm
  if (action === "delete" && r.confirm !== true) {
    return { ok: false, error: "delete requires confirm: true." };
  }

  return {
    ok: true,
    data: {
      siteId: r.siteId as string,
      cct: r.cct as AllowedCct,
      action,
      itemId: r.itemId as number | undefined,
      payload: r.payload as Record<string, unknown> | undefined,
      confirm: r.confirm as boolean | undefined,
    },
  };
}

// ==================== ROUTE BUILDER ====================

function buildWpRoute(
  cct: AllowedCct,
  action: CctAction,
  itemId?: number,
): { method: string; path: string } {
  const basePath = `jet-cct/${cct}`;

  switch (action) {
    case "list":
      return { method: "GET", path: basePath };
    case "get":
      return { method: "GET", path: `${basePath}/${itemId}` };
    case "create":
      return { method: "POST", path: basePath };
    case "update":
      return { method: "POST", path: `${basePath}/${itemId}` };
    case "delete":
      return { method: "DELETE", path: `${basePath}/${itemId}` };
  }
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only POST allowed (proxy always receives POST from frontend)
  if (req.method !== "POST") {
    return jsonError("Method not allowed. Use POST.", 405);
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonError("Invalid token", 403);
    }

    // ---- Parse & validate request ----
    const rawBody = await req.json().catch(() => null);
    const validation = validateRequest(rawBody);
    if (!validation.ok) {
      return jsonError(validation.error, 400);
    }

    const { siteId, cct, action, itemId, payload } = validation.data;

    // ---- Load site (scoped to user) ----
    const { data: site, error: siteError } = await supabase
      .from("wp_sites")
      .select("*")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !site) {
      return jsonError("Site not found or access denied.", 404);
    }

    // Only self-hosted WordPress is supported for CCT proxy
    if (site.site_type !== "self") {
      return jsonError("CCT proxy is only supported for self-hosted WordPress sites.", 400);
    }

    // ---- Build credentials ----
    if (!site.username || !site.app_password_encrypted) {
      return jsonError(
        "WordPress Application Password not configured for this site.",
        400,
      );
    }

    const appPassword = await decryptSecret(String(site.app_password_encrypted));
    const basicAuth = `Basic ${encodeBasicAuth(String(site.username), appPassword)}`;

    // ---- Build target URL ----
    const base = String(site.base_url).replace(/\/+$/, "");
    const route = buildWpRoute(cct, action, itemId);
    const targetUrl = `${base}/wp-json/${route.path}`;

    // ---- Execute WordPress request ----
    const wpResponse = await fetch(targetUrl, {
      method: route.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: payload && route.method !== "GET" ? JSON.stringify(payload) : undefined,
    });

    const text = await wpResponse.text();
    let responseData: unknown;
    try {
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = { raw: text };
    }

    // ---- Audit log (best effort) ----
    await supabase
      .from("wp_audit_log")
      .insert({
        site_id: siteId,
        user_id: user.id,
        action: `cct.${cct}.${action}`,
        resource_type: `cct_${cct}`,
        resource_id: itemId ? String(itemId) : null,
        details: {
          cct,
          action,
          item_id: itemId ?? null,
          status: wpResponse.status,
          has_payload: !!payload,
        },
        status: wpResponse.ok ? "success" : "error",
        error_message: !wpResponse.ok
          ? (responseData as { message?: string })?.message ?? `HTTP ${wpResponse.status}`
          : null,
      })
      .then(() => {}) // fire-and-forget
      .catch((e) => console.error("Audit log error:", e));

    // ---- Return response ----
    return new Response(JSON.stringify(responseData), {
      status: wpResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("wordpress-cct-proxy error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(message, 500);
  }
});
