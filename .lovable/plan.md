# Plán: dokončenie WP-Ops (A + C + B) s Mistral agentom

Skratky: **A** = Dry-run + Rollback, **C** = Mistral chat agent s WP tools + manuálny approve, **B** = Production Readiness Suite. Poradie implementácie: A → C → B (C potrebuje A ako mutation backbone, B ich obe volá).

## 1. Databáza (jedna migrácia)

```text
wp_action_snapshots
  id uuid pk, site_id uuid → wp_sites, user_id uuid (auth.uid()),
  scope text  ('rest'|'cli'), target text (napr. 'posts/42', 'plugin/akismet'),
  before_json jsonb, planned_patch jsonb, planned_call jsonb,
  proceed_token text unique, token_expires_at timestamptz,
  status text ('planned'|'applied'|'rolled_back'|'failed'|'expired'),
  applied_at timestamptz, rolled_back_at timestamptz,
  result_json jsonb, error text,
  created_at timestamptz default now()

wp_readiness_runs
  id uuid pk, site_id uuid, user_id uuid,
  score int, breakdown jsonb, pdf_path text,
  started_at, finished_at, status text
```

RLS: `user_id = auth.uid()` pre select/insert/update; explicit `service_role` GRANT. GRANT block per pravidlá projektu. Bucket `wp-readiness-reports` (private) pre PDF.

## 2. Edge funkcie (nové)

- `wp-plan-dryrun` — vstup `{siteId, scope, target, method?, path?, body?, command?}`. Načíta „before" (GET zdroja cez `wordpress-proxy` alebo `wp option get`/`plugin list` cez `wordpress-cli`), vypočíta JSON-patch diff, zapíše snapshot, vráti `{snapshotId, proceedToken (TTL 60s), diff, risk}`.
- `wp-plan-apply` — prijme `proceedToken`, revalidne TTL/vlastníka, vykoná mutáciu cez `wordpress-proxy` / `wordpress-cli`. Pri HTTP ≥ 400 alebo `exit_code ≠ 0` automaticky vráti `before_json` (PATCH späť, `plugin (de)activate`, `option update`, …). Loguje do `wp_audit_log` s `details.rollback=true`.
- `wp-prod-readiness` — orchestrátor 12 probov (SSH, core-check, plugin/theme, cron, db-size, settings, REST TTFB z 3 regiónov, security probes, backup, SEO, AI smoke test cez A, Playwright hook). Vypočíta scorecard 0–100, uloží run, vygeneruje PDF (re-use `src/lib/launch/pdfReport.ts`).
- `chat` — refactor na **AI SDK + `@ai-sdk/openai-compatible`** proti Mistral endpointu (`https://api.mistral.ai/v1`, `MISTRAL_API_KEY`, model `mistral-large-latest`). Registruje 5 toolov cez `tool()` + Zod:
  - `wp_ssh_test` (read)
  - `wp_rest_read` (GET only, žiadny approve)
  - `wp_cli_read` (whitelist read príkazov: core-version, cron-status, plugin-list, theme-list, db-size, plugin-status)
  - `wp_plan` (volá `wp-plan-dryrun`) — bez approve
  - `wp_apply` (volá `wp-plan-apply`) — **`needsApproval: true`**
  - `wp_cli_mutation` a `wp_rest_write` sú zakázané mimo `wp_apply` (agent musí ísť cez plan→apply)
  - `stopWhen: stepCountIs(50)`, system prompt = MEGA prompt z `.lovable/plan.md`.

## 3. Frontend

- `src/components/wordpress/WPPlanDialog.tsx` — modal s diff viewerom (react-diff-viewer-continued alebo vlastný `<pre>` split), risk badge, „Vykonať" / „Zrušiť", zobrazenie výsledku a auto-rollback banner.
- `src/components/wordpress/WPRestRunner.tsx` — inline form (path, method, body) → plan → dialog.
- `WPCLIManager.tsx` — mutation príkazy (cache-flush, rewrite-flush, maint-on/off, transient-del) prejdú cez plan→dialog namiesto priameho `wp_cli`.
- `src/components/workspace/ChatView.tsx` — render `message.parts` vrátane `tool-invocation` častí; pri `state==="call"` a `needsApproval` zobrazí Approve/Deny tlačidlá (posielajú `addToolResult` cez `useChat`).
- `src/pages/WordPressReadiness.tsx` + route `/wordpress/readiness` + tab v `WordPressDashboard.tsx` — „Spustiť readiness check" button, live progress, scorecard s 12 kartami, Download PDF, história `wp_readiness_runs`.

## 4. Testy

- `supabase/functions/wp-plan-apply/apply_test.ts` — Deno test: úspešný apply, forced-failure → rollback path zavolaný.
- `tests/wp-readiness.spec.ts` — Playwright: otvoriť readiness page, spustiť run proti demo site, čakať na scorecard, overiť PDF download.
- `tests/chat-tools.spec.ts` — Playwright: user prompt „aktivuj plugin X" → assistant vygeneruje `wp_plan` → v UI sa objaví diff → klik Approve → `wp_apply` beží → success správa.

## 5. Poradie súborov (implementačné kroky)

```text
1. migration: wp_action_snapshots, wp_readiness_runs, bucket, RLS+GRANT
2. edge: wp-plan-dryrun/index.ts
3. edge: wp-plan-apply/index.ts   (+ apply_test.ts)
4. front: WPPlanDialog + WPRestRunner + úprava WPCLIManager
5. edge: chat/index.ts refactor → AI SDK + Mistral + 5 tools + needsApproval
6. front: ChatView tool-parts renderer + approval UI
7. edge: wp-prod-readiness/index.ts
8. front: WordPressReadiness page + route + tab
9. tests: chat-tools.spec.ts, wp-readiness.spec.ts
10. config.toml: pridať tri nové fn (verify_jwt=true), deploy
```

## Technické poznámky

- Mistral cez `createOpenAICompatible({ name:"mistral", baseURL:"https://api.mistral.ai/v1", headers:{ Authorization:`Bearer ${MISTRAL_API_KEY}` } })`. Prompt/CORS/correlation ID reusujeme z existujúceho `chat/index.ts`.
- `needsApproval` cez AI SDK: tool má `execute` len keď je approval potvrdené; medzitým sa v UI streamuje `tool-invocation` part v state `"call"`.
- Rollback stratégia per resource: `posts/pages/media` → PATCH s `before_json`; `settings` → PATCH options; `plugins` → `plugin activate/deactivate` cez CLI; `theme` → `theme activate` predchádzajúcej témy; ak nie je invertovateľné (`transient-del`, `cache-flush`) → snapshot označíme `rollback:not_applicable` a mutáciu povolíme len s explicit user ackom v diff dialogu.
- PDF re-use `pdfReport.ts` (rozšíriť o `renderReadiness(run)`).
- Proceed token: `crypto.randomUUID()`, TTL 60 s, single-use (mark applied on first apply).
- Všetky nové edge funkcie logujú štruktúrovane s `correlationId` (rovnaký helper ako v `chat`).

Po schválení začnem krokom 1 a idem postupne 1→10, s deploymentom edge funkcií po každom bloku.