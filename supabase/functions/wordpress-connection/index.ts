import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { encodeBasicAuth, encryptSecret } from "../_shared/wordpress-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SaveConnectionRequest {
  action: "save";
  siteId?: string;
  label: string;
  baseUrl: string;
  username: string;
  appPassword: string;
}

interface WpMeResponse {
  id?: number;
  name?: string;
  slug?: string;
  roles?: string[];
  capabilities?: Record<string, boolean>;
}

interface WpErrorResponse {
  message?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSaveConnectionRequest(body: unknown): body is SaveConnectionRequest {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return (
    value.action === "save" &&
    typeof value.label === "string" &&
    typeof value.baseUrl === "string" &&
    typeof value.username === "string" &&
    typeof value.appPassword === "string" &&
    (typeof value.siteId === "undefined" || typeof value.siteId === "string")
  );
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function validateBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("WordPress URL must start with http:// or https://");
  }
  return url.toString().replace(/\/+$/, "");
}

async function validateWordPressCredentials(input: {
  baseUrl: string;
  username: string;
  appPassword: string;
}) {
  const response = await fetch(`${input.baseUrl}/wp-json/wp/v2/users/me?context=edit`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${encodeBasicAuth(input.username, input.appPassword)}`,
    },
  });

  const body = await response.json().catch(() => null) as WpMeResponse | WpErrorResponse | null;
  if (!response.ok) {
    const message = response.status === 401
      ? "WordPress odmietol username alebo Application Password."
      : (body as WpErrorResponse | null)?.message ?? `WordPress returned HTTP ${response.status}`;
    return { ok: false as const, status: response.status, message };
  }

  const wpUser = body as WpMeResponse | null;
  return {
    ok: true as const,
    status: response.status,
    user: {
      id: wpUser?.id ?? 0,
      name: wpUser?.name ?? "WordPress user",
      slug: wpUser?.slug ?? "",
      roles: wpUser?.roles ?? [],
      capabilities: Object.entries(wpUser?.capabilities ?? {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .sort(),
    },
  };
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
    if (!isSaveConnectionRequest(rawBody)) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const baseUrl = validateBaseUrl(normalizeBaseUrl(rawBody.baseUrl));
    const label = rawBody.label.trim();
    const username = rawBody.username.trim();
    const appPassword = rawBody.appPassword.trim();

    if (!label || !username || !appPassword) {
      return jsonResponse({ error: "Label, username and Application Password are required" }, 400);
    }

    const validation = await validateWordPressCredentials({ baseUrl, username, appPassword });
    if (!validation.ok) {
      return jsonResponse({
        ok: false,
        error: validation.message,
        httpStatus: validation.status,
      }, 400);
    }

    const encryptedAppPassword = await encryptSecret(appPassword);
    const sitePayload = {
      user_id: user.id,
      label,
      base_url: baseUrl,
      site_type: "self",
      username,
      app_password_encrypted: encryptedAppPassword,
    };

    const query = rawBody.siteId
      ? supabase
        .from("wp_sites")
        .update(sitePayload)
        .eq("id", rawBody.siteId)
        .eq("user_id", user.id)
        .select("id,label,base_url,site_type,username,last_sync_at,created_at")
        .single()
      : supabase
        .from("wp_sites")
        .insert(sitePayload)
        .select("id,label,base_url,site_type,username,last_sync_at,created_at")
        .single();

    const { data: site, error: siteError } = await query;
    if (siteError || !site) {
      return jsonResponse({ error: siteError?.message ?? "Could not save WordPress site" }, 500);
    }

    await supabase.from("wp_audit_log").insert({
      site_id: site.id,
      user_id: user.id,
      action: rawBody.siteId ? "connection_update" : "connection_create",
      resource_type: "wp_sites",
      resource_id: site.id,
      status: "success",
      details: {
        base_url: baseUrl,
        username,
        wp_user_id: validation.user.id,
        wp_user_roles: validation.user.roles,
      },
    });

    return jsonResponse({
      ok: true,
      site,
      wpUser: validation.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
