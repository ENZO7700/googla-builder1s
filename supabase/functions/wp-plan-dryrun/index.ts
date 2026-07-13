// Dry-run planner for WP mutations. Captures "before" state, computes a
// human-readable diff, stores a snapshot with a single-use proceed_token
// (TTL 60s) and returns it. Actual mutation happens in wp-plan-apply.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mutation types the planner knows how to revert.
type PlannedCall =
  | { scope: "rest"; method: "POST" | "PATCH" | "PUT" | "DELETE"; path: string; body?: unknown }
  | { scope: "cli"; command: string };

// CLI mutations that are inherently non-revertible.
const NON_REVERTIBLE_CLI = new Set(["cache-flush", "rewrite-flush", "transient-del", "cron-run-due"]);

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

function shallowDiff(before: Record<string, unknown> | null | undefined, patch: Record<string, unknown> | undefined) {
  const changes: Array<{ key: string; before: unknown; after: unknown }> = [];
  if (!patch) return changes;
  for (const k of Object.keys(patch)) {
    const b = before?.[k];
    const a = patch[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ key: k, before: b ?? null, after: a });
  }
  return changes;
}

function guessTarget(call: PlannedCall): string {
  if (call.scope === "rest") return `${call.method} ${call.path}`;
  return `wp ${call.command}`;
}

function riskFor(call: PlannedCall): "low" | "medium" | "high" {
  if (call.scope === "cli") {
    if (["maint-on", "maint-off"].includes(call.command)) return "medium";
    if (NON_REVERTIBLE_CLI.has(call.command)) return "low";
    return "medium";
  }
  if (call.method === "DELETE") return "high";
  if (call.path.startsWith("settings")) return "high";
  if (call.path.startsWith("plugins") || call.path.startsWith("themes")) return "high";
  return "medium";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return json({ error: "Invalid token" }, 403);

    const body = (await req.json().catch(() => null)) as { siteId?: string; call?: PlannedCall } | null;
    if (!body?.siteId || !body?.call) return json({ error: "siteId and call required" }, 400);

    // Verify ownership
    const { data: site, error: siteErr } = await supabase
      .from("wp_sites").select("id,user_id").eq("id", body.siteId).eq("user_id", user.id).single();
    if (siteErr || !site) return json({ error: "Site not found" }, 404);

    // Capture "before" state for revertible mutations.
    let before_json: unknown = null;
    let revertible = true;
    let planned_patch: Record<string, unknown> | null = null;

    if (body.call.scope === "rest") {
      const call = body.call;
      // For collection resources with an id → GET the resource first.
      const looksLikeResource = /^[a-z_-]+\/\d+/i.test(call.path);
      if (looksLikeResource && call.method !== "POST") {
        const { data } = await callInternal("wordpress-proxy", auth, {
          siteId: body.siteId, method: "GET", path: call.path,
        });
        before_json = data;
      } else if (call.path === "settings") {
        const { data } = await callInternal("wordpress-proxy", auth, {
          siteId: body.siteId, method: "GET", path: "settings",
        });
        before_json = data;
      } else {
        revertible = call.method !== "POST"; // creation isn't reverted by data snapshot
      }
      planned_patch = (call.body as Record<string, unknown>) ?? null;
    } else {
      // CLI
      if (NON_REVERTIBLE_CLI.has(body.call.command)) revertible = false;
      // best-effort snapshot: for plugin/theme mutations, capture list
      if (["maint-on", "maint-off"].includes(body.call.command)) {
        before_json = { maintenance: body.call.command === "maint-on" ? "off" : "on" };
      }
    }

    const proceed_token = crypto.randomUUID() + "." + crypto.randomUUID();
    const token_expires_at = new Date(Date.now() + 60_000).toISOString();
    const risk = riskFor(body.call);

    const { data: snap, error: snapErr } = await supabase.from("wp_action_snapshots").insert({
      site_id: body.siteId,
      user_id: user.id,
      scope: body.call.scope,
      target: guessTarget(body.call),
      before_json,
      planned_patch,
      planned_call: body.call,
      risk,
      proceed_token,
      token_expires_at,
      status: "planned",
    }).select("id").single();
    if (snapErr) return json({ error: snapErr.message }, 500);

    const diff = body.call.scope === "rest" && planned_patch
      ? shallowDiff(before_json as Record<string, unknown> | null, planned_patch)
      : [];

    return json({
      snapshotId: snap.id,
      proceedToken: proceed_token,
      expiresAt: token_expires_at,
      target: guessTarget(body.call),
      risk,
      revertible,
      before: before_json,
      plannedPatch: planned_patch,
      diff,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
