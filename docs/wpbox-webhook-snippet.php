<?php
/**
 * wpBOX Webhook Sync Snippet
 * 
 * Tento kód zachytáva uloženie/aktualizáciu príspevku (news, services, atď.) 
 * a asynchrónne odosiela zmenené dáta do wpBOX (Supabase Edge funkcie).
 */

add_action('save_post', 'wpbox_send_webhook_on_save', 10, 3);

function wpbox_send_webhook_on_save($post_id, $post, $update) {
    // Zabrániť spúšťaniu pri automatických zálohách (autosaves) alebo revíziách
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }
    if (wp_is_post_revision($post_id)) {
        return;
    }
    if ($post->post_status === 'auto-draft') {
        return;
    }

    // Povolené typy obsahu, ktoré synchronizujeme
    $allowed_post_types = array('post', 'page', 'services', 'references', 'faq');
    if (!in_array($post->post_type, $allowed_post_types)) {
        return;
    }

    // === NASTAVENIE WEBHOOKU ===
    // Sem doplň svoje skutočné Site ID a Webhook Secret zo Supabase (wp_sites)
    $site_id = '6ccf3a5c-9506-4d35-8ee6-e5819e423e21'; 
    $webhook_secret = '4ead9b35-c78b-4d61-8967-13bab9aa1295';
    
    $webhook_url = sprintf(
        'https://qytsiddrksybwpqldjfj.supabase.co/functions/v1/wordpress-webhook-receiver?site_id=%s&secret=%s',
        urlencode($site_id),
        urlencode($webhook_secret)
    );

    // Príprava dát pre webhook
    $payload = array(
        'post_id'       => (int) $post_id,
        'post_type'     => $post->post_type,
        'post_status'   => $post->post_status,
        'post_title'    => $post->post_title,
        'post_content'  => $post->post_content,
        'post_excerpt'  => $post->post_excerpt,
        'post_name'     => $post->post_name, // slug
        'post_date'     => $post->post_date,
        'post_modified' => $post->post_modified,
    );

    // Asynchrónne odoslanie webhooku (neblokuje uloženie príspevku v adminovi)
    wp_remote_post($webhook_url, array(
        'method'      => 'POST',
        'timeout'     => 5,
        'redirection' => 5,
        'httpversion' => '1.0',
        'blocking'    => false, // Veľmi dôležité - nečaká na odpoveď Supabase
        'headers'     => array(
            'Content-Type' => 'application/json',
        ),
        'body'        => json_encode($payload),
        'data_format' => 'body',
    ));
}
