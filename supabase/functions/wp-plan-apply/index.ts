// Applies a previously planned WP mutation by proceed_token. If the mutation
// fails (HTTP ≥ 400 for REST, exit_code ≠ 0 for CLI) and a revertible
// snapshot exists, automatically restores the "before" state and marks the
// snapshot as rolled_back. Everything is logged to wp_audit_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callInternal(fn: string, authHeader: string, body: unknown) {
  const url = `${SUPABASE_URL}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  return { status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return json({ error: "Invalid token" }, 403);

    const body = (await req.json().catch(() => null)) as { proceedToken?: string } | null;
    if (!body?.proceedToken) return json({ error: "proceedToken required" }, 400);

    const { data: snap, error: snapErr } = await supabase.from("wp_action_snapshots")
      .select("*").eq("proceed_token", body.proceedToken).eq("user_id", user.id).single();
    if (snapErr || !snap) return json({ error: "Snapshot not found" }, 404);
    if (snap.status !== "planned") return json({ error: `Snapshot already ${snap.status}` }, 409);
    if (new Date(snap.token_expires_at).getTime() < Date.now()) {
      await supabase.from("wp_action_snapshots").update({ status: "expired" }).eq("id", snap.id);
      return json({ error: "proceed token expired" }, 410);
    }

    const call = snap.planned_call as
      | { scope: "rest"; method: "POST" | "PATCH" | "PUT" | "DELETE"; path: string; body?: unknown }
      | { scope: "cli"; command: string };

    let ok = false;
    let result_json: unknown = null;
    let error: string | null = null;
    let rolled_back = false;

    if (call.scope === "rest") {
      const r = await callInternal("wordpress-proxy", auth, {
        siteId: snap.site_id, method: call.method, path: call.path, body: call.body,
      });
      result_json = r.data;
      ok = r.status < 400;
      if (!ok) error = `HTTP ${r.status}`;
    } else {
      const r = await callInternal("wordpress-cli", auth, {
        siteId: snap.site_id, command: call.command,
      });
      result_json = r.data;
      const cliResp = r.data as { ok?: boolean; exit_code?: number; error?: string } | null;
      ok = r.status < 400 && cliResp?.ok === true && cliResp?.exit_code === 0;
      if (!ok) error = cliResp?.error ?? `exit ${cliResp?.exit_code ?? "?"}`;
    }

    // Rollback path for revertible REST mutations
    if (!ok && call.scope === "rest" && snap.before_json && /^[a-z_-]+\/\d+/i.test(call.path)) {
      try {
        await callInternal("wordpress-proxy", auth, {
          siteId: snap.site_id, method: "PATCH", path: call.path, body: snap.before_json,
        });
        rolled_back = true;
      } catch (_) { /* rollback best-effort */ }
    } else if (!ok && call.scope === "cli" && call.command === "maint-on") {
      try {
        await callInternal("wordpress-cli", auth, { siteId: snap.site_id, command: "maint-off" });
        rolled_back = true;
      } catch (_) { /* noop */ }
    }

    await supabase.from("wp_action_snapshots").update({
      status: ok ? "applied" : (rolled_back ? "rolled_back" : "failed"),
      applied_at: ok ? new Date().toISOString() : null,
      rolled_back_at: rolled_back ? new Date().toISOString() : null,
      result_json,
      error,
    }).eq("id", snap.id);

    await supabase.from("wp_audit_log").insert({
      site_id: snap.site_id,
      user_id: user.id,
      action: `plan-apply:${call.scope}`,
      resource_type: call.scope,
      resource_id: snap.target,
      status: ok ? "success" : "error",
      error_message: error,
      details: {
        snapshotId: snap.id,
        target: snap.target,
        rollback: rolled_back,
        call,
      },
    });

    return json({ ok, snapshotId: snap.id, target: snap.target, rolled_back, result: result_json, error });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
