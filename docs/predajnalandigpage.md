# **Blueprint: AI-Generovaná Predajná Landing Page (v4.0)**
**Manifest pre AI asistenta + WordPress JetEngine + Supabase + WordPress-Sync**

---

## **1. Štruktúra JSON Manifestu (AI Output)**
AI generuje **štruktúrované JSON** podľa nasledujúcej schémy. Všetky polia sú **povinné** (okrem `subpages` a `relatedPosts`).

```json
{
  "manifestVersion": "4.0",
  "pageType": "landingPage",
  "metadata": {
    "title": "string (60-70 znakov, SEO optimalizovaný)",
    "slug": "string (lowercase, kebab-case, bez diakritiky)",
    "language": "sk|en|multi",
    "status": "draft|published|archived",
    "publishDate": "YYYY-MM-DDTHH:MM:SSZ (ISO 8601)",
    "expiryDate": "YYYY-MM-DDTHH:MM:SSZ (ISO 8601, optional)",
    "visibility": "public|private|password",
    "password": "string (ak visibility=password)"
  },
  "content": {
    "heroSection": {
      "title": "string (H1, 30-50 znakov)",
      "subtitle": "string (H2, 60-80 znakov)",
      "description": "string (max 160 znakov, pre meta description)",
      "background": {
        "type": "color|image|video",
        "value": "hex|url|youtubeId",
        "altText": "string (ak type=image|video)"
      },
      "ctaButton": {
        "text": "string (5-10 znakov, napr. 'Získaj demo')",
        "url": "string (interné URL alebo externý link)",
        "target": "_self|_blank",
        "style": "primary|secondary|outline"
      }
    },
    "featuresSection": {
      "title": "string (H2, 40-60 znakov)",
      "items": [
        {
          "icon": "string (Font Awesome class alebo URL k SVG)",
          "title": "string (H3, 20-30 znakov)",
          "description": "string (max 100 znakov)"
        }
      ]
    },
    "benefitsSection": {
      "title": "string (H2, 40-60 znakov)",
      "items": [
        {
          "title": "string (H3, 20-30 znakov)",
          "description": "string (max 120 znakov)"
        }
      ]
    },
    "testimonialsSection": {
      "title": "string (H2, 40-60 znakov)",
      "items": [
        {
          "quote": "string (max 150 znakov)",
          "author": "string",
          "company": "string (optional)",
          "avatar": "string (URL k obrázku)"
        }
      ]
    },
    "ctaSection": {
      "title": "string (H2, 40-60 znakov)",
      "description": "string (max 120 znakov)",
      "ctaButton": {
        "text": "string (5-10 znakov, napr. 'Registruj sa')",
        "url": "string (interné URL alebo externý link)",
        "target": "_self|_blank",
        "style": "primary|secondary|outline"
      }
    },
    "faqSection": {
      "title": "string (H2, 40-60 znakov)",
      "items": [
        {
          "question": "string (max 80 znakov)",
          "answer": "string (max 200 znakov)"
        }
      ]
    }
  },
  "seoMeta": {
    "metaTitle": "string (50-60 znakov, odlišné od hlavného title)",
    "metaDescription": "string (150-160 znakov)",
    "focusKeywords": ["string", "string"],
    "canonicalUrl": "string (absolútna URL, napr. https://web24.sk/landing-page-x)",
    "ogTitle": "string (alternatívny title pre sociálne siete)",
    "ogDescription": "string (alternatívny description)",
    "ogImage": "string (URL k obrázku, min. 1200x630px)",
    "ogType": "website|article",
    "twitterCard": "summary_large_image|summary",
    "twitterTitle": "string",
    "twitterDescription": "string",
    "twitterImage": "string"
  },
  "analytics": {
    "googleAnalytics": "UA-XXXXXX-Y|G-XXXXXXXXXX",
    "facebookPixel": "XXXXXXXXXXXXXXXX",
    "hotjar": "XXXXXX"
  },
  "subpages": [
    {
      "title": "string",
      "slug": "string",
      "type": "pricing|caseStudy|contact|blogPost",
      "content": "string (krátky popis pre menu)"
    }
  ],
  "relatedPosts": [
    {
      "title": "string",
      "slug": "string",
      "relationType": "crossSell|upSell|related"
    }
  ],
  "dynamicFields": {
    "customFields": {
      "formId": "string (ID formulára z JetFormBuilder)",
      "webinarId": "string (ID webinára z JetEngine)",
      "productId": "string (ID produktu z WooCommerce)"
    }
  }
}
```

---

## **2. Databázová Architektúra (Supabase)**
### **2.1 Tabuľky a Relácie**
| Tabuľka | Popis | Klúčové Polia | Relácie |
|---------|-------|---------------|---------|
| `pages` | Hlavná tabuľka stránok | `id`, `slug`, `title`, `status`, `type` | `page_seo`, `page_content`, `page_analytics` |
| `page_seo` | SEO metadata | `id`, `page_id` (FK), `meta_title`, `meta_description`, `focus_keywords` | `pages` (1:1) |
| `page_content` | Obsah stránky | `id`, `page_id` (FK), `content_json` (JSONB) | `pages` (1:1) |
| `page_analytics` | Tracking kódy | `id`, `page_id` (FK), `google_analytics`, `facebook_pixel` | `pages` (1:1) |
| `page_sections` | Sekcie stránky (Hero, Features, etc.) | `id`, `page_id` (FK), `section_type`, `order`, `data` (JSONB) | `pages` (1:N) |
| `testimonials` | Recenzie | `id`, `page_id` (FK), `quote`, `author`, `company`, `avatar` | `pages` (1:N) |
| `faq_items` | FAQ položky | `id`, `page_id` (FK), `question`, `answer`, `order` | `pages` (1:N) |
| `dynamic_fields` | Dynamické polia (formuláre, produkty) | `id`, `page_id` (FK), `form_id`, `webinar_id`, `product_id` | `pages` (1:1) |
| `subpages` | Podstránky (menu) | `id`, `parent_page_id` (FK), `title`, `slug`, `type` | `pages` (self-referencing) |
| `related_posts` | Súvisiace stránky | `id`, `page_id` (FK), `related_page_id` (FK), `relation_type` | `pages` (many-to-many) |

### **2.2 Indexy a Optimalizácie**
```sql
-- Index na rýchle vyhľadávanie podľa slug a statusu
CREATE INDEX idx_pages_slug_status ON pages(slug, status);

-- Index na JSONB polia pre rýchle dotazy
CREATE INDEX idx_page_content_data ON page_content USING GIN (content_json);
CREATE INDEX idx_page_sections_data ON page_sections USING GIN (data);

-- Index na relácie pre podstránky
CREATE INDEX idx_subpages_parent ON subpages(parent_page_id);
```

### **2.3 Funkcie a Triggery**
```sql
-- Automatické generovanie slug z title (ak nie je zadaný)
CREATE OR REPLACE FUNCTION generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(replace(replace(replace(NEW.title, ' ', '-'), 'á', 'a'), 'č', 'c'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pre automatické generovanie slug
CREATE TRIGGER trg_generate_slug
BEFORE INSERT OR UPDATE ON pages
FOR EACH ROW EXECUTE FUNCTION generate_slug();

-- Automatické nastavenie publishDate pri zmene statusu na published
CREATE OR REPLACE FUNCTION set_publish_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.publish_date := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_publish_date
BEFORE UPDATE ON pages
FOR EACH ROW EXECUTE FUNCTION set_publish_date();
```

---

## **3. WordPress JetEngine Konfigurácia**
### **3.1 CPT (Custom Post Type) Pre Landing Pages**
```php
// functions.php alebo plugin
add_action('init', function() {
  register_post_type('landing_page', [
    'label' => 'Landing Pages',
    'public' => true,
    'show_in_rest' => true,
    'supports' => ['title', 'editor', 'revisions', 'custom-fields'],
    'has_archive' => false,
    'rewrite' => ['slug' => 'landing'],
    'menu_icon' => 'dashicons-admin-page',
    'show_in_graphql' => true,
    'graphql_single_name' => 'LandingPage',
    'graphql_plural_name' => 'LandingPages',
  ]);
});
```

### **3.2 Meta Boxy Pre JSON Dáta**
```php
// Registrácia meta boxov pre JSON dáta
add_action('add_meta_boxes', function() {
  add_meta_box(
    'landing_page_json_data',
    'JSON Dáta (AI Generované)',
    'render_landing_page_json_meta_box',
    'landing_page',
    'normal',
    'high'
  );
});

function render_landing_page_json_meta_box($post) {
  $json_data = get_post_meta($post->ID, '_landing_page_json', true);
  ?>
  <div id="landing-page-json-editor">
    <textarea name="landing_page_json" style="width:100%;height:400px;"><?= esc_textarea($json_data) ?></textarea>
  </div>
  <script>
    jQuery(document).ready(function($) {
      // Inicializácia JSON editora (napr. CodeMirror)
      const editor = CodeMirror.fromTextArea(document.getElementById('landing_page_json'), {
        mode: 'application/json',
        lineNumbers: true,
        theme: 'default',
        indentWithTabs: true,
        tabSize: 2,
      });
    });
  </script>
  <?php
}

add_action('save_post', function($post_id) {
  if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
  if (!current_user_can('edit_post', $post_id)) return;
  if (wp_is_post_revision($post_id)) return;

  if (isset($_POST['landing_page_json'])) {
    update_post_meta($post_id, '_landing_page_json', sanitize_textarea_field($_POST['landing_page_json']));
  }
});
```

### **3.3 Dynamic Fields (JetEngine)**
- **Formulár pre CTA tlačidlá** (JetFormBuilder)
- **Webináre** (JetEngine Dynamic Repeater)
- **Produkty** (WooCommerce + JetEngine Relations)

---

## **4. WordPress-Sync Mechanizmus**
### **4.1 Automatické Publikovanie z Supabase**
```php
// functions.php
add_action('init', function() {
  // Kontrola zmien v Supabase každých 5 minút
  if (wp_next_scheduled('sync_supabase_landing_pages')) {
    wp_clear_scheduled_hook('sync_supabase_landing_pages');
  }
  wp_schedule_event(time(), 'five_minutes', 'sync_supabase_landing_pages');
});

add_action('sync_supabase_landing_pages', 'sync_landing_pages_from_supabase');

function sync_landing_pages_from_supabase() {
  $supabase_url = 'https://YOUR_SUPABASE_URL.supabase.co/rest/v1';
  $supabase_key = 'YOUR_SUPABASE_KEY';
  $endpoint = '/pages?select=*';

  $response = wp_remote_get($supabase_url . $endpoint, [
    'headers' => [
      'apikey' => $supabase_key,
      'Authorization' => 'Bearer ' . $supabase_key,
      'Content-Type' => 'application/json',
    ],
  ]);

  if (is_wp_error($response)) {
    error_log('Supabase API Error: ' . $response->get_error_message());
    return;
  }

  $body = json_decode(wp_remote_retrieve_body($response), true);

  foreach ($body as $page_data) {
    $existing_post = get_page_by_path($page_data['slug'], OBJECT, 'landing_page');

    if (!$existing_post) {
      // Vytvorenie novej stránky
      $post_id = wp_insert_post([
        'post_title' => $page_data['title'],
        'post_name' => $page_data['slug'],
        'post_status' => 'draft',
        'post_type' => 'landing_page',
        'post_content' => '[jet_engine_dynamic_field id="' . $page_data['dynamicFields']['formId'] . '"]',
      ]);

      // Uloženie JSON dát
      update_post_meta($post_id, '_landing_page_json', json_encode($page_data));

      // Publikovanie (ak je status published)
      if ($page_data['metadata']['status'] === 'published') {
        wp_update_post(['ID' => $post_id, 'post_status' => 'publish']);
      }
    } else {
      // Aktualizácia existujúcej stránky
      wp_update_post([
        'ID' => $existing_post->ID,
        'post_title' => $page_data['title'],
        'post_status' => $page_data['metadata']['status'],
      ]);

      update_post_meta($existing_post->ID, '_landing_page_json', json_encode($page_data));
    }
  }
}
```

---

## **5. SEO Optimalizácia a Štruktúra Stránky**
### **5.1 Štruktúra URL**
```
https://web24.sk/landing/{slug}
https://web24.sk/landing/{slug}/pricing
https://web24.sk/landing/{slug}/case-study
https://web24.sk/landing/{slug}/contact
```

### **5.2 Interné Linkovanie**
- **Cross-linking** medzi súvisiacimi landing page (napr. "Získaj demo" → "Cenník")
- **Anchor texty** s klúčovými slovami
- **Breadcrumb** pre navigáciu

### **5.3 Schema Markup (JSON-LD)**
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{title}",
  "description": "{content.heroSection.description}",
  "brand": {
    "@type": "Brand",
    "name": "Web24"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "120"
  },
  "offers": {
    "@type": "Offer",
    "url": "{content.heroSection.ctaButton.url}",
    "priceCurrency": "EUR",
    "price": "0",
    "availability": "https://schema.org/InStock"
  }
}
```

---

## **6. Bezpečnosť a Validácia**
### **6.1 Ošetrenie JSON Dát**
```php
function validate_landing_page_json($json_data) {
  $required_fields = ['title', 'slug', 'content', 'seoMeta'];
  foreach ($required_fields as $field) {
    if (!isset($json_data[$field])) {
      return new WP_Error('invalid_json', "Chýbajúce pole: $field");
    }
  }

  // Kontrola dĺžky textov
  if (strlen($json_data['title']) > 70) {
    return new WP_Error('title_too_long', 'Title musí mať max. 70 znakov.');
  }

  // Sanitizácia HTML v texte
  $json_data['content'] = wp_kses_post($json_data['content']);

  return $json_data;
}
```

### **6.2 Oprávnenia a Autentifikácia**
- **Supabase RLS (Row-Level Security)**:
  ```sql
  CREATE POLICY "Allow AI to write landing pages"
  ON pages FOR ALL
  USING (auth.jwt() ->> 'email' = 'ai@web24.sk');
  ```
- **WordPress Nonce** pre API endpointy

---

## **7. Monitorovanie a Logovanie**
### **7.1 Logovanie Zmeny**
```php
add_action('save_post_landing_page', function($post_id) {
  $old_data = get_post_meta($post_id, '_landing_page_json_old', true);
  $new_data = get_post_meta($post_id, '_landing_page_json', true);

  if ($old_data !== $new_data) {
    error_log("Zmena landing page: {$post_id} - " . current_time('mysql'));
    update_post_meta($post_id, '_landing_page_json_old', $new_data);
  }
}, 10, 1);
```

### **7.2 Chybové Hlásenia**
- **Slack/Email notifikácie** pre neúspešné synchronizácie
- **Sentry** pre sledovanie chýb v produkcii

---

## **8. GrafQL Schéma (Pre Frontend)**
```graphql
type LandingPage implements Node {
  id: ID!
  title: String!
  slug: String!
  status: String!
  content: LandingPageContent!
  seoMeta: SeoMeta!
  analytics: Analytics!
  subpages: [Subpage!]!
  relatedPosts: [RelatedPost!]!
}

type LandingPageContent {
  heroSection: HeroSection!
  featuresSection: FeaturesSection!
  benefitsSection: BenefitsSection!
  testimonialsSection: TestimonialsSection!
  ctaSection: CtaSection!
  faqSection: FaqSection!
}

type SeoMeta {
  metaTitle: String!
  metaDescription: String!
  focusKeywords: [String!]!
  canonicalUrl: String!
  ogImage: String!
}

type Analytics {
  googleAnalytics: String
  facebookPixel: String
}
```

---

## **9. Frontend Šablóna (Blade alebo Twig)**
```html
<!-- landing-page.blade.php -->
@extends('layouts.app')

@section('seo')
  <title>{{ $page->seoMeta->metaTitle }}</title>
  <meta name="description" content="{{ $page->seoMeta->metaDescription }}">
  <meta name="keywords" content="{{ implode(', ', $page->seoMeta->focusKeywords) }}">
  <meta property="og:title" content="{{ $page->seoMeta->ogTitle }}">
  <meta property="og:description" content="{{ $page->seoMeta->ogDescription }}">
  <meta property="og:image" content="{{ $page->seoMeta->ogImage }}">
@endsection

@section('content')
  <!-- Hero Section -->
  <section class="hero">
    <h1>{{ $page->content->heroSection->title }}</h1>
    <p>{{ $page->content->heroSection->subtitle }}</p>
    <a href="{{ $page->content->heroSection->ctaButton->url }}"
       class="btn btn-{{ $page->content->heroSection->ctaButton->style }}">
      {{ $page->content->heroSection->ctaButton->text }}
    </a>
  </section>

  <!-- Features Section -->
  <section class="features">
    <h2>{{ $page->content->featuresSection->title }}</h2>
    <div class="features-grid">
      @foreach($page->content->featuresSection->items as $feature)
        <div class="feature">
          <i class="{{ $feature->icon }}"></i>
          <h3>{{ $feature->title }}</h3>
          <p>{{ $feature->description }}</p>
        </div>
      @endforeach
    </div>
  </section>

  <!-- FAQ Section -->
  <section class="faq">
    <h2>{{ $page->content->faqSection->title }}</h2>
    <div class="faq-accordion">
      @foreach($page->content->faqSection->items as $faq)
        <div class="faq-item">
          <h3>{{ $faq->question }}</h3>
          <p>{{ $faq->answer }}</p>
        </div>
      @endforeach
    </div>
  </section>
@endsection
```
