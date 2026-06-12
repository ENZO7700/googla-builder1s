// Test SSH connectivity for a wp_sites record OR with inline credentials,
// before persisting changes. Runs a trivial `echo ok` and optionally `wp --info`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { Client } from "npm:ssh2@1.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_B64 = Deno.env.get("WP_CREDS_ENCRYPTION_KEY") ?? "";

let _aesKey: CryptoKey | null = null;
async function getAesKey() {
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
  const key = await getAesKey();
  const bin = atob(stored.slice(7));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function runSsh(opts: {
  host: string; port: number; username: string;
  password?: string; privateKey?: string; cmd: string; timeoutMs?: number;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = ""; let stderr = ""; let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true; try { conn.end(); } catch { /* noop */ }
      reject(new Error("SSH timeout (15s)"));
    }, opts.timeoutMs ?? 15_000);
    conn.on("ready", () => {
      conn.exec(opts.cmd, (err, stream) => {
        if (err) { clearTimeout(timer); settled = true; conn.end(); return reject(err); }
        stream
          .on("close", (code: number) => {
            clearTimeout(timer); settled = true; conn.end();
            resolve({ code: code ?? 0, stdout, stderr });
          })
          .on("data", (d: Buffer) => { stdout += d.toString("utf8"); })
          .stderr.on("data", (d: Buffer) => { stderr += d.toString("utf8"); });
      });
    }).on("error", (e) => {
      if (settled) return; clearTimeout(timer); settled = true; reject(e);
    }).connect({
      host: opts.host, port: opts.port, username: opts.username,
      password: opts.password, privateKey: opts.privateKey, readyTimeout: 12_000,
    });
  });
}

const HOST_RE = /^[a-zA-Z0-9.\-_]{1,253}$/;
const USER_RE = /^[a-zA-Z0-9._\-]{1,64}$/;
const PATH_RE = /^(\/[a-zA-Z0-9._\-]+)+\/?$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return json({ error: "Invalid token" }, 403);

    const body = await req.json().catch(() => null) as null | {
      siteId?: string;
      ssh_host?: string; ssh_port?: number; ssh_username?: string;
      ssh_password?: string; ssh_private_key?: string; wp_path?: string;
    };
    if (!body) return json({ error: "Invalid body" }, 400);

    let host = body.ssh_host?.trim();
    let port = Number(body.ssh_port ?? 22);
    let username = body.ssh_username?.trim();
    let password = body.ssh_password || undefined;
    let privateKey = body.ssh_private_key || undefined;
    let wpPath = body.wp_path?.trim() || "";

    // Fall back to stored creds for any field not provided.
    if (body.siteId) {
      const { data: site, error: siteErr } = await supabase
        .from("wp_sites").select("*").eq("id", body.siteId).eq("user_id", user.id).single();
      if (siteErr || !site) return json({ error: "Site not found" }, 404);
      host ||= site.ssh_host || undefined;
      if (!body.ssh_port) port = site.ssh_port ?? 22;
      username ||= site.ssh_username || undefined;
      wpPath ||= site.wp_path || "";
      if (!password) password = await decryptCred(site.ssh_password_encrypted);
      if (!privateKey) privateKey = await decryptCred(site.ssh_private_key_encrypted);
    }

    if (!host || !HOST_RE.test(host)) return json({ error: "Neplatný SSH host" }, 400);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return json({ error: "Neplatný port (1-65535)" }, 400);
    if (!username || !USER_RE.test(username)) return json({ error: "Neplatný username" }, 400);
    if (wpPath && !PATH_RE.test(wpPath)) return json({ error: "Neplatná wp_path (musí byť absolútna unixová cesta)" }, 400);
    if (!password && !privateKey) return json({ error: "Vyžaduje sa heslo alebo privátny kľúč" }, 400);
    if (privateKey && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey)) {
      return json({ error: "Privátny kľúč musí byť vo formáte PEM (BEGIN/END PRIVATE KEY)" }, 400);
    }

    const cdPart = wpPath ? `cd '${wpPath.replace(/'/g, "")}' && ` : "";
    const cmd = `${cdPart}echo __ssh_ok__ && (command -v wp >/dev/null 2>&1 && wp --info --no-color 2>&1 | head -n 5 || echo "wp CLI not found")`;

    const startedAt = Date.now();
    try {
      const r = await runSsh({ host, port, username, password, privateKey, cmd });
      const durationMs = Date.now() - startedAt;
      const ok = r.code === 0 && r.stdout.includes("__ssh_ok__");
      const wpAvailable = !r.stdout.includes("wp CLI not found");
      return json({
        ok, duration_ms: durationMs, exit_code: r.code,
        wp_cli_available: wpAvailable,
        stdout: r.stdout.slice(0, 1500), stderr: r.stderr.slice(0, 500),
      });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - startedAt }, 200);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
