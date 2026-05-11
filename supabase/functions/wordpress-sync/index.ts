import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SyncReq { siteId: string; entity: 'about' | 'service' | 'reference' | 'news'; recordId: string }

const ENTITY_TABLE: Record<SyncReq['entity'], string> = {
  about: 'wp_about',
  service: 'wp_services',
  reference: 'wp_references',
  news: 'wp_news',
};

const ENTITY_WP_PATH: Record<SyncReq['entity'], string> = {
  about: 'pages',
  service: 'posts', // CPT 'services' fallback
  reference: 'posts',
  news: 'posts',
};

function mapPayload(entity: SyncReq['entity'], row: Record<string, unknown>) {
  switch (entity) {
    case 'about':
      return { title: row.title ?? '', content: row.content_html ?? '', status: 'publish' };
    case 'service':
      return { title: row.title, slug: row.slug ?? undefined, excerpt: row.excerpt ?? '', content: row.description_html ?? '', status: row.published ? 'publish' : 'draft' };
    case 'reference':
      return { title: row.project_title, content: row.description_html ?? '', status: row.published ? 'publish' : 'draft' };
    case 'news':
      return { title: row.title, slug: row.slug ?? undefined, excerpt: row.excerpt ?? '', content: row.content_html ?? '', date: row.published_at ?? undefined, status: row.published ? 'publish' : 'draft' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders });

    const body = await req.json() as SyncReq;
    if (!body?.siteId || !body?.entity || !ENTITY_TABLE[body.entity]) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: corsHeaders });
    }

    const { data: site, error: siteErr } = await supabase.from('wp_sites').select('*').eq('id', body.siteId).eq('user_id', user.id).single();
    if (siteErr || !site) return new Response(JSON.stringify({ error: 'Site not found' }), { status: 404, headers: corsHeaders });

    const table = ENTITY_TABLE[body.entity];
    const { data: row, error: rowErr } = await supabase.from(table).select('*').eq('id', body.recordId).eq('site_id', body.siteId).single();
    if (rowErr || !row) return new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: corsHeaders });

    if (site.site_type !== 'self' || !site.username || !site.app_password_encrypted) {
      return new Response(JSON.stringify({ error: 'Sync zatiaľ podporuje iba self-hosted siteov s Application Password.' }), { status: 400, headers: corsHeaders });
    }

    const base = String(site.base_url).replace(/\/+$/, '');
    const path = ENTITY_WP_PATH[body.entity];
    const wpPostId = (row as { wp_post_id?: number | null }).wp_post_id;
    const url = wpPostId ? `${base}/wp-json/wp/v2/${path}/${wpPostId}` : `${base}/wp-json/wp/v2/${path}`;
    const credentials = btoa(`${site.username}:${atob(site.app_password_encrypted)}`);

    const wpRes = await fetch(url, {
      method: wpPostId ? 'POST' : 'POST', // WP REST accepts POST for both create + update via /id
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` },
      body: JSON.stringify(mapPayload(body.entity, row as Record<string, unknown>)),
    });
    const wpJson = await wpRes.json();
    if (!wpRes.ok) {
      await supabase.from('wp_audit_log').insert({ site_id: body.siteId, user_id: user.id, action: `sync_${body.entity}`, status: 'error', error_message: wpJson?.message ?? `HTTP ${wpRes.status}`, details: wpJson });
      return new Response(JSON.stringify({ error: wpJson?.message ?? 'WP error', details: wpJson }), { status: 502, headers: corsHeaders });
    }

    const newId = wpJson.id as number;
    await supabase.from(table).update({ wp_post_id: newId }).eq('id', body.recordId);
    await supabase.from('wp_audit_log').insert({ site_id: body.siteId, user_id: user.id, action: `sync_${body.entity}`, resource_id: String(newId), status: 'success', details: { wp_id: newId } });

    return new Response(JSON.stringify({ wp_post_id: newId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
