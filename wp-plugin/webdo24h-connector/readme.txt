=== webdo24h Connector ===
Contributors: larsenevans
Tags: rest-api, sync, wpbox, builder
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 1.1.0
License: GPL-2.0+

Prepojenie wpBOX buildera s WordPress cez vlastný REST namespace /webdo24h/v1.

== Description ==

Plugin registruje vlastný REST API namespace `/webdo24h/v1` a umožňuje wpBOX dashboardu synchronizovať entity (služby, novinky, členovia tímu, referencie, FAQ a galéria) priamo do WordPress Custom Post Types.

**Endpointy:**

* `GET /webdo24h/v1` — info o plugine
* `GET /webdo24h/v1/schema` — schema entít
* `POST /webdo24h/v1/sync` — sync entity z buildera do WP
* `DELETE /webdo24h/v1/sync` — presun do koša
* `POST /webdo24h/v1/webhook-test` — test konektivity

**Autentifikácia:**

* WordPress Application Password (odporúčané)
* Vlastný API kľúč (nastavíte v Nastavenia → webdo24h Connector)

**ACF podpora:**

Ak je nainštalovaný Advanced Custom Fields, plugin automaticky zapisuje SEO, social a entity-specific polia.

== Installation ==

1. Nahrajte priečinok `webdo24h-connector` do `/wp-content/plugins/`.
2. Aktivujte plugin v WP admin.
3. Otvorte Nastavenia → webdo24h Connector a vygenerujte API kľúč.
4. Vložte API kľúč do wpBOX dashboardu (WordPress Connection → API Key).

Alebo použite WP-CLI:

```bash
wp plugin install /path/to/webdo24h-connector.zip --activate
```

== Changelog ==

= 1.1.0 =
* Release balík pre wpBOX production flow
* Pridaný samostatný application-passwords compatibility fix plugin
* Pridaný standalone welcome/wallpaper HTML archive pre referenčný export

= 1.0.0 =
* Prvé vydanie
* REST namespace /webdo24h/v1
* Sync: company, header, footer, about, services, service_categories, news, members, references, faq, gallery
* ACF podpora pre SEO, social a CTA polia
* Audit log posledných 100 sync operácií
