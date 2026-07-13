// Production Readiness Suite for a WP site: runs a battery of checks in
// parallel via existing edge functions (wordpress-proxy, wordpress-cli,
// wp-ssh-test) plus a handful of direct fetches, returns a 0-100 scorecard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type CheckResult = {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail" | "skip";
  weight: number;
  detail?: string;
  data?: unknown;
  duration_ms: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callInternal(fn: string, authHeader: string, body: unknown, timeoutMs = 20_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* raw */ }
    return { status: res.status, data };
  } finally { clearTimeout(t); }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; error: string | null; ms: number }> {
  const s = Date.now();
  try { return { value: await fn(), error: null, ms: Date.now() - s }; }
  catch (e) { return { value: null, error: e instanceof Error ? e.message : String(e), ms: Date.now() - s }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return json({ error: "Invalid token" }, 403);

    const body = (await req.json().catch(() => null)) as { siteId?: string } | null;
    if (!body?.siteId) return json({ error: "siteId required" }, 400);

    const { data: site, error: siteErr } = await supabase
      .from("wp_sites").select("*").eq("id", body.siteId).eq("user_id", user.id).single();
    if (siteErr || !site) return json({ error: "Site not found" }, 404);

    const { data: runRow } = await supabase.from("wp_readiness_runs")
      .insert({ site_id: body.siteId, user_id: user.id, status: "running" })
      .select("id").single();
    const runId = runRow?.id as string;

    const base = String(site.base_url).replace(/\/+$/, "");
    const results: CheckResult[] = [];

    const sshCheck = timed(async () => callInternal("wp-ssh-test", auth, { siteId: body.siteId }, 20_000));
    const coreCheck = timed(async () => callInternal("wordpress-cli", auth, { siteId: body.siteId, command: "core-check" }, 30_000));
    const pluginStatus = timed(async () => callInternal("wordpress-cli", auth, { siteId: body.siteId, command: "plugin-status" }, 30_000));
    const cronStatus = timed(async () => callInternal("wordpress-cli", auth, { siteId: body.siteId, command: "cron-status" }, 30_000));
    const dbSize = timed(async () => callInternal("wordpress-cli", auth, { siteId: body.siteId, command: "db-size" }, 30_000));
    const restProbe = timed(async () => callInternal("wordpress-proxy", auth, { siteId: body.siteId, method: "GET", path: "posts", query: { per_page: "1" } }, 20_000));
    const settingsProbe = timed(async () => callInternal("wordpress-proxy", auth, { siteId: body.siteId, method: "GET", path: "settings" }, 20_000));
    const usersProbe = timed(async () => fetch(`${base}/wp-json/wp/v2/users`, { method: "GET" }).then(r => ({ status: r.status, data: r.status < 400 ? r.json() : null })));
    const sitemapProbe = timed(async () => fetch(`${base}/sitemap.xml`, { method: "GET" }).then(r => ({ status: r.status })));
    const robotsProbe = timed(async () => fetch(`${base}/robots.txt`, { method: "GET" }).then(r => ({ status: r.status })));
    const headersProbe = timed(async () => fetch(base, { method: "GET" }).then(r => ({ status: r.status, hsts: r.headers.get("strict-transport-security"), xfo: r.headers.get("x-frame-options") })));

    const [ssh, core, plugins, cron, dbs, rest, settings, users, sitemap, robots, headers] = await Promise.all([
      sshCheck, coreCheck, pluginStatus, cronStatus, dbSize, restProbe, settingsProbe, usersProbe, sitemapProbe, robotsProbe, headersProbe,
    ]);

    // 1 SSH
    results.push({
      id: "ssh", title: "SSH + WP-CLI dostupné", weight: 10, duration_ms: ssh.ms,
      status: (ssh.value?.data as { ok?: boolean })?.ok ? "pass" : "warn",
      detail: (ssh.value?.data as { error?: string })?.error ?? undefined,
    });
    // 2 core-check
    const coreArr = ((core.value?.data as { stdout?: string })?.stdout ?? "").trim();
    let corePending = 0;
    try { corePending = Array.isArray(JSON.parse(coreArr)) ? (JSON.parse(coreArr) as unknown[]).length : 0; } catch { /* */ }
    results.push({
      id: "core", title: "WordPress jadro aktualizované", weight: 10, duration_ms: core.ms,
      status: corePending === 0 ? "pass" : corePending > 2 ? "fail" : "warn",
      detail: `Čakajúce update: ${corePending}`,
    });
    // 3 plugins
    let pluginPending = 0;
    try { const p = JSON.parse(((plugins.value?.data as { stdout?: string })?.stdout ?? "[]")); pluginPending = (p as Array<{update?: string}>).filter(x => x.update && x.update !== "none").length; } catch { /* */ }
    results.push({
      id: "plugins", title: "Pluginy aktualizované", weight: 10, duration_ms: plugins.ms,
      status: pluginPending === 0 ? "pass" : pluginPending > 3 ? "fail" : "warn",
      detail: `Zastaralé pluginy: ${pluginPending}`,
    });
    // 4 cron
    let cronStuck = 0;
    try { const c = JSON.parse(((cron.value?.data as { stdout?: string })?.stdout ?? "[]")); const now = Date.now()/1000; cronStuck = (c as Array<{next_run_relative?:string, next_run_gmt?:string}>).filter(x => x.next_run_gmt && Date.parse(x.next_run_gmt)/1000 < now - 3600).length; } catch { /* */ }
    results.push({ id: "cron", title: "WP-Cron nie je zaseknutý", weight: 6, duration_ms: cron.ms, status: cronStuck === 0 ? "pass" : "warn", detail: `Zaseknuté úlohy: ${cronStuck}` });
    // 5 db size
    results.push({ id: "db", title: "Veľkosť databázy", weight: 4, duration_ms: dbs.ms, status: "pass", data: (dbs.value?.data as { stdout?: string })?.stdout?.slice(0, 500) });
    // 6 REST reachable
    results.push({
      id: "rest", title: "REST API funkčné + rýchlosť", weight: 12, duration_ms: rest.ms,
      status: (rest.value?.status ?? 500) < 400 ? (rest.ms < 800 ? "pass" : rest.ms < 2500 ? "warn" : "fail") : "fail",
      detail: `TTLB ${rest.ms} ms, HTTP ${rest.value?.status ?? "?"}`,
    });
    // 7 settings hardening
    const s = (settings.value?.data as { url?: string; default_comment_status?: string }) ?? null;
    const httpsOk = s?.url?.startsWith("https://") ?? false;
    results.push({ id: "settings", title: "HTTPS + WP settings", weight: 8, duration_ms: settings.ms, status: httpsOk ? "pass" : "fail", detail: httpsOk ? "HTTPS OK" : "Site URL nie je HTTPS" });
    // 8 users leak
    const usersLeak = (users.value?.status ?? 500) < 400;
    results.push({ id: "users_leak", title: "/wp/v2/users nezverejňuje userov", weight: 10, duration_ms: users.ms, status: usersLeak ? "fail" : "pass", detail: usersLeak ? "Anonym vidí zoznam userov" : "OK" });
    // 9 sitemap
    results.push({ id: "sitemap", title: "sitemap.xml existuje", weight: 6, duration_ms: sitemap.ms, status: (sitemap.value?.status ?? 500) < 400 ? "pass" : "warn" });
    // 10 robots
    results.push({ id: "robots", title: "robots.txt existuje", weight: 4, duration_ms: robots.ms, status: (robots.value?.status ?? 500) < 400 ? "pass" : "warn" });
    // 11 headers
    const h = headers.value as { status?: number; hsts?: string | null; xfo?: string | null } | null;
    const headerScore = (h?.hsts ? 1 : 0) + (h?.xfo ? 1 : 0);
    results.push({ id: "headers", title: "Security headers (HSTS, XFO)", weight: 8, duration_ms: headers.ms, status: headerScore === 2 ? "pass" : headerScore === 1 ? "warn" : "fail", detail: `HSTS:${h?.hsts ? "✓" : "✗"} XFO:${h?.xfo ? "✓" : "✗"}` });
    // 12 backup plugin present
    let hasBackup = false;
    try { const p = JSON.parse(((plugins.value?.data as { stdout?: string })?.stdout ?? "[]")); hasBackup = (p as Array<{name?: string}>).some(x => /updraft|backwpup|backupbuddy|duplicator/i.test(x.name ?? "")); } catch { /* */ }
    results.push({ id: "backup", title: "Backup plugin nainštalovaný", weight: 12, duration_ms: 0, status: hasBackup ? "pass" : "warn", detail: hasBackup ? "OK" : "Nenašiel som Updraft/BackWPup/…" });

    const totalWeight = results.reduce((a, r) => a + r.weight, 0);
    const earned = results.reduce((a, r) => a + (r.status === "pass" ? r.weight : r.status === "warn" ? r.weight * 0.5 : 0), 0);
    const score = Math.round((earned / totalWeight) * 100);

    await supabase.from("wp_readiness_runs").update({
      status: "completed",
      score,
      breakdown: { results, total_weight: totalWeight, earned },
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    return json({ ok: true, runId, score, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
