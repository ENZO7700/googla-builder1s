import XCTest
@testable import LarsenEvansWpBox

final class WordPressCoreTests: XCTestCase {
    func testMakeURLTrimsTrailingSlash() {
        let client = WordPressAPIClient()

        let url = client.makeURL(baseURL: " http://localhost:18090/ ", path: "/wp/v2/posts")

        XCTAssertEqual(url?.absoluteString, "http://localhost:18090/wp-json/wp/v2/posts")
    }

    func testCredentialURLAllowsHTTPS() throws {
        let client = WordPressAPIClient()
        let url = try XCTUnwrap(client.makeURL(baseURL: "https://example.test", path: "/wp/v2/users/me"))

        XCTAssertTrue(client.isSafeCredentialURL(url))
    }

    func testCredentialURLBlocksRemoteHTTP() throws {
        let client = WordPressAPIClient()
        let url = try XCTUnwrap(client.makeURL(baseURL: "http://example.test", path: "/wp/v2/users/me"))

        XCTAssertFalse(client.isSafeCredentialURL(url))
    }

    func testCredentialURLAllowsLocalDevelopmentHTTP() throws {
        let client = WordPressAPIClient()
        let localhost = try XCTUnwrap(client.makeURL(baseURL: "http://localhost:18090", path: "/wp/v2/users/me"))
        let loopback = try XCTUnwrap(client.makeURL(baseURL: "http://127.0.0.1:8080", path: "/wp/v2/users/me"))

        XCTAssertTrue(client.isSafeCredentialURL(localhost))
        XCTAssertTrue(client.isSafeCredentialURL(loopback))
    }

    func testProtectedHealthStatusMapsToProtectedOK() {
        var endpoint = HealthEndpoint(name: "Settings", path: "/wp/v2/settings", protectedIsExpected: true)

        endpoint.applyHTTPStatus(401)

        XCTAssertEqual(endpoint.state, .protected)
        XCTAssertEqual(endpoint.statusCode, 401)
        XCTAssertEqual(endpoint.detail, "WordPress is protecting this endpoint as expected. HTTP 401.")
    }

    func testAuthenticatedProtectedHealthStatusMapsToOK() {
        var endpoint = HealthEndpoint(name: "Settings", path: "/wp/v2/settings", protectedIsExpected: true)

        endpoint.applyHTTPStatus(200)

        XCTAssertEqual(endpoint.state, .ok)
        XCTAssertEqual(endpoint.statusCode, 200)
        XCTAssertEqual(endpoint.detail, "Endpoint responds.")
    }

    func testUnexpectedHealthStatusMapsToFailed() {
        var endpoint = HealthEndpoint(name: "Posts", path: "/wp/v2/posts", protectedIsExpected: false)

        endpoint.applyHTTPStatus(500)

        XCTAssertEqual(endpoint.state, .failed("HTTP 500"))
        XCTAssertEqual(endpoint.statusCode, 500)
    }

    func testDefaultHealthEndpointsAreWpCoreOnly() {
        let paths = defaultHealthEndpoints.map(\.path)

        XCTAssertEqual(defaultHealthEndpoints.count, 8)
        XCTAssertTrue(paths.contains("/"))
        XCTAssertTrue(paths.contains { $0.hasPrefix("/wp/v2/posts") })
        XCTAssertTrue(paths.contains { $0.hasPrefix("/wp/v2/pages") })
        XCTAssertTrue(paths.contains { $0.hasPrefix("/wp/v2/media") })
        XCTAssertTrue(paths.contains { $0.hasPrefix("/wp/v2/users?") })
        XCTAssertTrue(paths.contains("/wp/v2/users/me?context=edit"))
        XCTAssertTrue(paths.contains("/wp/v2/settings"))
        XCTAssertTrue(paths.contains("/wp/v2/plugins"))
        XCTAssertFalse(paths.contains { $0.contains("webdo24h") })
    }

    func testWhitespaceCredentialsAreRejectedBeforeNetwork() async {
        let client = WordPressAPIClient()

        do {
            _ = try await client.validateConnection(
                baseURL: "http://localhost:18090",
                username: "   ",
                applicationPassword: " \n\t "
            )
            XCTFail("Whitespace-only credentials should not be accepted.")
        } catch WordPressAPIClient.ClientError.missingCredentials {
            XCTAssertTrue(true)
        } catch {
            XCTFail("Expected missingCredentials, got \(error).")
        }
    }

    func testAnonymousCapabilitiesKeepProtectedRowsAuthGated() {
        let groups = capabilityGroups(isAuthenticated: false)
        let authRows = groups.first { $0.title == "After Application Password" }?.rows ?? []

        XCTAssertEqual(authRows.first { $0.title == "/users/me" }?.state, .needsAuth)
        XCTAssertEqual(authRows.first { $0.title == "Settings and plugins" }?.state, .needsAuth)
        XCTAssertEqual(authRows.first { $0.title == "Media upload" }?.state, .locked)
    }

    func testAuthenticatedCapabilitiesShowReadOnlyAvailability() {
        let groups = capabilityGroups(isAuthenticated: true)
        let authRows = groups.first { $0.title == "Authenticated WordPress" }?.rows ?? []

        XCTAssertEqual(authRows.first { $0.title == "/users/me" }?.state, .authenticated)
        XCTAssertEqual(authRows.first { $0.title == "Settings and plugins" }?.state, .readOnlyAvailable)
        XCTAssertEqual(authRows.first { $0.title == "Media upload" }?.state, .locked)
    }

    func testProductionGuardrailsReadAsLockedSecurityDecisions() {
        let titles = productionGuardrails.map(\.title)
        let details = productionGuardrails.map(\.detail).joined(separator: " ")

        XCTAssertEqual(titles, [
            "Theme upload locked",
            "Plugin activation locked",
            "SSH / WP-CLI unavailable",
            "Database writes unavailable"
        ])
        XCTAssertFalse(titles.contains { $0.hasPrefix("No ") })
        XCTAssertFalse(details.localizedCaseInsensitiveContains("error"))
        XCTAssertFalse(details.localizedCaseInsensitiveContains("warning"))
    }
}
