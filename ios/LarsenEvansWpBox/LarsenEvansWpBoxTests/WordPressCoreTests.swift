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
        XCTAssertEqual(endpoint.detail, "Protected as expected. HTTP 401.")
    }

    func testUnexpectedHealthStatusMapsToFailed() {
        var endpoint = HealthEndpoint(name: "Posts", path: "/wp/v2/posts", protectedIsExpected: false)

        endpoint.applyHTTPStatus(500)

        XCTAssertEqual(endpoint.state, .failed("HTTP 500"))
        XCTAssertEqual(endpoint.statusCode, 500)
    }
}
