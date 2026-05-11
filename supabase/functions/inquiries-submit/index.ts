import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const buckets = new Map<string, { count: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || now - cur.ts > 60_000) { buckets.set(ip, { count: 1, ts: now }); return false; }
  cur.count++;
  return cur.count > 5;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // GET ?meta=1&siteId=...&slug=default → returns form schema
  if (req.method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    const slug = url.searchParams.get('slug') ?? 'default';
    if (!siteId) return new Response(JSON.stringify({ error: 'siteId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data } = await supabase.from('wp_inquiry_forms').select('name, fields, success_message').eq('site_id', siteId).eq('slug', slug).maybeSingle();
    return new Response(JSON.stringify(data ?? { name: 'Default', fields: [
      { key: 'name', label: 'Meno', type: 'text', required: true },
      { key: 'email', label: 'E-mail', type: 'email', required: true },
      { key: 'message', label: 'Správa', type: 'textarea', required: true },
    ], success_message: 'Ďakujeme, ozveme sa.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  if (rateLimited(ip)) return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json() as { siteId?: string; formSlug?: string; payload?: Record<string, unknown>; hp?: string; sourceUrl?: string };
    if (body.hp) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders }); // honeypot
    if (!body.siteId || !body.payload) return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const slug = body.formSlug ?? 'default';
    const { data: form } = await supabase.from('wp_inquiry_forms').select('fields').eq('site_id', body.siteId).eq('slug', slug).maybeSingle();
    const fields = (form?.fields as Array<{ key: string; required?: boolean }> | null) ?? [
      { key: 'name', required: true }, { key: 'email', required: true }, { key: 'message', required: true },
    ];
    for (const f of fields) {
      if (f.required && !String((body.payload as Record<string, unknown>)[f.key] ?? '').trim()) {
        return new Response(JSON.stringify({ error: `Pole '${f.key}' je povinné` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const ipHash = await sha256(ip);
    const p = body.payload as Record<string, unknown>;
    const { error } = await supabase.from('wp_inquiries').insert({
      site_id: body.siteId,
      form_slug: slug,
      payload: p,
      name: typeof p.name === 'string' ? p.name : null,
      email: typeof p.email === 'string' ? p.email : null,
      phone: typeof p.phone === 'string' ? p.phone : null,
      message: typeof p.message === 'string' ? p.message : null,
      source_url: body.sourceUrl ?? null,
      ip_hash: ipHash,
      user_agent: req.headers.get('user-agent') ?? null,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
