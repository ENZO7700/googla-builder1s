## Cieľ
Podpora poľa typu `file` v inquiry formulároch — používateľ na webe nahrá prílohu, ktorá sa bezpečne uloží do storage a referencia sa pripojí k dopytu.

## Zmeny

### 1. Storage bucket `inquiry-attachments` (private)
Migrácia:
- `insert into storage.buckets ('inquiry-attachments', private)`
- RLS na `storage.objects`:
  - INSERT povolený len pre service role (uploads idú cez edge funkciu, nie priamo z prehliadača).
  - SELECT povolený vlastníkovi site cez `is_wp_site_owner` (path prefix `{site_id}/...`).

### 2. Edge funkcia `inquiries-submit` (rozšírenie)
- Nové action: `POST` s `?action=upload` — multipart/form-data: `siteId`, `formSlug`, `fieldKey`, `file`.
  - Validácia:
    - field `fieldKey` musí v schéme existovať a mať `type: 'file'`
    - max size (default 5 MB, override cez `field.maxSize`)
    - povolené MIME (`field.accept` napr. `image/*,application/pdf`); fallback whitelist
    - rate limit (rovnaký bucket ako submit)
    - honeypot ostáva pri samotnom POST submit
  - Uloží do `inquiry-attachments/{siteId}/{yyyy}/{mm}/{uuid}-{safeName}`.
  - Vráti `{ ok, path, size, mime, name }` (bez verejného URL — privátny bucket).
- Pri finálnom `POST submit`:
  - Pre file polia očakáva objekt `{ path, name, size, mime }` (nie raw súbor).
  - Validuje, že path patrí pod `{siteId}/` a existuje v storage.
  - Uloží referenciu do `payload[fieldKey]`.

### 3. Schéma poľa
Rozšírenie `InquiryFormField`:
- `type: 'file'`
- voliteľné: `accept` (string), `maxSize` (MB), `multiple` (zatiaľ iba single — `false`).

### 4. `public/inquiry-embed.js`
- `renderField` pre `type === 'file'`: `<input type="file" accept="...">` + status text.
- Pri `change` automaticky uploadne cez `POST {ENDPOINT}?action=upload` (multipart) a uloží výsledný `{path,...}` do interného state mapovaného na `field.key`.
- Tlačidlo Odoslať je disabled, kým prebieha upload required file.
- V `submit` sa namiesto `FormData` pre file polia použije referenčný objekt.
- Zobrazenie progress / chýb (max size, MIME).

### 5. `InquiryFormBuilder.tsx`
- Do `<select>` typov pridať `file`.
- Ak je vybraný `file`, zobraziť polia `accept` (text) a `maxSize` (MB).

### 6. `InquiryInbox.tsx`
- Detekovať file referencie v payload (`{ path, name, mime }`) a poskytnúť tlačidlo „Stiahnuť" — vygeneruje signed URL cez `supabase.storage.from('inquiry-attachments').createSignedUrl(path, 300)`.

## Bezpečnosť
- Bucket privátny; iba majiteľ site číta cez signed URL.
- Server-side validácia veľkosti, MIME, ownership path.
- Rate limit na upload endpoint (5/min/IP).
- Honeypot na submit zostáva, upload limituje IP bucket.
- Sanitizácia názvu súboru (slugify, odstránenie `..`, max 100 znakov).

## Súbory
- nový: `supabase/migrations/<ts>_inquiry_attachments.sql`
- upravené: `supabase/functions/inquiries-submit/index.ts`
- upravené: `public/inquiry-embed.js`
- upravené: `src/lib/wordpress/content/types.ts` (nový typ `file` + `accept`/`maxSize`)
- upravené: `src/components/wordpress/content/InquiryFormBuilder.tsx`
- upravené: `src/components/wordpress/content/InquiryInbox.tsx`
- deploy: `inquiries-submit`
