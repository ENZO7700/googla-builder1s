import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.0";
import { jsonInternalError } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WPWebhookPayload {
  post_id: number;
  post_type: string;
  post_status: string;
  post_title: string;
  post_content: string;
  post_excerpt?: string;
  post_name?: string; // slug
  post_date?: string;
  post_modified?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const urlParams = new URL(req.url).searchParams;
    const siteId = urlParams.get('site_id');
    const secret = urlParams.get('secret');

    if (!siteId || !secret) {
      return new Response(JSON.stringify({ error: 'Missing site_id or secret' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Verify webhook secret and site existence
    const { data: site, error: siteErr } = await supabase
      .from('wp_sites')
      .select('*')
      .eq('id', siteId)
      .eq('webhook_secret', secret)
      .single();

    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: 'Unauthorized webhook access' }), { status: 401, headers: corsHeaders });
    }

    const payload = await req.json() as WPWebhookPayload;
    if (!payload || !payload.post_id) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders });
    }

    const postId = payload.post_id;
    const postType = payload.post_type;
    const isPublished = payload.post_status === 'publish';

    let updatedTable = '';
    let recordId = '';

    // Check wp_news
    const { data: newsRow } = await supabase.from('wp_news').select('id').eq('site_id', siteId).eq('wp_post_id', postId).maybeSingle();
    if (newsRow) {
      updatedTable = 'wp_news';
      recordId = newsRow.id;
      await supabase.from('wp_news').update({
        title: payload.post_title,
        slug: payload.post_name || null,
        excerpt: payload.post_excerpt || null,
        content_html: payload.post_content,
        published: isPublished,
        published_at: payload.post_date ? new Date(payload.post_date).toISOString() : null,
        sync_status: 'synced',
        wp_modified_at: payload.post_modified ? new Date(payload.post_modified).toISOString() : new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      }).eq('id', recordId);
    }

    // Check wp_services if not found yet
    if (!updatedTable) {
      const { data: serviceRow } = await supabase.from('wp_services').select('id').eq('site_id', siteId).eq('wp_post_id', postId).maybeSingle();
      if (serviceRow) {
        updatedTable = 'wp_services';
        recordId = serviceRow.id;
        await supabase.from('wp_services').update({
          title: payload.post_title,
          slug: payload.post_name || null,
          excerpt: payload.post_excerpt || null,
          description_html: payload.post_content,
          published: isPublished,
          sync_status: 'synced',
          wp_modified_at: payload.post_modified ? new Date(payload.post_modified).toISOString() : new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        }).eq('id', recordId);
      }
    }

    // Check wp_faq if not found yet
    if (!updatedTable) {
      const { data: faqRow } = await supabase.from('wp_faq').select('id').eq('site_id', siteId).eq('wp_post_id', postId).maybeSingle();
      if (faqRow) {
        updatedTable = 'wp_faq';
        recordId = faqRow.id;
        await supabase.from('wp_faq').update({
          question: payload.post_title,
          answer: payload.post_content,
          published: isPublished,
          sync_status: 'synced',
          updated_at: new Date().toISOString()
        }).eq('id', recordId);
      }
    }

    // Check wp_references if not found yet
    if (!updatedTable) {
      const { data: refRow } = await supabase.from('wp_references').select('id').eq('site_id', siteId).eq('wp_post_id', postId).maybeSingle();
      if (refRow) {
        updatedTable = 'wp_references';
        recordId = refRow.id;
        await supabase.from('wp_references').update({
          project_title: payload.post_title,
          description_html: payload.post_content,
          published: isPublished,
          updated_at: new Date().toISOString()
        }).eq('id', recordId);
      }
    }

    // Check wp_about if not found yet
    if (!updatedTable) {
      const { data: aboutRow } = await supabase.from('wp_about').select('id').eq('site_id', siteId).eq('wp_post_id', postId).maybeSingle();
      if (aboutRow) {
        updatedTable = 'wp_about';
        recordId = aboutRow.id;
        await supabase.from('wp_about').update({
          title: payload.post_title,
          content_html: payload.post_content,
          sync_status: 'synced',
          wp_modified_at: payload.post_modified ? new Date(payload.post_modified).toISOString() : new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        }).eq('id', recordId);
      }
    }

    // If not found in any table and it is a blog post (post_type === 'post'), create it in wp_news
    if (!updatedTable && postType === 'post') {
      const { data: newNews, error: insertErr } = await supabase.from('wp_news').insert({
        site_id: siteId,
        title: payload.post_title,
        slug: payload.post_name || null,
        excerpt: payload.post_excerpt || null,
        content_html: payload.post_content,
        published: isPublished,
        published_at: payload.post_date ? new Date(payload.post_date).toISOString() : null,
        wp_post_id: postId,
        sync_status: 'synced',
        wp_modified_at: payload.post_modified ? new Date(payload.post_modified).toISOString() : new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      }).select('id').single();

      if (insertErr) {
        throw new Error(`Failed to auto-insert new post into wp_news: ${insertErr.message}`);
      }

      updatedTable = 'wp_news (Auto-inserted)';
      recordId = newNews.id;
    }

    if (!updatedTable) {
      return new Response(JSON.stringify({ ok: true, message: 'Post ignored (not tracked in wpBOX)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Insert to audit log
    await supabase.from('wp_audit_log').insert({
      site_id: siteId,
      user_id: site.user_id,
      action: `webhook_sync_update`,
      resource_type: updatedTable,
      resource_id: String(postId),
      status: 'success',
      details: {
        post_id: postId,
        post_type: postType,
        post_status: payload.post_status,
        record_id: recordId
      }
    });

    return new Response(JSON.stringify({ ok: true, table: updatedTable, id: recordId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return jsonInternalError(e, corsHeaders, "wordpress-webhook-receiver");
  }
});
