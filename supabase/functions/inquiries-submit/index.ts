import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const BUCKET = "inquiry-attachments";
const DEFAULT_MAX_MB = 5;
const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const buckets = new Map<string, { count: number; ts: number }>();
function rateLimited(ip: string, max = 5): boolean {
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || now - cur.ts > 60_000) { buckets.set(ip, { count: 1, ts: now }); return false; }
  cur.count++;
  return cur.count > max;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').replace(/^[._]+/, '');
  return cleaned.slice(0, 100) || 'file';
}

function mimeAllowed(mime: string, accept?: string): boolean {
  const list = (accept ? accept.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ACCEPT);
  return list.some((rule) => {
    if (rule === mime) return true;
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1));
    if (rule.startsWith('.')) return false; // extension rules ignored on server
    return false;
  });
}

async function loadFormFields(siteId: string, slug: string) {
  const { data } = await supabase
    .from('wp_inquiry_forms')
    .select('name, fields, success_message')
    .eq('site_id', siteId).eq('slug', slug).maybeSingle();
  return data;
}

const FALLBACK_FIELDS = [
  { key: 'name', label: 'Meno', type: 'text', required: true },
  { key: 'email', label: 'E-mail', type: 'email', required: true },
  { key: 'message', label: 'Správa', type: 'textarea', required: true },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // GET → return form schema
  if (req.method === 'GET') {
    const siteId = url.searchParams.get('siteId');
    const slug = url.searchParams.get('slug') ?? 'default';
    if (!siteId) return new Response(JSON.stringify({ error: 'siteId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const data = await loadFormFields(siteId, slug);
    return new Response(JSON.stringify(data ?? { name: 'Default', fields: FALLBACK_FIELDS, success_message: 'Ďakujeme, ozveme sa.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  // POST ?action=upload — multipart upload of one file for a file-type field
  if (action === 'upload') {
    if (rateLimited(ip, 10)) return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    try {
      const fd = await req.formData();
      const siteId = String(fd.get('siteId') ?? '');
      const slug = String(fd.get('formSlug') ?? 'default');
      const fieldKey = String(fd.get('fieldKey') ?? '');
      const file = fd.get('file');
      if (!siteId || !fieldKey || !(file instanceof File)) {
        return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const form = await loadFormFields(siteId, slug);
      const fields = (form?.fields as Array<Record<string, unknown>> | null) ?? FALLBACK_FIELDS;
      const field = fields.find((f) => f.key === fieldKey) as { type?: string; accept?: string; maxSize?: number } | undefined;
      if (!field || field.type !== 'file') {
        return new Response(JSON.stringify({ error: 'Field is not a file field' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const maxMb = Number(field.maxSize) > 0 ? Number(field.maxSize) : DEFAULT_MAX_MB;
      if (file.size > maxMb * 1024 * 1024) {
        return new Response(JSON.stringify({ error: `Súbor presahuje ${maxMb} MB` }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!mimeAllowed(file.type, field.accept)) {
        return new Response(JSON.stringify({ error: `Nepovolený typ súboru (${file.type})` }), { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const path = `${siteId}/${yyyy}/${mm}/${crypto.randomUUID()}-${safeName(file.name)}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      return new Response(JSON.stringify({ ok: true, path, name: file.name, size: file.size, mime: file.type }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // POST submit (JSON)
  if (rateLimited(ip)) return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json() as { siteId?: string; formSlug?: string; payload?: Record<string, unknown>; hp?: string; sourceUrl?: string };
    if (body.hp) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    if (!body.siteId || !body.payload) return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const slug = body.formSlug ?? 'default';
    const form = await loadFormFields(body.siteId, slug);
    const fields = (form?.fields as Array<{ key: string; type?: string; required?: boolean }> | null) ?? FALLBACK_FIELDS;
    const p = body.payload as Record<string, unknown>;

    for (const f of fields) {
      const v = p[f.key];
      if (f.type === 'file') {
        if (f.required && !(v && typeof v === 'object' && typeof (v as { path?: unknown }).path === 'string')) {
          return new Response(JSON.stringify({ error: `Pole '${f.key}' je povinné` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (v && typeof v === 'object') {
          const ref = v as { path?: string; name?: string; size?: number; mime?: string };
          if (typeof ref.path !== 'string' || !ref.path.startsWith(`${body.siteId}/`)) {
            return new Response(JSON.stringify({ error: `Neplatná príloha pre '${f.key}'` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          // sanitize the stored ref
          p[f.key] = { path: ref.path, name: String(ref.name ?? '').slice(0, 200), size: Number(ref.size) || 0, mime: String(ref.mime ?? '').slice(0, 100) };
        }
      } else if (f.required && !String(v ?? '').trim()) {
        return new Response(JSON.stringify({ error: `Pole '${f.key}' je povinné` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const ipHash = await sha256(ip);
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
