import XCTest

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

    func testContentTypePathsIncludeExplorerFields() {
        XCTAssertTrue(WordPressContentType.posts.path.contains("slug"))
        XCTAssertTrue(WordPressContentType.posts.path.contains("excerpt"))
        XCTAssertTrue(WordPressContentType.posts.path.contains("content"))
        XCTAssertTrue(WordPressContentType.posts.path.contains("date"))
        XCTAssertTrue(WordPressContentType.posts.path.contains("link"))

        XCTAssertTrue(WordPressContentType.pages.path.contains("slug"))
        XCTAssertTrue(WordPressContentType.pages.path.contains("content"))

        XCTAssertTrue(WordPressContentType.media.path.contains("media_type"))
        XCTAssertTrue(WordPressContentType.media.path.contains("mime_type"))
        XCTAssertTrue(WordPressContentType.media.path.contains("source_url"))
        XCTAssertTrue(WordPressContentType.media.path.contains("alt_text"))
    }

    func testContentTypeCountPathsUseLightweightFields() {
        XCTAssertEqual(WordPressContentType.posts.countPath, "/wp/v2/posts?per_page=1&_fields=id")
        XCTAssertEqual(WordPressContentType.pages.countPath, "/wp/v2/pages?per_page=1&_fields=id")
        XCTAssertEqual(WordPressContentType.media.countPath, "/wp/v2/media?per_page=1&_fields=id")
    }

    func testSiteOverviewCountsMapContentTypes() {
        let counts = SiteOverviewCounts(values: [
            .posts: 3,
            .pages: 2,
            .media: 1
        ])

        XCTAssertEqual(counts.count(for: .posts), 3)
        XCTAssertEqual(counts.count(for: .pages), 2)
        XCTAssertEqual(counts.count(for: .media), 1)
        XCTAssertEqual(counts.total, 6)
    }

    func testSiteConnectionModeLabels() {
        XCTAssertEqual(SiteConnectionMode.anonymous.label, "Anonymous")
        XCTAssertEqual(SiteConnectionMode.authenticatedViaKeychain.label, "Authenticated via Keychain")
        XCTAssertTrue(SiteConnectionMode.anonymous.detail.contains("Public REST"))
        XCTAssertTrue(SiteConnectionMode.authenticatedViaKeychain.detail.contains("Keychain"))
        XCTAssertTrue(SiteConnectionMode.anonymous.notice?.contains("Anonymous mode") == true)
        XCTAssertNil(SiteConnectionMode.authenticatedViaKeychain.notice)
    }

    func testSiteProfileNormalizesURLUsernameAndStableID() {
        let profile = SiteProfile.make(
            name: " Local WordPress ",
            baseURL: " http://localhost:18090/ ",
            username: " admin ",
            now: Date(timeIntervalSince1970: 100)
        )

        XCTAssertEqual(profile.id, "site-http-localhost-18090-admin")
        XCTAssertEqual(profile.name, "Local WordPress")
        XCTAssertEqual(profile.baseURL, "http://localhost:18090")
        XCTAssertEqual(profile.username, "admin")
        XCTAssertEqual(profile.usernameLabel, "admin")
    }

    func testSiteProfileEncodingDoesNotContainApplicationPassword() throws {
        let profile = SiteProfile.make(
            name: "Local WordPress",
            baseURL: "http://localhost:18090",
            username: "admin"
        )

        let data = try JSONEncoder().encode(profile)
        let encoded = try XCTUnwrap(String(data: data, encoding: .utf8))

        XCTAssertFalse(encoded.contains("applicationPassword"))
        XCTAssertFalse(encoded.contains("secret-value"))
    }

    func testSiteProfileDraftValidatesRequiredFields() {
        let missingName = SiteProfileDraft(name: " ", baseURL: "http://localhost:18090", username: "admin")
        let missingURL = SiteProfileDraft(name: "Local", baseURL: " ", username: "admin")
        let valid = SiteProfileDraft(name: "Local", baseURL: "http://localhost:18090", username: "")

        XCTAssertFalse(missingName.canSave)
        XCTAssertFalse(missingURL.canSave)
        XCTAssertTrue(valid.canSave)
    }

    func testSiteProfileDraftCreatesProfileWithoutSecretFields() throws {
        let draft = SiteProfileDraft(
            name: " Local Anonymous ",
            baseURL: " http://localhost:18090/ ",
            username: " "
        )

        let profile = draft.makeProfile(now: Date(timeIntervalSince1970: 200))
        let encoded = try XCTUnwrap(String(data: try JSONEncoder().encode(profile), encoding: .utf8))

        XCTAssertEqual(profile.name, "Local Anonymous")
        XCTAssertEqual(profile.baseURL, "http://localhost:18090")
        XCTAssertEqual(profile.username, "")
        XCTAssertEqual(profile.usernameLabel, "Anonymous")
        XCTAssertFalse(encoded.contains("applicationPassword"))
    }

    func testAnonymousSecondLocalProfileIsDistinctAndHasNoAuthUser() {
        let authenticatedA = SiteProfile.make(
            name: "Local WordPress A",
            baseURL: "http://localhost:18090",
            username: "admin",
            now: Date(timeIntervalSince1970: 100)
        )
        let anonymousB = SiteProfileDraft(
            name: " Local WordPress B ",
            baseURL: " http://localhost:18091/ ",
            username: " "
        ).makeProfile(now: Date(timeIntervalSince1970: 200))

        XCTAssertEqual(anonymousB.name, "Local WordPress B")
        XCTAssertEqual(anonymousB.baseURL, "http://localhost:18091")
        XCTAssertEqual(anonymousB.username, "")
        XCTAssertEqual(anonymousB.usernameLabel, "Anonymous")
        XCTAssertNotEqual(anonymousB.id, authenticatedA.id)
        XCTAssertEqual(anonymousB.id, "site-http-localhost-18091")
    }

    func testSiteProfileStoreSavesLoadsAndSwitchesActiveProfile() throws {
        let suiteName = "WordPressCoreTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = SiteProfileStore(defaults: defaults)

        let first = SiteProfile.make(name: "Local", baseURL: "http://localhost:18090", username: "admin")
        let second = SiteProfile.make(name: "Staging", baseURL: "https://staging.example.test", username: "editor")

        _ = store.upsert(first, into: [])
        let saved = store.upsert(second, into: store.loadProfiles())

        XCTAssertEqual(saved.first?.id, second.id)
        XCTAssertEqual(store.loadActiveProfileID(), second.id)
        XCTAssertEqual(store.loadProfiles().map(\.id), [second.id, first.id])

        store.saveActiveProfileID(first.id)

        XCTAssertEqual(store.loadActiveProfileID(), first.id)
    }

    func testSiteProfileStorePersistsActiveSecondLocalSiteSelection() throws {
        let suiteName = "WordPressCoreTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = SiteProfileStore(defaults: defaults)

        let first = SiteProfile.make(name: "Local WordPress A", baseURL: "http://localhost:18090", username: "admin")
        let second = SiteProfile.make(name: "Local WordPress B", baseURL: "http://localhost:18091", username: "")
        var profiles = store.upsert(first, into: [])
        profiles = store.upsert(second, into: profiles)

        store.saveActiveProfileID(second.id)

        XCTAssertEqual(store.loadActiveProfileID(), second.id)
        XCTAssertEqual(store.loadProfiles().map(\.id), [second.id, first.id])
        XCTAssertEqual(profiles.first?.id, second.id)
    }

    func testSiteProfileStoreDeletesProfileAndMovesActiveSelection() throws {
        let suiteName = "WordPressCoreTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = SiteProfileStore(defaults: defaults)

        let first = SiteProfile.make(name: "Local", baseURL: "http://localhost:18090", username: "admin")
        let second = SiteProfile.make(name: "Staging", baseURL: "https://staging.example.test", username: "editor")
        var profiles = store.upsert(first, into: [])
        profiles = store.upsert(second, into: profiles)

        let remaining = store.deleteProfile(id: second.id, from: profiles)

        XCTAssertEqual(remaining.map(\.id), [first.id])
        XCTAssertEqual(store.loadActiveProfileID(), first.id)
        XCTAssertEqual(store.loadProfiles().map(\.id), [first.id])
    }

    func testSiteSnapshotSectionSummarizesLoadedItemsForExport() {
        let item = makeContentItem(title: "Hello world", slug: "hello-world", status: "publish", type: .posts)
        let section = SiteSnapshotSection(type: .posts, totalCount: 3, items: [item])

        XCTAssertEqual(section.countLabel, "3 total")
        XCTAssertEqual(section.loadedLabel, "1 in snapshot")
        XCTAssertEqual(section.exportLines(), [
            "- Hello world | status: publish | slug: hello-world"
        ])
    }

    func testSiteSnapshotSectionExportsClearEmptyState() {
        let section = SiteSnapshotSection(type: .media, totalCount: 0, items: [])

        XCTAssertEqual(section.exportLines(), [
            "- No media loaded in this snapshot."
        ])
    }

    func testPostContentMappingKeepsExplorerMetadata() throws {
        let json = """
        {
          "id": 42,
          "slug": "hello-world",
          "title": { "rendered": "Hello <strong>world</strong>!" },
          "excerpt": { "rendered": "<p>Excerpt body</p>" },
          "content": { "rendered": "<p>Full body</p>" },
          "status": "publish",
          "date": "2026-05-19T12:34:56",
          "link": "http://localhost:18090/hello-world/"
        }
        """
        let response = try JSONDecoder().decode(WPContentResponse.self, from: Data(json.utf8))
        let item = response.item(type: .posts)

        XCTAssertEqual(item.id, 42)
        XCTAssertEqual(item.title, "Hello world!")
        XCTAssertEqual(item.slug, "hello-world")
        XCTAssertEqual(item.status, "publish")
        XCTAssertEqual(item.detail, "Excerpt body")
        XCTAssertEqual(item.link?.absoluteString, "http://localhost:18090/hello-world/")
        XCTAssertNotNil(item.date)
    }

    func testMediaContentMappingKeepsSourceAndMimeMetadata() throws {
        let json = """
        {
          "id": 7,
          "slug": "logo",
          "title": { "rendered": "Logo" },
          "caption": { "rendered": "<p>Brand asset</p>" },
          "description": { "rendered": "<p>Full description</p>" },
          "alt_text": "Alternative logo text",
          "media_type": "image",
          "mime_type": "image/png",
          "source_url": "http://localhost:18090/wp-content/uploads/logo.png",
          "date": "2026-05-19T13:00:00",
          "link": "http://localhost:18090/logo/"
        }
        """
        let response = try JSONDecoder().decode(WPContentResponse.self, from: Data(json.utf8))
        let item = response.item(type: .media)

        XCTAssertEqual(item.typeLabel, "Image")
        XCTAssertEqual(item.slugLabel, "logo")
        XCTAssertEqual(item.detail, "Brand asset")
        XCTAssertEqual(item.mediaType, "image")
        XCTAssertEqual(item.mimeType, "image/png")
        XCTAssertTrue(item.isImageMedia)
        XCTAssertEqual(item.mediaURL?.absoluteString, "http://localhost:18090/wp-content/uploads/logo.png")
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

    func testContentExplorerSearchMatchesTitleSlugAndStatus() {
        let items = [
            makeContentItem(title: "Welcome Post", slug: "welcome-post", status: "publish", type: .posts),
            makeContentItem(title: "Draft Idea", slug: "internal-note", status: "draft", type: .posts),
            makeContentItem(title: "Brand Logo", slug: "brand-logo", status: "inherit", type: .media)
        ]

        let titleResult = ContentExplorer.result(for: items, filter: ContentExplorerFilter(searchQuery: "welcome"))
        let slugResult = ContentExplorer.result(for: items, filter: ContentExplorerFilter(searchQuery: "brand-logo"))
        let statusResult = ContentExplorer.result(for: items, filter: ContentExplorerFilter(searchQuery: "draft"))

        XCTAssertEqual(titleResult.items.map(\.slug), ["welcome-post"])
        XCTAssertEqual(slugResult.items.map(\.slug), ["brand-logo"])
        XCTAssertEqual(statusResult.items.map(\.slug), ["internal-note"])
    }

    func testContentExplorerFiltersByStatusAndReportsCounts() {
        let items = [
            makeContentItem(title: "Live Post", slug: "live-post", status: "publish", type: .posts),
            makeContentItem(title: "Draft Post", slug: "draft-post", status: "draft", type: .posts),
            makeContentItem(title: "Live Page", slug: "live-page", status: "publish", type: .pages)
        ]

        let result = ContentExplorer.result(
            for: items,
            filter: ContentExplorerFilter(status: "publish")
        )

        XCTAssertEqual(result.totalCount, 3)
        XCTAssertEqual(result.filteredCount, 2)
        XCTAssertTrue(result.isFiltered)
        XCTAssertEqual(result.items.map(\.slug), ["live-page", "live-post"])
    }

    func testContentExplorerSortsNewestOldestAndTitle() throws {
        let older = makeContentItem(
            id: 1,
            title: "Beta",
            slug: "older",
            status: "publish",
            type: .posts,
            date: try XCTUnwrap(WPContentResponse.parseDate("2026-05-18T09:00:00"))
        )
        let newer = makeContentItem(
            id: 2,
            title: "Gamma",
            slug: "newer",
            status: "publish",
            type: .posts,
            date: try XCTUnwrap(WPContentResponse.parseDate("2026-05-19T09:00:00"))
        )
        let alpha = makeContentItem(
            id: 3,
            title: "Alpha",
            slug: "undated",
            status: "publish",
            type: .posts
        )
        let items = [older, newer, alpha]

        let newest = ContentExplorer.result(for: items, filter: ContentExplorerFilter(sort: .newestFirst))
        let oldest = ContentExplorer.result(for: items, filter: ContentExplorerFilter(sort: .oldestFirst))
        let titleAZ = ContentExplorer.result(for: items, filter: ContentExplorerFilter(sort: .titleAZ))

        XCTAssertEqual(newest.items.map(\.slug), ["newer", "older", "undated"])
        XCTAssertEqual(oldest.items.map(\.slug), ["older", "newer", "undated"])
        XCTAssertEqual(titleAZ.items.map(\.slug), ["undated", "older", "newer"])
    }

    func testContentExplorerReturnsEmptyFilteredStateWithoutLosingTotal() {
        let items = [
            makeContentItem(title: "Live Post", slug: "live-post", status: "publish", type: .posts),
            makeContentItem(title: "Draft Page", slug: "draft-page", status: "draft", type: .pages)
        ]

        let result = ContentExplorer.result(
            for: items,
            filter: ContentExplorerFilter(searchQuery: "missing")
        )

        XCTAssertEqual(result.totalCount, 2)
        XCTAssertEqual(result.filteredCount, 0)
        XCTAssertTrue(result.isFiltered)
        XCTAssertTrue(result.items.isEmpty)
    }

    func testContentExplorerStatusOptionsAreStableAndUnique() {
        let items = [
            makeContentItem(title: "Live Post", slug: "live-post", status: "publish", type: .posts),
            makeContentItem(title: "Draft Page", slug: "draft-page", status: "draft", type: .pages),
            makeContentItem(title: "Live Page", slug: "live-page", status: "publish", type: .pages)
        ]

        XCTAssertEqual(ContentExplorer.statusOptions(for: items), ["draft", "publish"])
    }

    private func makeContentItem(
        id: Int = 1,
        title: String,
        slug: String,
        status: String,
        type: WordPressContentType,
        date: Date? = nil
    ) -> WordPressContentItem {
        WordPressContentItem(
            id: id,
            type: type,
            title: title,
            slug: slug,
            subtitle: status,
            detail: "Preview",
            status: status,
            date: date,
            link: nil,
            mediaURL: nil,
            mediaType: nil,
            mimeType: nil
        )
    }
}
