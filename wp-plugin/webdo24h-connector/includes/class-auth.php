<?php
/**
 * Autentifikácia požiadaviek z wpBOX buildera.
 *
 * Overuje Application Password ALEBO vlastný API kľúč uložený
 * v wp_options ('webdo24h_api_key'). Ak nie je žiadny kľúč nastavený,
 * akceptuje iba WP Application Passwords.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Webdo24h_Auth {

	/**
	 * Overí požiadavku. Vráti WP_User pri úspechu, WP_Error pri chybe.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_User|WP_Error
	 */
	public static function authenticate( WP_REST_Request $request ): WP_User|WP_Error {
		// 1. Skús vlastný API kľúč (Bearer token z wpBOX)
		$bearer = self::extract_bearer( $request );
		if ( $bearer ) {
			$result = self::verify_api_key( $bearer );
			if ( ! is_wp_error( $result ) ) {
				return $result;
			}
		}

		// 2. Fallback na WP Application Password (Basic Auth spracovaný WP jadrm)
		$current = wp_get_current_user();
		if ( $current && $current->ID > 0 ) {
			if ( ! $current->has_cap( 'edit_posts' ) ) {
				return new WP_Error(
					'webdo24h_forbidden',
					__( 'Nedostatočné oprávnenia.', 'webdo24h-connector' ),
					array( 'status' => 403 )
				);
			}
			return $current;
		}

		return new WP_Error(
			'webdo24h_unauthorized',
			__( 'Vyžaduje sa autentifikácia.', 'webdo24h-connector' ),
			array( 'status' => 401 )
		);
	}

	/**
	 * Extrakt Bearer tokenu z Authorization hlavičky.
	 */
	private static function extract_bearer( WP_REST_Request $request ): ?string {
		$auth = $request->get_header( 'authorization' );
		if ( $auth && str_starts_with( strtolower( $auth ), 'bearer ' ) ) {
			return trim( substr( $auth, 7 ) );
		}
		return null;
	}

	/**
	 * Overí vlastný API kľúč uložený v WP options.
	 * Kľúč sa nastavuje cez WP admin: Nastavenia → webdo24h Connector.
	 */
	private static function verify_api_key( string $token ): WP_User|WP_Error {
		$stored = get_option( 'webdo24h_api_key', '' );
		if ( ! $stored ) {
			return new WP_Error( 'webdo24h_no_key', 'API kľúč nie je nastavený.', array( 'status' => 401 ) );
		}

		// Bezpečné porovnanie – odolné voči timing attacks
		if ( ! hash_equals( $stored, $token ) ) {
			return new WP_Error( 'webdo24h_invalid_key', 'Neplatný API kľúč.', array( 'status' => 403 ) );
		}

		// Nájdi admin usera pre interné operácie
		$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
		if ( empty( $admins ) ) {
			return new WP_Error( 'webdo24h_no_admin', 'Nenájdený admin.', array( 'status' => 500 ) );
		}
		return $admins[0];
	}

	/**
	 * Vygeneruj a ulož nový API kľúč.
	 *
	 * @return string Nový kľúč.
	 */
	public static function generate_api_key(): string {
		$key = 'wbx_' . bin2hex( random_bytes( 32 ) );
		update_option( 'webdo24h_api_key', $key, false );
		return $key;
	}
}
