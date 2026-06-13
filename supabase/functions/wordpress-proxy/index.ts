import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { decryptSecret, encodeBasicAuth } from "../_shared/wordpress-credentials.ts";
import { normalizeRequestPath } from "./path.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProxyRequest {
  siteId: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const WORDPRESS_COM_API_KEY = Deno.env.get("WORDPRESS_COM_API_KEY");
const WORDPRESS_PROXY_TIMEOUT_MS = 25_000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logProxyAction({
  siteId,
  userId,
  method,
  path,
  query,
  status,
  errorMessage,
}: {
  siteId: string;
  userId: string;
  method: ProxyRequest["method"];
  path: string;
  query?: Record<string, string>;
  status: number;
  errorMessage?: string | null;
}) {
  await supabase.from("wp_audit_log").insert({
    site_id: siteId,
    user_id: userId,
    action: method.toLowerCase(),
    resource_type: path.split("/")[0] || null,
    resource_id: path.split("/")[1] || null,
    details: { path, status, query: query ?? null },
    status: status >= 200 && status < 300 ? "success" : "error",
    error_message: errorMessage ?? null,
  });
}

function isValidRequest(b: unknown): b is ProxyRequest {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  const normalizedPath = typeof r.path === "string" ? normalizeRequestPath(r.path) : null;
  return (
    typeof r.siteId === "string" &&
    typeof r.method === "string" &&
    ["GET", "POST", "PATCH", "DELETE"].includes(r.method) &&
    normalizedPath !== null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 403);
    }

    const rawBody = await req.json().catch(() => null);
    if (!isValidRequest(rawBody)) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
    const { siteId, method, body, query } = rawBody;
    const path = normalizeRequestPath(rawBody.path)!;

    // Load site, scoped to current user
    const { data: site, error: siteError } = await supabase
      .from("wp_sites")
      .select("*")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single();

    if (siteError || !site) {
      return jsonResponse({ error: "Site not found" }, 404);
    }

    // Build target URL + headers depending on site type
    let targetUrl: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (site.site_type === "self") {
      const base = String(site.base_url).replace(/\/+$/, "");
      // If path starts with a slash, treat it as relative to /wp-json/
      // Otherwise, treat it as relative to /wp-json/wp/v2/
      const apiPath = path.startsWith("/") ? path : `/wp/v2/${path}`;
      targetUrl = `${base}/wp-json${apiPath}`;
      if (site.username && site.app_password_encrypted) {
        const appPassword = await decryptSecret(String(site.app_password_encrypted));
        headers["Authorization"] = `Basic ${encodeBasicAuth(String(site.username), appPassword)}`;
      }
    } else {
      // WordPress.com via Lovable connector gateway
      if (!LOVABLE_API_KEY || !WORDPRESS_COM_API_KEY) {
        return jsonResponse(
          { error: "WordPress.com connector not linked. Connect 'WordPress.com' in Connectors." },
          503,
        );
      }
      const host = String(site.base_url).replace(/^https?:\/\//, "").replace(/\/+$/, "");
      // Map standard /wp/v2 path to wp.com REST v1.1 site-scoped paths.
      // Most resources align: posts, pages, media, comments, users, settings, plugins.
      const wpComPath = path.startsWith("/wp/v2/") ? path.slice("/wp/v2/".length) : path.replace(/^\/+/, "");
      targetUrl = `https://connector-gateway.lovable.dev/wordpress_com/rest/v1.1/sites/${encodeURIComponent(host)}/${wpComPath}`;
      headers["Authorization"] = `Bearer ${LOVABLE_API_KEY}`;
      headers["X-Connection-Api-Key"] = WORDPRESS_COM_API_KEY;
    }

    if (query && Object.keys(query).length > 0) {
      const qp = new URLSearchParams(query);
      targetUrl += (targetUrl.includes("?") ? "&" : "?") + qp.toString();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WORDPRESS_PROXY_TIMEOUT_MS);
    let proxyResponse: Response;

    try {
      proxyResponse = await fetch(targetUrl, {
        method,
        headers,
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const timeoutMessage = `WordPress request timed out after ${WORDPRESS_PROXY_TIMEOUT_MS / 1000}s`;
        await logProxyAction({
          siteId,
          userId: user.id,
          method,
          path,
          query,
          status: 504,
          errorMessage: timeoutMessage,
        });
        return jsonResponse({ error: timeoutMessage }, 504);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await proxyResponse.text();
    let responseData: unknown;
    try {
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = { raw: text };
    }

    // Audit log (best effort)
    await logProxyAction({
      siteId,
      userId: user.id,
      method,
      path,
      query,
      status: proxyResponse.status,
      errorMessage: !proxyResponse.ok
        ? (responseData as { message?: string })?.message ?? `HTTP ${proxyResponse.status}`
        : null,
    });

    // Forward important headers
    const responseHeaders = { 
      ...corsHeaders, 
      "Content-Type": "application/json",
      "X-WP-Total": proxyResponse.headers.get("X-WP-Total") || "0",
      "X-WP-TotalPages": proxyResponse.headers.get("X-WP-TotalPages") || "0",
    };

    return new Response(JSON.stringify(responseData), {
      status: proxyResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("wordpress-proxy error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
