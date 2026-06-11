import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DraftInput {
  siteId: string;
  brief: string;
  mode: "create" | "rewrite" | "seo";
  locale: string;
  existing?: Record<string, unknown>;
}

const SEO_ROBOTS_VALUES = [
  "index,follow",
  "index,nofollow",
  "noindex,follow",
  "noindex,nofollow",
];

// Helper functions for validation
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length <= 200;
}

function coerceNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Mistral configuration check
    const mistralKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "MISTRAL_API_KEY is not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mistralModel = Deno.env.get("MISTRAL_MODEL") || "mistral-large-latest";

    // 3. Parse and validate payload
    const body: DraftInput = await req.json();
    const { brief, mode, locale, existing } = body;

    if (!brief || typeof brief !== "string" || !brief.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "brief is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["create", "rewrite", "seo"].includes(mode)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Construct prompt
    const systemPrompt = `You are an expert AI WordPress content designer. You generate structured content payloads for JetEngine Custom Content Type (CCT) services.
You must output a single JSON object. Do not include markdown code block formatting or any explanation. Output ONLY valid, raw JSON.
Language: Slovak (Slovenčina). The values of text fields must be in Slovak, but technical values (keys, slug) must follow instructions.

JSON Schema structure:
{
  "title": "Service name (max 200 chars)",
  "slug": "lowercase-kebab-case-slug",
  "tagline": "Short marketing tagline/catchphrase",
  "description": "Rich description explaining the service details",
  "duration": number (duration in minutes, or null if unknown),
  "price": number (price in Euros, or null if unknown),
  "capacity": number (max customer capacity, or null if unknown/unlimited),
  "service_type": "Service type category",
  "service_category": "Service level/pricing tier category",
  "seo_title": "SEO Page Title (approx 50-60 characters)",
  "seo_description": "SEO meta description (approx 150-160 characters)",
  "seo_keywords": "comma, separated, list, of, keywords",
  "seo_robots": "index,follow"
}

Rules based on mode:
- "create": Generate a completely new service draft from the brief. Fill in all fields creatively.
- "rewrite": Rewrite/enhance the description and tagline of the "existing" service using the brief's feedback. Keep other fields unchanged unless requested.
- "seo": Optimize SEO fields (seo_title, seo_description, seo_keywords) using the brief. Retain or optimize the service details from "existing".

Current mode: ${mode}
Locale: ${locale || "sk-SK"}
Existing Draft context (if available): ${JSON.stringify(existing || {})}

Brief requirements: ${brief}`;

    // 5. Call Mistral API
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mistralKey}`,
      },
      body: JSON.stringify({
        model: mistralModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: brief }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ ok: false, error: "Mistral API error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return new Response(
        JSON.stringify({ ok: false, error: "Empty response from Mistral AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. JSON Parse & Server-Side Validation
    let aiDraft: Record<string, unknown>;
    try {
      aiDraft = JSON.parse(content);
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to parse AI output as JSON", details: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side validation rules
    const title = typeof aiDraft.title === "string" ? aiDraft.title.trim() : "";
    let slug = typeof aiDraft.slug === "string" ? aiDraft.slug.trim() : "";

    if (!title) {
      return new Response(
        JSON.stringify({ ok: false, error: "AI failed to generate a valid title" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure slug is populated and valid
    if (!slug) {
      slug = slugify(title);
    } else {
      slug = slugify(slug);
    }

    if (!isValidSlug(slug)) {
      slug = slugify(title);
    }

    const duration = coerceNumberOrNull(aiDraft.duration);
    const price = coerceNumberOrNull(aiDraft.price);
    const capacity = coerceNumberOrNull(aiDraft.capacity);

    const rawRobots = typeof aiDraft.seo_robots === "string" ? aiDraft.seo_robots : "";
    const seoRobots = SEO_ROBOTS_VALUES.includes(rawRobots)
      ? rawRobots
      : "index,follow";

    // Build strict response payload (remove/ignore extra keys)
    const cleanedDraft = {
      title,
      slug,
      tagline: typeof aiDraft.tagline === "string" ? aiDraft.tagline.trim() : "",
      description: typeof aiDraft.description === "string" ? aiDraft.description.trim() : "",
      duration,
      price,
      capacity,
      service_type: typeof aiDraft.service_type === "string" ? aiDraft.service_type.trim() : "",
      service_category: typeof aiDraft.service_category === "string" ? aiDraft.service_category.trim() : "",
      image_id: null,
      seo_title: typeof aiDraft.seo_title === "string" ? aiDraft.seo_title.trim() : "",
      seo_description: typeof aiDraft.seo_description === "string" ? aiDraft.seo_description.trim() : "",
      seo_keywords: typeof aiDraft.seo_keywords === "string" ? aiDraft.seo_keywords.trim() : "",
      seo_canonical: null,
      seo_og_image: null,
      seo_robots: seoRobots,
    };

    return new Response(
      JSON.stringify({
        ok: true,
        draft: cleanedDraft,
        meta: {
          model: mistralModel,
          mode,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("wordpress-cct-draft error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
