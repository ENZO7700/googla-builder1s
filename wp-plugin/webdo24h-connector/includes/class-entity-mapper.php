<?php
/**
 * Mapovanie entít z wpBOX registra na WordPress CPT / polia.
 *
 * Každá entita vie:
 *  - na aký CPT/page slug sa mapuje
 *  - ako previesť payload z buildera na WP REST post data
 *  - ako previesť payload na ACF polia (ak je ACF nainštalovaný)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Webdo24h_Entity_Mapper {

	/** Definícia entít — musí byť v súlade s BASE_ENTITIES v builders entities.ts */
	const ENTITY_MAP = array(
		'company'           => array( 'cpt' => 'page',        'slug' => 'company-info',    'kind' => 'singleton' ),
		'header'            => array( 'cpt' => 'page',        'slug' => 'header',           'kind' => 'singleton' ),
		'footer'            => array( 'cpt' => 'page',        'slug' => 'footer',           'kind' => 'singleton' ),
		'about'             => array( 'cpt' => 'page',        'slug' => 'about',            'kind' => 'singleton' ),
		'services'          => array( 'cpt' => 'services',    'slug' => null,               'kind' => 'repeater'  ),
		'service_categories'=> array( 'cpt' => null,          'taxonomy' => 'service_category', 'kind' => 'repeater' ),
		'news'              => array( 'cpt' => 'post',        'slug' => null,               'kind' => 'repeater'  ),
		'members'           => array( 'cpt' => 'team-member', 'slug' => null,               'kind' => 'repeater'  ),
		'references'        => array( 'cpt' => 'reference',   'slug' => null,               'kind' => 'repeater'  ),
		'faq'               => array( 'cpt' => 'faq',         'slug' => null,               'kind' => 'repeater'  ),
		'gallery'           => array( 'cpt' => 'page',        'slug' => 'gallery',          'kind' => 'singleton' ),
		'inquiry_forms'     => array( 'cpt' => null,          'slug' => null,               'kind' => 'repeater'  ),
	);

	/**
	 * Konvertuje builder payload na WP REST post data.
	 *
	 * @param string $entity  Kľúč entity (napr. 'services')
	 * @param array  $payload Dáta z buildera
	 * @return array          WP REST kompatibilný array
	 */
	public static function to_wp_post( string $entity, array $payload ): array {
		$base = array(
			'status' => ( $payload['published'] ?? false ) ? 'publish' : 'draft',
		);

		if ( isset( $payload['title'] ) ) {
			$base['title'] = sanitize_text_field( $payload['title'] );
		}
		if ( isset( $payload['slug'] ) ) {
			$base['slug'] = sanitize_title( $payload['slug'] );
		}
		if ( isset( $payload['excerpt'] ) ) {
			$base['excerpt'] = wp_kses_post( $payload['excerpt'] );
		}
		if ( isset( $payload['content_html'] ) ) {
			$base['content'] = wp_kses_post( $payload['content_html'] );
		} elseif ( isset( $payload['description_html'] ) ) {
			$base['content'] = wp_kses_post( $payload['description_html'] );
		}
		if ( isset( $payload['published_at'] ) ) {
			$base['date'] = sanitize_text_field( $payload['published_at'] );
		}

		// Špeciálne polia podľa entity
		switch ( $entity ) {
			case 'services':
				if ( isset( $payload['order'] ) ) {
					$base['menu_order'] = (int) $payload['order'];
				}
				break;
			case 'members':
				if ( isset( $payload['position'] ) ) {
					$base['meta'] = array( 'webdo24h_position' => sanitize_text_field( $payload['position'] ) );
				}
				break;
		}

		return $base;
	}

	/**
	 * Zapisuje ACF polia ak je ACF nainštalovaný.
	 *
	 * @param int    $post_id
	 * @param string $entity
	 * @param array  $payload
	 */
	public static function write_acf_fields( int $post_id, string $entity, array $payload ): void {
		if ( ! function_exists( 'update_field' ) ) {
			return;
		}

		// SEO polia
		if ( isset( $payload['seo'] ) && is_array( $payload['seo'] ) ) {
			$seo = $payload['seo'];
			if ( isset( $seo['title'] ) )       update_field( 'webdo24h_seo_title',       sanitize_text_field( $seo['title'] ),       $post_id );
			if ( isset( $seo['description'] ) ) update_field( 'webdo24h_seo_description', sanitize_text_field( $seo['description'] ), $post_id );
			if ( isset( $seo['og_image'] ) )    update_field( 'webdo24h_og_image',        esc_url_raw( $seo['og_image'] ),            $post_id );
		}

		// Social polia
		if ( isset( $payload['social'] ) && is_array( $payload['social'] ) ) {
			foreach ( $payload['social'] as $network => $url ) {
				update_field( 'webdo24h_social_' . sanitize_key( $network ), esc_url_raw( $url ), $post_id );
			}
		}

		// CTA button
		if ( isset( $payload['cta'] ) && is_array( $payload['cta'] ) ) {
			$cta = $payload['cta'];
			if ( isset( $cta['label'] ) ) update_field( 'webdo24h_cta_label', sanitize_text_field( $cta['label'] ), $post_id );
			if ( isset( $cta['url'] ) )   update_field( 'webdo24h_cta_url',   esc_url_raw( $cta['url'] ),          $post_id );
		}

		// Špecifické polia pre entity
		switch ( $entity ) {
			case 'company':
				if ( isset( $payload['phone'] ) )   update_field( 'webdo24h_phone',   sanitize_text_field( $payload['phone'] ),   $post_id );
				if ( isset( $payload['email'] ) )   update_field( 'webdo24h_email',   sanitize_email( $payload['email'] ),        $post_id );
				if ( isset( $payload['address'] ) ) update_field( 'webdo24h_address', sanitize_textarea_field( $payload['address'] ), $post_id );
				if ( isset( $payload['ico'] ) )     update_field( 'webdo24h_ico',     sanitize_text_field( $payload['ico'] ),     $post_id );
				break;

			case 'members':
				if ( isset( $payload['photo_url'] ) ) update_field( 'webdo24h_photo', esc_url_raw( $payload['photo_url'] ), $post_id );
				break;

			case 'references':
				if ( isset( $payload['client'] ) ) update_field( 'webdo24h_client', sanitize_text_field( $payload['client'] ), $post_id );
				if ( isset( $payload['url'] ) )    update_field( 'webdo24h_url',    esc_url_raw( $payload['url'] ),          $post_id );
				break;
		}
	}

	/**
	 * Vráti definíciu entity alebo null ak entita neexistuje.
	 */
	public static function get_definition( string $entity ): ?array {
		return self::ENTITY_MAP[ $entity ] ?? null;
	}

	/**
	 * Schema pre /schema endpoint — čo builder môže syncovať.
	 */
	public static function get_schema(): array {
		$schema = array();
		foreach ( self::ENTITY_MAP as $key => $def ) {
			$schema[] = array(
				'entity'   => $key,
				'kind'     => $def['kind'],
				'cpt'      => $def['cpt'] ?? null,
				'taxonomy' => $def['taxonomy'] ?? null,
				'acf'      => function_exists( 'update_field' ),
			);
		}
		return $schema;
	}
}
