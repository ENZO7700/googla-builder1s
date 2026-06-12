<?php
/**
 * Plugin Name:       webdo24h Connector
 * Plugin URI:        https://larsenevans.sk
 * Description:       Prijíma dáta z wpBOX buildera cez REST API /webdo24h/v1. Synchronizuje Custom Post Types, ACF polia a SEO meta z Supabase do WordPressu.
 * Version:           1.1.0
 * Author:            LarsenEvans
 * Author URI:        https://larsenevans.sk
 * License:           GPL-2.0+
 * Text Domain:       webdo24h-connector
 * Requires at least: 6.0
 * Requires PHP:      8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WEBDO24H_VERSION', '1.1.0' );
define( 'WEBDO24H_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once WEBDO24H_PLUGIN_DIR . 'includes/class-rest-controller.php';
require_once WEBDO24H_PLUGIN_DIR . 'includes/class-entity-mapper.php';
require_once WEBDO24H_PLUGIN_DIR . 'includes/class-auth.php';

add_action( 'rest_api_init', function () {
	$controller = new Webdo24h_REST_Controller();
	$controller->register_routes();
} );

// Activation: flush rewrite rules so REST routes are immediately available
register_activation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, function () {
	flush_rewrite_rules();
} );
