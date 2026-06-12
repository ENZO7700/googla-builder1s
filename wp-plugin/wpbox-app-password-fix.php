<?php
/**
 * Plugin Name: WPBox Application Passwords Fix
 * Description: Ensures WordPress application-passwords REST routes remain available for integrations.
 * Version: 1.0.0
 * Author: WPBox
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter(
	'wp_is_application_passwords_available',
	static function ( $available, $for_user = null ) {
		return true;
	},
	10,
	2
);
