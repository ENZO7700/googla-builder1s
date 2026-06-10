import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { Client } from "npm:ssh2@1.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Whitelist of allowed WP-CLI commands. Map -> actual `wp ...` arguments.
// IMPORTANT: never accept arbitrary commands from the client.
const COMMANDS: Record<string, { args: string; description: string }> = {
  "core-version":   { args: "core version",                        description: "WordPress core version" },
  "core-check":     { args: "core check-update --format=json",     description: "Check for core updates" },
  "cron-status":    { args: "cron event list --format=json",       description: "List scheduled cron events" },
  "cron-run-due":   { args: "cron event run --due-now",            description: "Run all due cron events" },
  "cache-flush":    { args: "cache flush",                         description: "Flush object cache" },
  "rewrite-flush":  { args: "rewrite flush",                       description: "Flush rewrite rules" },
  "transient-del":  { args: "transient delete --all",              description: "Delete all transients" },
  "plugin-list":    { args: "plugin list --format=json",           description: "List installed plugins" },
  "plugin-status":  { args: "plugin status --format=json",         description: "Plugin update status" },
  "theme-list":     { args: "theme list --format=json",            description: "List installed themes" },
  "db-size":        { args: "db size --tables --format=json",      description: "Database size per table" },
  "maint-on":       { args: "maintenance-mode activate",           description: "Enable maintenance mode" },
  "maint-off":      { args: "maintenance-mode deactivate",         description: "Disable maintenance mode" },
};

interface CliReq {
  siteId: string;
  command: keyof typeof COMMANDS;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function runSshCommand(opts: {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  cmd: string;
  timeoutMs?: number;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { conn.end(); } catch { /* noop */ }
      reject(new Error("SSH timeout"));
    }, opts.timeoutMs ?? 25_000);

    conn
      .on("ready", () => {
        conn.exec(opts.cmd, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            settled = true;
            conn.end();
            return reject(err);
          }
          stream
            .on("close", (code: number) => {
              clearTimeout(timer);
              settled = true;
              conn.end();
              resolve({ code: code ?? 0, stdout, stderr });
            })
            .on("data", (d: Buffer) => { stdout += d.toString("utf8"); })
            .stderr.on("data", (d: Buffer) => { stderr += d.toString("utf8"); });
        });
      })
      .on("error", (e) => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        reject(e);
      })
      .connect({
        host: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        privateKey: opts.privateKey,
        readyTimeout: 15_000,
      });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return jsonResponse({ error: "Invalid token" }, 403);

    const body = (await req.json().catch(() => null)) as CliReq | null;
    if (!body?.siteId || !body?.command || !COMMANDS[body.command]) {
      return jsonResponse({ error: "Bad request: siteId + valid command required", available: Object.keys(COMMANDS) }, 400);
    }

    const { data: site, error: siteErr } = await supabase
      .from("wp_sites")
      .select("*")
      .eq("id", body.siteId)
      .eq("user_id", user.id)
      .single();
    if (siteErr || !site) return jsonResponse({ error: "Site not found" }, 404);

    if (!site.ssh_host || !site.ssh_username) {
      return jsonResponse({ error: "SSH not configured for this site." }, 400);
    }

    const password = site.ssh_password_encrypted ? atob(site.ssh_password_encrypted) : undefined;
    const privateKey = site.ssh_private_key_encrypted ? atob(site.ssh_private_key_encrypted) : undefined;
    if (!password && !privateKey) {
      return jsonResponse({ error: "SSH password or private key required." }, 400);
    }

    const wpPath = site.wp_path ? String(site.wp_path).replace(/'/g, "") : "";
    const cdPart = wpPath ? `cd '${wpPath}' && ` : "";
    const cmdSpec = COMMANDS[body.command];
    const fullCmd = `${cdPart}wp ${cmdSpec.args} --no-color 2>&1`;

    const startedAt = Date.now();
    let result: { code: number; stdout: string; stderr: string } | null = null;
    let runError: string | null = null;
    try {
      result = await runSshCommand({
        host: site.ssh_host,
        port: site.ssh_port ?? 22,
        username: site.ssh_username,
        password,
        privateKey,
        cmd: fullCmd,
      });
    } catch (e) {
      runError = e instanceof Error ? e.message : String(e);
    }
    const durationMs = Date.now() - startedAt;

    const success = !runError && result?.code === 0;
    await supabase.from("wp_audit_log").insert({
      site_id: body.siteId,
      user_id: user.id,
      action: `wpcli:${body.command}`,
      resource_type: "wp-cli",
      resource_id: body.command,
      status: success ? "success" : "error",
      error_message: success ? null : (runError ?? `exit ${result?.code}`),
      details: {
        description: cmdSpec.description,
        cmd: cmdSpec.args,
        exit_code: result?.code ?? null,
        duration_ms: durationMs,
        stdout_preview: (result?.stdout ?? "").slice(0, 4000),
        stderr_preview: (result?.stderr ?? "").slice(0, 2000),
      },
    });

    if (runError) return jsonResponse({ error: runError, durationMs }, 502);
    return jsonResponse({
      ok: success,
      command: body.command,
      description: cmdSpec.description,
      exit_code: result?.code,
      duration_ms: durationMs,
      stdout: result?.stdout ?? "",
      stderr: result?.stderr ?? "",
    });
  } catch (e) {
    console.error("wordpress-cli error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
