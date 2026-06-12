<?php
/**
 * Hlavný REST controller pre namespace /webdo24h/v1
 *
 * Endpointy:
 *  GET  /webdo24h/v1          → info o plugine + verzia
 *  GET  /webdo24h/v1/schema   → schema entít dostupných na sync
 *  POST /webdo24h/v1/sync     → synchronizácia entity z buildera do WP
 *  POST /webdo24h/v1/webhook-test → overenie webhookovej konektivity
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Webdo24h_REST_Controller {

	const NAMESPACE = 'webdo24h/v1';

	public function register_routes(): void {
		// GET /webdo24h/v1 — root info
		register_rest_route( self::NAMESPACE, '/', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_info' ),
			'permission_callback' => '__return_true', // verejný, len čítanie meta info
		) );

		// GET /webdo24h/v1/schema — schema entít
		register_rest_route( self::NAMESPACE, '/schema', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_schema' ),
			'permission_callback' => array( $this, 'check_auth' ),
		) );

		// POST /webdo24h/v1/sync — hlavný sync endpoint
		register_rest_route( self::NAMESPACE, '/sync', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'sync_entity' ),
			'permission_callback' => array( $this, 'check_auth' ),
			'args'                => $this->get_sync_args(),
		) );

		// DELETE /webdo24h/v1/sync — zmazanie entity z WP
		register_rest_route( self::NAMESPACE, '/sync', array(
			'methods'             => 'DELETE',
			'callback'            => array( $this, 'delete_entity' ),
			'permission_callback' => array( $this, 'check_auth' ),
		) );

		// POST /webdo24h/v1/webhook-test — ping z buildera
		register_rest_route( self::NAMESPACE, '/webhook-test', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'webhook_test' ),
			'permission_callback' => array( $this, 'check_auth' ),
		) );
	}

	/** Overenie autentifikácie */
	public function check_auth( WP_REST_Request $request ): bool|WP_Error {
		$result = Webdo24h_Auth::authenticate( $request );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return true;
	}

	/** GET /webdo24h/v1 — verejná info odpoveď */
	public function get_info( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( array(
			'namespace' => self::NAMESPACE,
			'version'   => WEBDO24H_VERSION,
			'name'      => 'webdo24h Connector',
			'routes'    => array(
				'/webdo24h/v1/schema',
				'/webdo24h/v1/sync',
				'/webdo24h/v1/webhook-test',
			),
			'acf'       => function_exists( 'update_field' ),
		), 200 );
	}

	/** GET /webdo24h/v1/schema — schema entít */
	public function get_schema( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( array(
			'version'  => WEBDO24H_VERSION,
			'entities' => Webdo24h_Entity_Mapper::get_schema(),
		), 200 );
	}

	/** POST /webdo24h/v1/sync — synchronizácia entity */
	public function sync_entity( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$entity    = $request->get_param( 'entity' );
		$payload   = $request->get_param( 'payload' );
		$wp_post_id = $request->get_param( 'wp_post_id' ); // null = vytvor, int = aktualizuj
		$record_id = $request->get_param( 'record_id' );   // Supabase ID pre audit

		$def = Webdo24h_Entity_Mapper::get_definition( $entity );
		if ( ! $def ) {
			return new WP_Error(
				'webdo24h_unknown_entity',
				sprintf( 'Neznáma entita: %s', $entity ),
				array( 'status' => 400 )
			);
		}

		// Špeciálny prípad: taxonomie (service_categories)
		if ( isset( $def['taxonomy'] ) && $def['taxonomy'] ) {
			return $this->sync_taxonomy( $def['taxonomy'], $payload, $wp_post_id );
		}

		// CPT / page sync
		$post_data = Webdo24h_Entity_Mapper::to_wp_post( $entity, $payload );
		$post_data['post_type'] = $def['cpt'];

		if ( $wp_post_id ) {
			// Aktualizácia existujúceho postu
			$post_data['ID'] = (int) $wp_post_id;
			$result = wp_update_post( $post_data, true );
		} else {
			// Vytvorenie nového
			if ( $def['kind'] === 'singleton' && $def['slug'] ) {
				// Pre singleton skontroluj či stránka existuje
				$existing = get_page_by_path( $def['slug'], OBJECT, $def['cpt'] );
				if ( $existing ) {
					$post_data['ID'] = $existing->ID;
					$result = wp_update_post( $post_data, true );
				} else {
					$post_data['post_name'] = $def['slug'];
					$result = wp_insert_post( $post_data, true );
				}
			} else {
				$result = wp_insert_post( $post_data, true );
			}
		}

		if ( is_wp_error( $result ) ) {
			return new WP_Error(
				'webdo24h_wp_error',
				$result->get_error_message(),
				array( 'status' => 500 )
			);
		}

		$post_id = (int) $result;

		// ACF polia
		Webdo24h_Entity_Mapper::write_acf_fields( $post_id, $entity, $payload );

		// Audit log
		$this->log_sync( $entity, $post_id, $record_id, 'success' );

		return new WP_REST_Response( array(
			'ok'         => true,
			'wp_post_id' => $post_id,
			'entity'     => $entity,
			'record_id'  => $record_id,
		), 200 );
	}

	/** Sync taxonomie (napr. service_categories) */
	private function sync_taxonomy( string $taxonomy, array $payload, ?int $wp_term_id ): WP_REST_Response|WP_Error {
		$term_data = array(
			'description' => wp_kses_post( $payload['description'] ?? '' ),
		);
		if ( isset( $payload['slug'] ) ) {
			$term_data['slug'] = sanitize_title( $payload['slug'] );
		}

		if ( $wp_term_id ) {
			$result = wp_update_term( $wp_term_id, $taxonomy, $term_data );
		} else {
			$name   = sanitize_text_field( $payload['title'] ?? $payload['name'] ?? 'Untitled' );
			$result = wp_insert_term( $name, $taxonomy, $term_data );
		}

		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'webdo24h_term_error', $result->get_error_message(), array( 'status' => 500 ) );
		}

		$term_id = is_array( $result ) ? $result['term_id'] : $result;
		return new WP_REST_Response( array( 'ok' => true, 'wp_term_id' => $term_id ), 200 );
	}

	/** DELETE /webdo24h/v1/sync — zmazanie postu */
	public function delete_entity( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$wp_post_id = (int) $request->get_param( 'wp_post_id' );
		if ( ! $wp_post_id ) {
			return new WP_Error( 'webdo24h_missing_id', 'wp_post_id je povinný.', array( 'status' => 400 ) );
		}

		$result = wp_trash_post( $wp_post_id );
		if ( ! $result ) {
			return new WP_Error( 'webdo24h_delete_error', 'Post sa nepodarilo zmazať.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response( array( 'ok' => true, 'trashed' => $wp_post_id ), 200 );
	}

	/** POST /webdo24h/v1/webhook-test — test konektivity */
	public function webhook_test( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( array(
			'ok'        => true,
			'site_url'  => get_site_url(),
			'timestamp' => current_time( 'c' ),
			'version'   => WEBDO24H_VERSION,
		), 200 );
	}

	/** Zapíše do WP options jednoduchý audit log (posledných 100 sync operácií) */
	private function log_sync( string $entity, int $wp_post_id, ?string $record_id, string $status ): void {
		$log   = get_option( 'webdo24h_sync_log', array() );
		$log[] = array(
			'entity'     => $entity,
			'wp_post_id' => $wp_post_id,
			'record_id'  => $record_id,
			'status'     => $status,
			'time'       => current_time( 'c' ),
		);
		// Ponechaj posledných 100
		if ( count( $log ) > 100 ) {
			$log = array_slice( $log, -100 );
		}
		update_option( 'webdo24h_sync_log', $log, false );
	}

	/** Argumenty pre /sync endpoint */
	private function get_sync_args(): array {
		return array(
			'entity'     => array(
				'required' => true,
				'type'     => 'string',
				'sanitize_callback' => 'sanitize_key',
			),
			'payload'    => array(
				'required' => true,
				'type'     => 'object',
			),
			'wp_post_id' => array(
				'required' => false,
				'type'     => 'integer',
			),
			'record_id'  => array(
				'required' => false,
				'type'     => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
		);
	}
}
