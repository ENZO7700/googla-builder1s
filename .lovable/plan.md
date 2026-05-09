
## Plán: WordPress Manager integrácia

Spracujem 10 nahraných súborov a zapojím ich do projektu ako kompletný WordPress dashboard (multi-site, posts/pages/comments/users/plugins/settings + audit log).

### 1. Databáza (migrácia)

Vytvorím tabuľky podľa `supabase_migrations_20260508_wordpress_manager.sql`:
- **`wp_sites`** — `user_id`, `label`, `base_url`, `site_type` ('com'|'self'), `username`, `app_password_encrypted`, `last_sync_at`, UNIQUE(user_id, base_url)
- **`wp_audit_log`** — `site_id`, `user_id`, `action`, `resource_type`, `resource_id`, `details` (jsonb), `status`, `error_message`

RLS: každý user vidí/spravuje len svoje sites a audit logy svojich sites.
Pridám indexy. WP-CLI tabuľku `wp_ssh_credentials` nebudem pridávať (CLI funkcia je v tejto fáze mimo scope — viď nižšie).

### 2. Frontend — knižnica `src/lib/wordpress/`

- `types.ts` — Zod schémy + TS typy (Post, Page, Comment, User, Plugin, Media, Settings, error map, retry/rate-limit konfig)
- `wordpressService.ts` — trieda `WordPressService` s rate limiterom, retry logikou, volaniami cez `wordpress-proxy` edge funkciu
- `useWordPressService.ts` — React Query hooky (queries + mutácie pre posts, pages, comments, users, plugins, settings, media upload)

### 3. Frontend — komponenty `src/components/wordpress/`

- `WordPressSiteSelector.tsx` — výber site + dropdown na zmazanie + "Add new"
- `AddSiteDialog.tsx` — dialóg na pridanie siteu (com / self-hosted s app password)
- `WordPressOverview.tsx` — overview kartičky (posty, drafty, komentáre, používatelia, pluginy, WP verzia)

### 4. Stránka `src/pages/WordPressDashboard.tsx`

Hlavný dashboard s headerom, site selectorom, tabmi (zatiaľ Overview; ďalšie taby pripravené ako placeholder na budúce rozšírenie). Auth gate cez `useAdminAuth`.

### 5. Edge funkcia `supabase/functions/wordpress-proxy/index.ts`

Podľa nahraného súboru: prijme `{ siteId, method, path, body, query }`, overí JWT, načíta site config (RLS), pre **self-hosted** pridá Basic auth (`username:app_password`), proxy na `{base_url}/wp-json/wp/v2/{path}`, výsledok zapíše do `wp_audit_log`.

Pre **WordPress.com** site (`site_type = 'com'`) routujem cez **gateway konektora** `wordpress_com` (`https://connector-gateway.lovable.dev/wordpress_com/rest/v1.1/sites/{site_id}/...`) s `LOVABLE_API_KEY` + `WORDPRESS_COM_API_KEY` headermi — to je dôvod, prečo neukladáme app_password pre WP.com siteov.

`verify_jwt = true` (default), input validácia cez Zod, CORS headers na všetkých responsoch.

### 6. WordPress.com konektor

Predtým, než wp.com siteovia môžu fungovať, musí byť v projekte nalinkovaný **`wordpress_com`** konektor. Po schválení plánu zavolám `standard_connectors--connect` s `connector_id="wordpress_com"`. Užívateľ si vyberie/vytvorí connection cez built-in picker.

### 7. Routing + sidebar

- `App.tsx` — pridám `<Route path="/dashboard/wordpress" element={<WordPressDashboard />} />` (presne podľa kódu v správe).
- `ConnectorsView.tsx` — pridám tile pre **WordPress** (📘) s tlačidlom "Otvoriť WordPress dashboard" → `/dashboard/wordpress`, podobne ako existujúci GitHub dashboard pattern.

### 8. Mimo scope (vedome vynechané)

- **`wordpress-cli` edge funkcia** — vyžaduje SSH knižnicu pre Deno + tabuľku `wp_ssh_credentials` + UI pre SSH credentials. Je to citlivá vec a nemáme zatiaľ UX. Nechám ako follow-up. Súbor `wordpress-cli/index.ts` z uploadov nebudem zatiaľ deployovať.
- **Šifrovanie `app_password`** — uploady používajú `btoa()` (nie je to šifrovanie). V tejto iterácii to zachovám aby som matchol uploady, ale pridám TODO komentár + odporúčanie použiť pgsodium / vault v ďalšej iterácii. Ak chceš, môžem rovno spraviť proper encryption cez Supabase vault — povedz a pridám.

### Bezpečnosť

- RLS na všetkých nových tabuľkách
- Edge funkcia overuje JWT a načíta site iba s `user_id = auth.uid()`
- Zod validácia inputov v edge funkcii aj v service
- Žiadne plain-text app passwordy v UI po uložení
- Audit log pre každú mutáciu

### Files

**New:**
- `src/lib/wordpress/types.ts`
- `src/lib/wordpress/wordpressService.ts`
- `src/lib/wordpress/useWordPressService.ts`
- `src/components/wordpress/WordPressSiteSelector.tsx`
- `src/components/wordpress/AddSiteDialog.tsx`
- `src/components/wordpress/WordPressOverview.tsx`
- `src/pages/WordPressDashboard.tsx`
- `supabase/functions/wordpress-proxy/index.ts`

**Edited:**
- `src/App.tsx` — pridať route
- `src/components/workspace/ConnectorsView.tsx` — pridať WordPress tile
- `supabase/config.toml` — netreba zmenu (default `verify_jwt = true` je správne pre proxy)

**Migration:** vytvorenie `wp_sites` + `wp_audit_log` s RLS a indexmi.

### Otázka pred implementáciou

Súbory volajú edge funkciu `wordpress-proxy` aj pre `site_type = 'com'`. WordPress.com má ale vlastnú REST API (`public-api.wordpress.com`) cez konektor gateway, nie `/wp-json/wp/v2/`. Mám:
- **A)** podporiť oba typy (self → REST `/wp-json/`, com → connector gateway) — odporúčané, povolí to skutočnú správu wp.com sajtov.
- **B)** zatiaľ implementovať len self-hosted a wp.com odložiť.

Pôjdem s **A** ak nepovieš inak.
