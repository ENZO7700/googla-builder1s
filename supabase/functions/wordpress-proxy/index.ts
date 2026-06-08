import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

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
const ENC_KEY_B64 = Deno.env.get("WP_CREDS_ENCRYPTION_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let _aesKey: CryptoKey | null = null;
async function _getAesKey() {
  if (_aesKey) return _aesKey;
  const bin = atob(ENC_KEY_B64);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  if (raw.length !== 32) throw new Error("WP_CREDS_ENCRYPTION_KEY must decode to 32 bytes");
  _aesKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  return _aesKey;
}
async function decryptCred(stored: string | null | undefined): Promise<string | undefined> {
  if (!stored) return undefined;
  if (!stored.startsWith("enc:v1:")) { try { return atob(stored); } catch { return undefined; } }
  const key = await _getAesKey();
  const bin = atob(stored.slice(7));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidRequest(b: unknown): b is ProxyRequest {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  return (
    typeof r.siteId === "string" &&
    typeof r.method === "string" &&
    ["GET", "POST", "PATCH", "DELETE"].includes(r.method) &&
    typeof r.path === "string" &&
    !r.path.startsWith("/") &&
    !r.path.includes("..")
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
    const { siteId, method, path, body, query } = rawBody;

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
      targetUrl = `${base}/wp-json/wp/v2/${path}`;
      if (site.username && site.app_password_encrypted) {
        const appPassword = await decryptCred(site.app_password_encrypted);
        if (appPassword) {
          const credentials = btoa(`${site.username}:${appPassword}`);
          headers["Authorization"] = `Basic ${credentials}`;
        }
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
      targetUrl = `https://connector-gateway.lovable.dev/wordpress_com/rest/v1.1/sites/${encodeURIComponent(host)}/${path}`;
      headers["Authorization"] = `Bearer ${LOVABLE_API_KEY}`;
      headers["X-Connection-Api-Key"] = WORDPRESS_COM_API_KEY;
    }

    if (query && Object.keys(query).length > 0) {
      const qp = new URLSearchParams(query);
      targetUrl += (targetUrl.includes("?") ? "&" : "?") + qp.toString();
    }

    const proxyResponse = await fetch(targetUrl, {
      method,
      headers,
      body: body && method !== "GET" ? JSON.stringify(body) : undefined,
    });

    const text = await proxyResponse.text();
    let responseData: unknown;
    try {
      responseData = text ? JSON.parse(text) : null;
    } catch {
      responseData = { raw: text };
    }

    // Audit log (best effort)
    await supabase.from("wp_audit_log").insert({
      site_id: siteId,
      user_id: user.id,
      action: method.toLowerCase(),
      resource_type: path.split("/")[0] || null,
      resource_id: path.split("/")[1] || null,
      details: { path, status: proxyResponse.status, query: query ?? null },
      status: proxyResponse.ok ? "success" : "error",
      error_message: !proxyResponse.ok
        ? (responseData as { message?: string })?.message ?? `HTTP ${proxyResponse.status}`
        : null,
    });

    return new Response(JSON.stringify(responseData), {
      status: proxyResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("wordpress-proxy error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
