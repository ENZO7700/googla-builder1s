// Create or update a WP site row with server-side AES-256-GCM encryption
// of credentials (app password, SSH password, SSH private key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeWpBaseUrl } from "../_shared/wp-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_B64 = Deno.env.get("WP_CREDS_ENCRYPTION_KEY")!;

function b64ToBytes(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(b: Uint8Array) {
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

let cryptoKey: CryptoKey | null = null;
async function getKey() {
  if (cryptoKey) return cryptoKey;
  const raw = b64ToBytes(ENC_KEY_B64);
  if (raw.length !== 32) throw new Error("WP_CREDS_ENCRYPTION_KEY must decode to 32 bytes");
  cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return cryptoKey;
}
async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0); combined.set(ct, iv.length);
  return `enc:v1:${bytesToB64(combined)}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => null) as null | {
      id?: string;
      label?: string;
      base_url?: string;
      site_type?: "com" | "self";
      username?: string;
      app_password?: string;
      ssh_host?: string;
      ssh_port?: number;
      ssh_username?: string;
      ssh_password?: string;
      ssh_private_key?: string;
      wp_path?: string;
    };
    if (!body) return jsonResponse({ error: "Invalid body" }, 400);

    if (body.label !== undefined && (typeof body.label !== "string" || body.label.length < 1 || body.label.length > 200)) {
      return jsonResponse({ error: "label length invalid" }, 400);
    }
    if (body.base_url !== undefined) {
      try { const u = new URL(normalizeWpBaseUrl(body.base_url)); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error("scheme"); }
      catch { return jsonResponse({ error: "base_url must be a valid http(s) URL" }, 400); }
    }
    if (body.site_type && !["com", "self"].includes(body.site_type)) {
      return jsonResponse({ error: "site_type invalid" }, 400);
    }

    const baseUrlClean = body.base_url ? normalizeWpBaseUrl(body.base_url) : undefined;
    const update: Record<string, unknown> = { user_id: user.id };
    if (body.label !== undefined) update.label = body.label;
    if (baseUrlClean !== undefined) update.base_url = baseUrlClean;
    if (body.site_type !== undefined) update.site_type = body.site_type;
    if (body.username !== undefined) update.username = body.username;
    if (body.ssh_host !== undefined) update.ssh_host = body.ssh_host;
    if (body.ssh_port !== undefined) update.ssh_port = body.ssh_port;
    if (body.ssh_username !== undefined) update.ssh_username = body.ssh_username;
    if (body.wp_path !== undefined) update.wp_path = body.wp_path;

    if (body.app_password) update.app_password_encrypted = await encrypt(body.app_password);
    if (body.ssh_password) update.ssh_password_encrypted = await encrypt(body.ssh_password);
    if (body.ssh_private_key) update.ssh_private_key_encrypted = await encrypt(body.ssh_private_key);

    if (body.id) {
      const { error } = await supabase.from("wp_sites").update(update).eq("id", body.id).eq("user_id", user.id);
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true, id: body.id });
    } else {
      const { data, error } = await supabase.from("wp_sites").insert(update).select("id").single();
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true, id: data.id });
    }
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
