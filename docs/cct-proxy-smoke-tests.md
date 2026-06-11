# wordpress-cct-proxy — Smoke Test Examples

Base URL: `https://<PROJECT_REF>.supabase.co/functions/v1/wordpress-cct-proxy`

All requests require:
- `Authorization: Bearer <SUPABASE_USER_JWT>`
- `Content-Type: application/json`
- HTTP method: **POST** (always — the proxy maps actions internally)

Replace `<SITE_UUID>` with your `wp_sites.id`.

---

## 1. List all CCT services

```bash
curl -X POST \
  "https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-cct-proxy" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "<SITE_UUID>",
    "cct": "services",
    "action": "list"
  }'
```

---

## 2. Get single CCT service

```bash
curl -X POST \
  "https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-cct-proxy" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "<SITE_UUID>",
    "cct": "services",
    "action": "get",
    "itemId": 1
  }'
```

---

## 3. Create new CCT service

```bash
curl -X POST \
  "https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-cct-proxy" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "<SITE_UUID>",
    "cct": "services",
    "action": "create",
    "payload": {
      "title": "SEO Audit",
      "slug": "seo-audit",
      "tagline": "Kompletný SEO audit webu",
      "description": "Detailná analýza on-page a off-page SEO.",
      "duration": 120,
      "price": 299,
      "service_type": "audit",
      "service_category": "seo",
      "seo_title": "SEO Audit | Gold Taxi",
      "seo_robots": "index,follow"
    }
  }'
```

---

## 4. Update existing CCT service

```bash
curl -X POST \
  "https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-cct-proxy" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "<SITE_UUID>",
    "cct": "services",
    "action": "update",
    "itemId": 1,
    "payload": {
      "price": 349,
      "tagline": "Aktualizovaný tagline"
    }
  }'
```

---

## 5. Delete CCT service (requires confirm)

```bash
curl -X POST \
  "https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-cct-proxy" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "<SITE_UUID>",
    "cct": "services",
    "action": "delete",
    "itemId": 1,
    "confirm": true
  }'
```

### Delete without confirm (rejected)

```bash
curl -X POST \
  "https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-cct-proxy" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "<SITE_UUID>",
    "cct": "services",
    "action": "delete",
    "itemId": 1
  }'
# → 400 {"ok":false,"error":"delete requires confirm: true."}
```

---

## Expected error responses

| Scenario | Status | Error |
|----------|--------|-------|
| Missing auth header | 401 | `Unauthorized` |
| Invalid JWT | 403 | `Invalid token` |
| Invalid siteId | 400 | `siteId must be a valid UUID.` |
| Disallowed CCT slug | 400 | `cct must be one of: services` |
| Invalid action | 400 | `action must be one of: list, get, create, update, delete` |
| Missing itemId on get/update/delete | 400 | `itemId must be a positive integer for action "get".` |
| Missing payload on create/update | 400 | `payload must be a non-empty object for action "create".` |
| Create without title | 400 | `payload.title is required for create.` |
| Create without slug | 400 | `payload.slug is required for create.` |
| Delete without confirm | 400 | `delete requires confirm: true.` |
| Site not found | 404 | `Site not found or access denied.` |
| WordPress.com site | 400 | `CCT proxy is only supported for self-hosted WordPress sites.` |
| No app password | 400 | `WordPress Application Password not configured for this site.` |
