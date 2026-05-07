
## Plan: Real audit engine + PDF report + Open in Builder

### 1. Real audit engine (edge function)

Browsers can't fetch arbitrary cross-origin URLs (CORS), so the audit must run server-side.

**New edge function:** `supabase/functions/launch-audit/index.ts` (`verify_jwt = false`, public — input is just a URL)

Checks performed against the user's URL:
- **Security headers** — fetch HEAD/GET, inspect: `content-security-policy`, `strict-transport-security`, `x-content-type-options`, `referrer-policy`, `permissions-policy`, `x-frame-options`. Each missing → finding.
- **HTTPS enforcement** — try `http://<host>`, follow redirects=manual, expect 30x to https.
- **PWA signals** — fetch `/manifest.webmanifest` and `/manifest.json`; parse `theme_color`, `icons`, `start_url`, `display`. Check HTML `<head>` for `<link rel="manifest">`, `<meta name="theme-color">`.
- **Performance hints** — measure response time, gzip/brotli (`content-encoding`), HTML size, count `<img>` without `width/height`/`loading="lazy"`, count `<script>` blocking tags.
- **Accessibility hints** (cheap regex over HTML) — `<html lang>` present, `<title>`, `<img>` without `alt`, form `<input>` without `id`/label.
- **Privacy** — search HTML for "privacy" link in footer area, presence of cookie banner keywords.

Returns `Scan` JSON (matching existing types) with `source: 'real'` per dimension where the check actually ran, `'demo'` fallback when network failed.

**Client wiring:** `src/lib/launch/audit.ts` adds `runRealAudit(project)` calling `supabase.functions.invoke('launch-audit', { body: { url, project } })`. Keeps `runMockAudit` as fallback. `LaunchDashboard` gets a toggle "Real scan / Demo" — defaults to **Real**, falls back to mock on error with a toast.

### 2. PDF report

Use **jsPDF + jspdf-autotable** (pure client, no server). Add `bun add jspdf jspdf-autotable`.

`src/lib/launch/pdfReport.ts` → `exportScanPdf(project, scan, allScans)`:
- **Cover** — project name, URL, date, big overall score.
- **Scorecard table** — 5 dimensions × score, source (real/demo).
- **Severity distribution** — small bar table (counts per severity).
- **Timeline** — table of all scans with overall score + delta.
- **Findings** — for each: severity badge, title, dimension, why it matters, recommended fix, then a monospaced **builder fix prompt** block (so user can copy from PDF too).
- Footer with page numbers + generated-by line.

UI: in `ProjectView` header actions add a **"Export PDF"** button (uses `Download` icon). Disabled during generation, shows loader.

### 3. "Open in Builder" button

Goal: from a finding, jump into the in-app builder (the chat in `/`) with the `builderPrompt` pre-filled.

**Mechanism (no prop drilling across routes):**
1. `FindingCard.tsx` adds an **"Open in Builder"** button next to the existing copy button. On click:
   - `sessionStorage.setItem('builderPrompt', finding.builderPrompt)`
   - `navigate('/?view=chat&from=launch')`
2. `src/pages/Index.tsx` on mount reads `sessionStorage.builderPrompt`. If present:
   - `setCurrentView('chat')`
   - `setInputValue(stored)` (don't auto-send — user reviews then hits send)
   - clear the storage key + show a toast "Prompt loaded from Launch Audit".

This works without changing route shape and survives the lazy-loaded views.

### Files

**New:**
- `supabase/functions/launch-audit/index.ts` — real audit checks (Deno fetch + regex parsing).
- `src/lib/launch/pdfReport.ts` — jsPDF builder.

**Edited:**
- `supabase/config.toml` — add `[functions.launch-audit] verify_jwt = false`.
- `src/lib/launch/audit.ts` — add `runRealAudit()` wrapper.
- `src/pages/LaunchDashboard.tsx` — Real/Demo toggle, Export PDF action, wire async rescan.
- `src/components/launch/FindingCard.tsx` — "Open in Builder" button.
- `src/pages/Index.tsx` — pickup `sessionStorage.builderPrompt` on mount → set chat view + input.
- `package.json` — add `jspdf`, `jspdf-autotable`.

### Notes / scope limits

- Real audit is **best-effort heuristics**, not Lighthouse. We say so in the UI subtitle.
- Performance LCP/CLS metrics are not measured (no headless browser); we surface only static signals. Documented in the function.
- Edge function has a small concurrency cap and a 10s fetch timeout per probe to keep it cheap.
