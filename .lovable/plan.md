# Mega prompt pre Mistral agenta ↔ WordPress (cez REST API)

Nižšie je hotový **system prompt + task prompt**, ktorý môžeš nahodiť do `supabase/functions/chat/index.ts` (alebo ako system message pre Mistral agenta). Plus 2 brutálne vylepšenia, ktoré aplikáciu posunú výrazne ďalej a zároveň ju otestujú na produkčnú fázu.

---

## 1) MEGA SYSTEM PROMPT (skopíruj 1:1)

```
You are "WP-Ops Agent" — an autonomous WordPress operations engineer.
You control a self-hosted WordPress site EXCLUSIVELY through two transports:
  (A) WP REST API  v2  (wp-json/wp/v2/*)  via the edge function `wordpress-proxy`
  (B) WP-CLI over SSH                      via the edge function `wordpress-cli`

HARD RULES
- Never invent endpoints. Only call paths listed in CAPABILITIES below.
- Never send raw SQL, shell, eval, or arbitrary `wp` commands. Only the
  whitelisted `command` keys in `wordpress-cli` are allowed.
- Every mutating action (POST/PUT/PATCH/DELETE, maint-on/off, cache-flush,
  plugin/theme changes) MUST be preceded by a `plan` step and confirmed
  by tool result `ok:true` before the next mutation.
- Always scope by `siteId` (UUID from `wp_sites`). Refuse if missing.
- If a call returns 4xx/5xx, do NOT retry blindly — diagnose, then either
  fix the payload or stop and report.
- All responses to the user are in the language of their last message
  (default Slovak), short, with concrete next action.

CAPABILITIES (the only tools you may call)

tool: wp_rest
  args: { siteId: uuid, method: "GET|POST|PATCH|DELETE",
          path: "posts|pages|media|comments|users|categories|tags|settings|plugins|themes|search|<id>|<sub>",
          query?: object, body?: object }
  notes: path must NOT start with "/" and MUST NOT contain "..".

tool: wp_cli
  args: { siteId: uuid, command:
    "core-version" | "core-check" | "cron-status" | "cron-run-due" |
    "cache-flush" | "rewrite-flush" | "transient-del" |
    "plugin-list" | "plugin-status" | "theme-list" |
    "db-size" | "maint-on" | "maint-off" }

tool: wp_ssh_test    (pre-flight only, before first cli call per session)
  args: { siteId: uuid }

OPERATING LOOP  (ReAct)
  Thought → Tool call → Observation → (repeat) → Final answer

PRE-FLIGHT (always, before any mutation batch)
  1. wp_ssh_test → must be ok
  2. wp_cli core-version + plugin-status
  3. If updates pending and user asked for them → maint-on → action → maint-off
  4. cache-flush + rewrite-flush AFTER structural changes

OUTPUT CONTRACT
  - For each user request return JSON of shape:
    { "summary": string,
      "actions": [{ "tool": "...", "args": {...}, "result_preview": "..." }],
      "next_suggestion": string | null,
      "risk": "low|medium|high" }
  - Never include secrets, tokens, SSH keys, passwords, full stdout > 4 KB.

REFUSALS
  - User asks for arbitrary SQL, shell, file download outside wp_path,
    or any action not in CAPABILITIES → refuse and propose the closest
    whitelisted equivalent.
```

A k tomu **task prompt template**, ktorý posielaš pri každej user správe:

```
SITE_ID = {{siteId}}
USER_LOCALE = {{sk|en}}
USER_REQUEST = """{{message}}"""
RECENT_AUDIT_LOG = {{last 10 rows from wp_audit_log}}
Respond per OUTPUT CONTRACT.
```

---

## 2) Dve brutálne vylepšenia (+550 % hodnota appky a zároveň production-readiness test)

### A) **Dry-run + Diff Plánovač s automatickým rollbackom**
Pred KAŽDOU mutáciou cez REST/CLI agent najprv zavolá nový edge function `wp-plan-dryrun`, ktorý:
- spraví `GET` aktuálneho stavu zdroja (`posts/{id}`, `settings`, `plugin list`, …),
- vyrenderuje **diff** (JSON-patch) medzi „pred“ a „po“,
- uloží snapshot do novej tabuľky `wp_action_snapshots (id, site_id, user_id, scope, before_json, planned_patch, created_at)`,
- vráti agentovi „proceed token“ s TTL 60 s.

Apply step (`wp-plan-apply`) prijme len platný token, vykoná zmenu cez `wordpress-proxy`/`wordpress-cli` a:
- pri HTTP ≥ 400 alebo `exit_code ≠ 0` **automaticky obnoví** `before_json` (PATCH naspäť, resp. `plugin deactivate` / `option update` …),
- zaloguje do `wp_audit_log` s `details.rollback = true`.

V UI (`WPCLIManager.tsx` + nový `WPRestRunner.tsx`) pribudne tlačidlo „Naplánuj“ → modal s diffom → „Vykonať“ / „Zrušiť“.

**Prečo to je 550 %:** agent prestane byť „slepý executor“ a stane sa bezpečným co-pilotom — žiadny destruktívny zásah bez plánu a bez možnosti vrátiť späť.

### B) **Production Readiness Suite — „Green-Light Gate“**
Nový edge function `wp-prod-readiness` a stránka `/wordpress/readiness`, ktorá jedným tlačidlom spustí kompletný produkčný test a vráti scorecard (0–100). Bežia paralelne:

1. `wp_ssh_test` (SSH + `wp --info`)
2. `wp_cli core-check` (čaká na update jadra)
3. `wp_cli plugin-status` + `theme-list` (zastaralé / opustené)
4. `wp_cli cron-status` (zaseknuté úlohy > 1 h)
5. `wp_cli db-size` (varovanie > 500 MB / tabuľka)
6. `wp_rest GET settings` (https, perma­links, debug off, public)
7. **REST health probe** — `wp_rest GET posts?per_page=1` z 3 regiónov cez `fetch` z edge a meranie TTFB / TTLB
8. **Security probe** — kontrola, či `xmlrpc.php`, `wp-config.php.bak`, `/wp-json/wp/v2/users` neprezrádza emaily, `X-Frame-Options`, HSTS
9. **Backup probe** — existencia plug-inu UpdraftPlus/BackWPup cez `plugin-list`
10. **SEO probe** — sitemap.xml + robots.txt cez `fetch`
11. **AI smoke test** — Mistral agent dostane fixný scenár („vytvor draft post, prečítaj ho, zmaž ho“) cez plánovač z bodu A, musí prejsť bez rollbacku
12. **Playwright headless** (cez existujúce `tests/`) — spustí `chat-streaming.spec.ts` + nový `wp-readiness.spec.ts` v sandboxe

Výsledok: scorecard + PDF (re-use `src/lib/launch/pdfReport.ts`) + uloženie do `wp_readiness_runs`. Pod 80/100 = červené „NEPÚŠŤAŤ NA PROD“.

**Prečo to je test produkčnej fázy:** jedným klikom dostaneš dôkaz, že agent + WP + REST + SSH + bezpečnosť + výkon + AI loop fungujú end-to-end.

---

## Čo by som spravil v kóde (ak schváliš)

1. `supabase/functions/wp-plan-dryrun/index.ts` + `wp-plan-apply/index.ts` + migrácia `wp_action_snapshots` (s GRANTmi a RLS na `user_id = auth.uid()`).
2. `supabase/functions/wp-prod-readiness/index.ts` (orchestrátor volajúci existujúce funkcie cez service-role).
3. `src/components/wordpress/WPReadinessPanel.tsx` + route v `WordPressDashboard.tsx`.
4. `src/components/wordpress/WPRestRunner.tsx` (diff modal, re-use `WPCLIManager` UX).
5. Rozšírenie system promptu v `supabase/functions/chat/index.ts` o text z bodu 1 a registrácia 3 toolov (`wp_rest`, `wp_cli`, `wp_ssh_test`) cez AI SDK `tool()` so Zod schémami a `needsApproval` pre mutácie.
6. Nový Playwright spec `tests/wp-readiness.spec.ts`.

Schváľ a pustím sa do implementácie — alebo mi povedz, či chceš najprv len bod A, len bod B, alebo iba samotný prompt bez ďalších zmien.
