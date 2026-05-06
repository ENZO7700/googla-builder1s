# GitHub PR AI Code Review – Implementation Plan

Pridám automatický AI code review pre Pull Requesty cez GitHub Webhook → Supabase Edge Function → Lovable AI Gateway → komentár späť do PR.

## Čo sa postaví

### 1. Edge Function: `supabase/functions/github-pr-review/index.ts`
Verejný endpoint (public webhook, **`verify_jwt = false`** v `supabase/config.toml`), ktorý:

1. **Overí HMAC podpis** z GitHub headeru `X-Hub-Signature-256` pomocou `GITHUB_WEBHOOK_SECRET` (ochrana pred spoofingom).
2. Validuje payload – spracuje len eventy `pull_request` s akciou `opened | synchronize | reopened`. Inak vráti 200 `{ignored:true}`.
3. Stiahne **PR diff** z GitHub API (`Accept: application/vnd.github.v3.diff`) cez `GITHUB_TOKEN`.
4. Oreže diff (limit ~120 KB) aby sa zmestil do AI kontextu, s poznámkou "diff truncated".
5. Pošle prompt na **Lovable AI Gateway** (`google/gemini-3-flash-preview`, non-streaming, `temperature: 0.2`) s vloženým systémovým promptom v slovenčine podľa zadania (🔴 Kritické / 🟡 Varovania / 🟢 Návrhy, tabuľky, max 10 riadkov / kategória, ignoruje formátovanie, NEXIFY pravidlá).
6. Odpoveď postne ako komentár do PR cez `POST /repos/{owner}/{repo}/issues/{number}/comments`.
7. Loguje výsledok, vracia `{ ok: true, commentId }` alebo error JSON s CORS headers.

### 2. Konfigurácia
- `supabase/config.toml`: pridá blok pre `github-pr-review` s `verify_jwt = false`.
- **Secrets** (cez `add_secret`, po potvrdení):
  - `GITHUB_TOKEN` – PAT s `repo` scope (komentovanie + čítanie diffov).
  - `GITHUB_WEBHOOK_SECRET` – pre HMAC overenie.
  - `LOVABLE_API_KEY` – už existuje, nepýtam.
- Voliteľné (zatiaľ vynechané, ľahko doplniteľné): `SLACK_WEBHOOK_URL`.

### 3. UI – sekcia v `GitHubDashboard.tsx`
Nová karta **"AI PR Review – Webhook setup"** v existujúcom dashboarde s:
- Webhook URL (`https://lmuervovjnpadapfwwmh.supabase.co/functions/v1/github-pr-review`) + tlačidlo Kopírovať.
- Krok-za-krokom inštrukcie (Repo → Settings → Webhooks → Add webhook, Content type `application/json`, event `Pull requests`).
- Status badge: "Connected / Not configured" na základe posledného audit eventu (mock).
- Tlačidlo **"Otestovať review"** ktoré zavolá edge function s mock PR payloadom (dry-run mód, bez postnutia komentáru).

### 4. Audit log integrácia
Po každom volaní edge function pridá záznam typu `pr_review` do GitHub audit feedu (mock service zatiaľ – TODO komentár pre neskoršie napojenie na DB tabuľku `github_audit_events` ak bude treba).

## Bezpečnostné invarianty
- Tokeny **iba na serveri** (Deno.env), nikdy v klientovi.
- HMAC overenie podpisu webhooku **fail-closed** – bez podpisu vráti 401.
- Whitelist eventov a akcií, ostatné ignoruje.
- Diff veľkosť limitovaná, aby sa predišlo abusu AI kvóty.
- CORS pre OPTIONS, ale endpoint je primárne server-to-server (GitHub).

## Súbory
**Nové:**
- `supabase/functions/github-pr-review/index.ts`

**Upravené:**
- `supabase/config.toml` – function block s `verify_jwt = false`
- `src/pages/GitHubDashboard.tsx` – nová sekcia "AI PR Review"
- `src/lib/github/githubService.ts` – pridá `triggerTestPRReview()` (volá edge function)

## Otvorené otázky
Nepotrebujem – zadanie je jasné. Pred implementáciou ťa cez `add_secret` poprosím o `GITHUB_TOKEN` a `GITHUB_WEBHOOK_SECRET`.
