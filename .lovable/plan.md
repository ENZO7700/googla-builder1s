
## Plán: Site Content Manager (static + dynamic + inquiries)

Postavím "ACF Options + CPTs" vrstvu nad `wp_sites`. Primárny zdroj pravdy je naša Supabase DB; jedným tlačidlom sa dá publikovať do WordPressu cez existujúci `wordpress-proxy`.

### 1) Databáza (1 migrácia)

Všetky tabuľky sú scopované na `site_id` (FK → `wp_sites`) + `user_id` cez RLS (vlastník siteu = vlastník dát). Bucket `wp-content-images` pre obrázky.

**Static (singletony — 1 záznam per site, upsert):**

- `wp_company_info` — `site_id` (UNIQUE), `name`, `tagline`, `description`, `email`, `phone`, `address`, `vat_id`, `logo_url`, `cover_url`, `social` (jsonb: fb/ig/li/yt), `wp_post_id` (sync target — voliteľné single post id v WP)
- `wp_about` — `site_id` (UNIQUE), `title`, `subtitle`, `content_html`, `image_url`, `wp_post_id`
- `wp_header` — `site_id` (UNIQUE), `logo_url`, `menu` (jsonb: `[{label, url, order}]`), `cta_label`, `cta_url`
- `wp_footer` — `site_id` (UNIQUE), `logo_url`, `copyright`, `columns` (jsonb: `[{title, links:[{label,url}]}]`), `legal_links` (jsonb)

**Dynamic (repeatery — N záznamov per site):**

Spoločné polia: `id`, `site_id`, `user_id`, `order_index`, `published` bool, `wp_post_id` (sync), `created_at`, `updated_at`.

- `wp_services` — `title`, `slug`, `excerpt`, `description_html`, `icon`, `image_url`, `price`, `link_url`
- `wp_references` — `client_name`, `project_title`, `description_html`, `image_url`, `link_url`, `completed_at`
- `wp_news` — `title`, `slug`, `excerpt`, `content_html`, `cover_url`, `published_at`
- `wp_members` — `name`, `role`, `bio`, `photo_url`, `email`, `link_url` (clients/members repeater bez CPT — nesyncuje sa do WP ako post, len uložené u nás / použiteľné cez REST)

**Inquiries (formulár):**

- `wp_inquiry_forms` — `site_id`, `slug` (UNIQUE per site), `name`, `fields` (jsonb: `[{key,label,type,required}]`), `recipient_email`, `success_message`, `created_at`. Defaultný formulár sa vytvorí pri založení siteu (slug `default`).
- `wp_inquiries` — `site_id`, `form_slug`, `payload` (jsonb), `email`, `name`, `phone`, `message`, `source_url`, `ip_hash`, `user_agent`, `read` bool, `created_at`.

**RLS:**
- Statics + dynamics + forms: SELECT/INSERT/UPDATE/DELETE iba pre vlastníka siteu (cez subselect na `wp_sites`).
- `wp_inquiries`: SELECT/UPDATE/DELETE len vlastník siteu. INSERT je **zakázané z klienta** — robí to public edge funkcia cez service role.

**Triggery:**
- `update_updated_at_column()` na všetkých tabuľkách, ktoré majú `updated_at`.

**Storage:**
- Bucket `wp-content-images` (public), policy: upload len pre prihláseného usera do prefixu `{user_id}/{site_id}/...`.

### 2) Edge funkcie

- **`wordpress-sync`** (`verify_jwt = false`, validujem JWT v kóde) — vstup `{ siteId, entity: 'company|about|service|reference|news|...', recordId }`. Načíta záznam, mapne na WP REST payload (`title`, `content`, `excerpt`, `featured_media`, `meta`), zavolá `wordpress-proxy` interne (alebo priamo wp-json), uloží návratové `wp_post_id` späť do našej tabuľky. Audit log do `wp_audit_log`.
- **`inquiries-submit`** (`verify_jwt = false`, public) — vstup `{ siteId, formSlug, payload, hp }`. Honeypot (`hp` musí byť prázdne), rate-limit per IP (in-memory map, 5/min), Zod validácia podľa `wp_inquiry_forms.fields`, insert do `wp_inquiries`, voliteľne pošle notifikačný email cez Resend (ak je `RESEND_API_KEY` k dispozícii — ak nie, len uložíme).

CORS allow-origin `*` na inquiries (verejné).

### 3) Frontend — `src/lib/wordpress/content/`

- `types.ts` — Zod schémy + TS typy pre všetky entity.
- `useSiteContent.ts` — generic React Query hooky `useStatic(siteId, kind)`, `useRepeater(siteId, kind)` + mutácie (upsert/insert/update/delete/reorder/sync).
- `useInquiries.ts` — list/markRead/delete + form CRUD.

### 4) Frontend — komponenty `src/components/wordpress/content/`

Spoločné:
- `ImageUpload.tsx` — upload do `wp-content-images`, vráti URL.
- `RepeaterTable.tsx` — generic CRUD tabuľka (drag-reorder, bulk publish/unpublish/delete, "Sync to WP" tlačidlo per riadok).
- `EntityForm.tsx` — generic form renderer (Zod-driven).

Špecifické editory:
- `CompanyInfoEditor.tsx` — singleton form (logo, kontakty, social).
- `AboutEditor.tsx` — title + rich text + cover.
- `HeaderEditor.tsx` — menu repeater (label/url/order) + CTA.
- `FooterEditor.tsx` — columns repeater + legal links.
- `ServicesManager.tsx`, `ReferencesManager.tsx`, `NewsManager.tsx`, `MembersManager.tsx` — repeater UI cez `RepeaterTable`.
- `InquiryFormBuilder.tsx` — definícia polí (drag fields).
- `InquiryInbox.tsx` — tabuľka submissions + detail drawer + označiť ako prečítané + export CSV.
- `EmbedSnippet.tsx` — generuje `<script>` snippet + HTML form template pre embed na cudziu stránku.

### 5) Dashboard rozšírenie

`src/pages/WordPressDashboard.tsx` — pridám tabs (shadcn `Tabs`) pod selector:

```text
[ Overview ] [ Static ] [ Services ] [ References ] [ News ] [ Members ] [ Inquiries ] [ Embed ]
```

Tab `Static` má pod-tabs: Company / About / Header / Footer.

### 6) Embed snippet

`InquiryEmbed` edge route + statický `inquiry-embed.js` v `public/`:

```html
<div data-lovable-form="default" data-site="{SITE_ID}"></div>
<script src="https://{project}.functions.supabase.co/inquiry-embed.js" defer></script>
```

Skript fetne formulár schému z `inquiries-submit?meta=1`, vykreslí natívny `<form>`, na submit pošle JSON. Žiadne závislosti, vanilla JS, štýly cez minimálne inline CSS s prefixom `lvb-`.

### 7) Publish to WordPress (sync)

Per entitu mapping:

| Naša entita | WP cieľ |
|---|---|
| `wp_about` (singleton) | Page (alebo update existujúcej `wp_post_id`) |
| `wp_services` | CPT `services` (ak neexistuje → fallback na `posts` s tagom `service`) |
| `wp_references` | CPT `references` / `posts` + tag |
| `wp_news` | `posts` |
| `wp_members` | nesyncuje sa (interné) |
| `wp_company_info`, `wp_header`, `wp_footer` | Uložené v našej DB; pre WP buď cez ACF Options REST (ak existuje plugin), alebo len držíme u nás a vystavíme ako verejné JSON cez `site-content-public` edge funkciu, ktorú si WP zaťahuje. |

V tejto iterácii spravím sync iba pre `about/services/references/news` (CPT/post). Options-style entity (company/header/footer) nechám len u nás + vystavím verejný JSON endpoint `site-content/{siteId}/public.json` na čítanie z WP.

### 8) Bezpečnosť

- Všetky tabuľky majú RLS, policies cez `EXISTS (SELECT 1 FROM wp_sites WHERE id = site_id AND user_id = auth.uid())`.
- `wp_inquiries` write iba cez service role v edge funkcii.
- Rate-limit + honeypot na inquiries.
- Validácia inputov Zodom v edge aj na klientovi.
- Storage policies podľa `{user_id}/{site_id}` prefixu.
- CSP-safe embed snippet (bez `eval`, bez `innerHTML` user contentu).

### 9) Mimo scope (vedome)

- Šifrovanie `app_password_encrypted` cez vault (sľúbené ako follow-up).
- WP-CLI cez SSH.
- Image transformation / CDN resizing.
- ACF Options sync (nechávame čítaný JSON namiesto zápisu, lebo to závisí od pluginu na WP strane).

### Súbory

**Migrácia:** všetky tabuľky vyššie + RLS + storage bucket + policies + triggery.

**New (frontend):**
- `src/lib/wordpress/content/types.ts`
- `src/lib/wordpress/content/useSiteContent.ts`
- `src/lib/wordpress/content/useInquiries.ts`
- `src/components/wordpress/content/ImageUpload.tsx`
- `src/components/wordpress/content/RepeaterTable.tsx`
- `src/components/wordpress/content/CompanyInfoEditor.tsx`
- `src/components/wordpress/content/AboutEditor.tsx`
- `src/components/wordpress/content/HeaderEditor.tsx`
- `src/components/wordpress/content/FooterEditor.tsx`
- `src/components/wordpress/content/ServicesManager.tsx`
- `src/components/wordpress/content/ReferencesManager.tsx`
- `src/components/wordpress/content/NewsManager.tsx`
- `src/components/wordpress/content/MembersManager.tsx`
- `src/components/wordpress/content/InquiryFormBuilder.tsx`
- `src/components/wordpress/content/InquiryInbox.tsx`
- `src/components/wordpress/content/EmbedSnippet.tsx`
- `public/inquiry-embed.js`

**New (edge):**
- `supabase/functions/wordpress-sync/index.ts`
- `supabase/functions/inquiries-submit/index.ts`
- `supabase/functions/site-content-public/index.ts`

**Edited:**
- `src/pages/WordPressDashboard.tsx` — tabs.

### Otázka pred štartom

Notifikačné emaily na nové dopyty: pripojiť **Resend** konektor teraz (cez `standard_connectors--connect`), alebo zatiaľ vynechať a robiť len uloženie do DB?
