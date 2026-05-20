import Foundation
import SwiftUI

enum CheckState: Equatable {
    case idle
    case running
    case ok
    case protected
    case failed(String)

    var title: String {
        switch self {
        case .idle: "Ready"
        case .running: "Checking"
        case .ok: "OK"
        case .protected: "Protected OK"
        case .failed: "Error"
        }
    }

    var tint: Color {
        switch self {
        case .idle: .secondary
        case .running: .blue
        case .ok: .green
        case .protected: .blue
        case .failed: .red
        }
    }
}

struct HealthEndpoint: Identifiable, Equatable {
    let id = UUID()
    let name: String
    let path: String
    let protectedIsExpected: Bool
    var state: CheckState = .idle
    var detail: String = "Not checked yet"
    var statusCode: Int?

    mutating func applyHTTPStatus(_ code: Int) {
        statusCode = code
        if (200..<300).contains(code) {
            state = .ok
            detail = "Endpoint responds."
        } else if protectedIsExpected && (code == 401 || code == 403) {
            state = .protected
            detail = "WordPress is protecting this endpoint as expected. HTTP \(code)."
        } else {
            state = .failed("HTTP \(code)")
            detail = "Unexpected WordPress status."
        }
    }
}

struct WordPressUser: Equatable {
    let id: Int
    let name: String
    let slug: String
    let roles: [String]
    let capabilities: [String]
    let avatarURL: URL?
}

struct WordPressConnection: Codable, Equatable {
    let baseURL: String
    let username: String
    let applicationPassword: String
}

enum WordPressContentType: String, CaseIterable, Identifiable, Hashable {
    case posts
    case pages
    case media

    var id: String { rawValue }

    var title: String {
        switch self {
        case .posts: "Posts"
        case .pages: "Pages"
        case .media: "Media"
        }
    }

    var path: String {
        switch self {
        case .posts:
            "/wp/v2/posts?per_page=20&_fields=id,slug,title,excerpt,content,status,date,link"
        case .pages:
            "/wp/v2/pages?per_page=20&_fields=id,slug,title,excerpt,content,status,date,link"
        case .media:
            "/wp/v2/media?per_page=20&_fields=id,slug,title,caption,description,alt_text,media_type,mime_type,source_url,date,link"
        }
    }

    var countPath: String {
        switch self {
        case .posts:
            "/wp/v2/posts?per_page=1&_fields=id"
        case .pages:
            "/wp/v2/pages?per_page=1&_fields=id"
        case .media:
            "/wp/v2/media?per_page=1&_fields=id"
        }
    }

    var icon: String {
        switch self {
        case .posts: "doc.text.fill"
        case .pages: "rectangle.on.rectangle.fill"
        case .media: "photo.on.rectangle.angled"
        }
    }
}

struct SiteOverviewCounts: Equatable {
    private let values: [WordPressContentType: Int]

    init(values: [WordPressContentType: Int] = [:]) {
        self.values = values
    }

    func count(for type: WordPressContentType) -> Int {
        values[type] ?? 0
    }

    var total: Int {
        WordPressContentType.allCases.reduce(0) { partial, type in
            partial + count(for: type)
        }
    }
}

struct SiteSnapshotSection: Identifiable, Equatable {
    let type: WordPressContentType
    let totalCount: Int
    let items: [WordPressContentItem]

    var id: String { type.id }

    var countLabel: String {
        "\(totalCount) total"
    }

    var loadedLabel: String {
        "\(items.count) in snapshot"
    }

    func exportLines(maxItems: Int = 5) -> [String] {
        let visibleItems = Array(items.prefix(maxItems))
        guard !visibleItems.isEmpty else {
            return ["- No \(type.title.lowercased()) loaded in this snapshot."]
        }

        return visibleItems.map { item in
            "- \(item.title) | status: \(item.status) | slug: \(item.slugLabel)"
        }
    }
}

enum SiteConnectionMode: Equatable {
    case anonymous
    case authenticatedViaKeychain

    var label: String {
        switch self {
        case .anonymous: "Anonymous"
        case .authenticatedViaKeychain: "Authenticated via Keychain"
        }
    }

    var detail: String {
        switch self {
        case .anonymous:
            "Public REST endpoints are available. Protected checks stay locked by WordPress."
        case .authenticatedViaKeychain:
            "Protected REST checks use the saved local Keychain connection."
        }
    }

    var notice: String? {
        switch self {
        case .anonymous:
            "Anonymous mode is active. Public content remains visible; protected WordPress endpoints stay locked."
        case .authenticatedViaKeychain:
            nil
        }
    }

    var tint: Color {
        switch self {
        case .anonymous: .secondary
        case .authenticatedViaKeychain: .blue
        }
    }
}

struct WordPressContentItem: Identifiable, Hashable {
    let id: Int
    let type: WordPressContentType
    let title: String
    let slug: String
    let subtitle: String
    let detail: String
    let status: String
    let date: Date?
    let link: URL?
    let mediaURL: URL?
    let mediaType: String?
    let mimeType: String?

    var typeLabel: String {
        switch type {
        case .posts: "Post"
        case .pages: "Page"
        case .media: mediaType?.nonEmpty?.capitalized ?? "Media"
        }
    }

    var slugLabel: String {
        slug.nonEmpty ?? "No slug"
    }

    var isImageMedia: Bool {
        mimeType?.hasPrefix("image/") == true
    }
}

enum ContentSortOption: String, CaseIterable, Identifiable, Equatable {
    case newestFirst
    case oldestFirst
    case titleAZ

    var id: String { rawValue }

    var label: String {
        switch self {
        case .newestFirst: "Newest first"
        case .oldestFirst: "Oldest first"
        case .titleAZ: "Title A-Z"
        }
    }
}

struct ContentExplorerFilter: Equatable {
    static let allStatuses = "all"

    let searchQuery: String
    let status: String
    let sort: ContentSortOption

    init(
        searchQuery: String = "",
        status: String = ContentExplorerFilter.allStatuses,
        sort: ContentSortOption = .newestFirst
    ) {
        self.searchQuery = searchQuery
        self.status = status
        self.sort = sort
    }

    var normalizedSearchQuery: String {
        searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    var normalizedStatus: String? {
        let trimmed = status.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed == Self.allStatuses || trimmed.isEmpty ? nil : trimmed.lowercased()
    }

    var hasActiveSearchOrStatus: Bool {
        !normalizedSearchQuery.isEmpty || normalizedStatus != nil
    }

    var isDefault: Bool {
        !hasActiveSearchOrStatus && sort == .newestFirst
    }
}

struct ContentExplorerResult: Equatable {
    let items: [WordPressContentItem]
    let totalCount: Int

    var filteredCount: Int {
        items.count
    }

    var isFiltered: Bool {
        filteredCount != totalCount
    }
}

enum ContentExplorer {
    static func result(
        for items: [WordPressContentItem],
        filter: ContentExplorerFilter
    ) -> ContentExplorerResult {
        let query = filter.normalizedSearchQuery
        let status = filter.normalizedStatus

        let filtered = items.filter { item in
            let matchesStatus = status.map { item.status.lowercased() == $0 } ?? true
            let matchesQuery = query.isEmpty || item.matchesContentSearch(query)
            return matchesStatus && matchesQuery
        }

        let sorted = filtered.sorted { lhs, rhs in
            compare(lhs, rhs, using: filter.sort)
        }

        return ContentExplorerResult(items: sorted, totalCount: items.count)
    }

    static func statusOptions(for items: [WordPressContentItem]) -> [String] {
        let statuses = Set(items.compactMap { $0.status.nonEmpty })
        return statuses.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private static func compare(
        _ lhs: WordPressContentItem,
        _ rhs: WordPressContentItem,
        using sort: ContentSortOption
    ) -> Bool {
        switch sort {
        case .newestFirst:
            return compareDates(lhs, rhs, ascending: false)
        case .oldestFirst:
            return compareDates(lhs, rhs, ascending: true)
        case .titleAZ:
            return compareTitles(lhs, rhs)
        }
    }

    private static func compareDates(
        _ lhs: WordPressContentItem,
        _ rhs: WordPressContentItem,
        ascending: Bool
    ) -> Bool {
        switch (lhs.date, rhs.date) {
        case let (left?, right?) where left != right:
            return ascending ? left < right : left > right
        case (.some, nil):
            return true
        case (nil, .some):
            return false
        default:
            return compareTitles(lhs, rhs)
        }
    }

    private static func compareTitles(_ lhs: WordPressContentItem, _ rhs: WordPressContentItem) -> Bool {
        let comparison = lhs.title.localizedCaseInsensitiveCompare(rhs.title)
        if comparison != .orderedSame {
            return comparison == .orderedAscending
        }
        return lhs.id < rhs.id
    }
}

private extension WordPressContentItem {
    func matchesContentSearch(_ normalizedQuery: String) -> Bool {
        [
            title,
            slug,
            status,
            typeLabel,
            subtitle,
            detail,
            mediaType ?? "",
            mimeType ?? ""
        ].contains { value in
            value.lowercased().contains(normalizedQuery)
        }
    }
}

struct CapabilityGroup: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let rows: [CapabilityRow]
}

struct CapabilityRow: Identifiable {
    enum State: Equatable {
        case ready
        case needsAuth
        case authenticated
        case readOnlyAvailable
        case edge
        case locked
    }

    let id = UUID()
    let title: String
    let detail: String
    let state: State
}

struct GuardrailItem: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
}

extension CapabilityRow.State {
    var label: String {
        switch self {
        case .ready: "Ready"
        case .needsAuth: "Needs auth"
        case .authenticated: "Authenticated"
        case .readOnlyAvailable: "Read-only available"
        case .edge: "Edge"
        case .locked: "Locked for MVP"
        }
    }

    var tint: Color {
        switch self {
        case .ready: .green
        case .needsAuth: .secondary
        case .authenticated: .green
        case .readOnlyAvailable: .blue
        case .edge: .blue
        case .locked: .secondary
        }
    }
}

let defaultHealthEndpoints: [HealthEndpoint] = [
    HealthEndpoint(name: "REST root", path: "/", protectedIsExpected: false),
    HealthEndpoint(name: "Posts", path: "/wp/v2/posts?per_page=1&_fields=id,slug,title,status", protectedIsExpected: false),
    HealthEndpoint(name: "Pages", path: "/wp/v2/pages?per_page=1&_fields=id,slug,title,status", protectedIsExpected: false),
    HealthEndpoint(name: "Media", path: "/wp/v2/media?per_page=1&_fields=id,slug,title,source_url", protectedIsExpected: false),
    HealthEndpoint(name: "Users", path: "/wp/v2/users?per_page=1&_fields=id,name,slug", protectedIsExpected: false),
    HealthEndpoint(name: "Current user", path: "/wp/v2/users/me?context=edit", protectedIsExpected: true),
    HealthEndpoint(name: "Settings", path: "/wp/v2/settings", protectedIsExpected: true),
    HealthEndpoint(name: "Plugins", path: "/wp/v2/plugins", protectedIsExpected: true)
]

func capabilityGroups(isAuthenticated: Bool) -> [CapabilityGroup] {
    [
        CapabilityGroup(
            title: "Public read",
            subtitle: "Works without credentials.",
            rows: [
                CapabilityRow(title: "Posts, pages, media", detail: "Read-only REST endpoints.", state: .ready),
                CapabilityRow(title: "Users and types", detail: "Safe discovery data.", state: .ready)
            ]
        ),
        CapabilityGroup(
            title: isAuthenticated ? "Authenticated WordPress" : "After Application Password",
            subtitle: isAuthenticated ? "Using saved Keychain credentials." : "Requires a WordPress account.",
            rows: [
                CapabilityRow(
                    title: "/users/me",
                    detail: isAuthenticated ? "Keychain credentials are valid." : "Validates username and app password.",
                    state: isAuthenticated ? .authenticated : .needsAuth
                ),
                CapabilityRow(
                    title: "Settings and plugins",
                    detail: isAuthenticated ? "Admin REST reads are available; writes stay locked." : "Admin read only after auth.",
                    state: isAuthenticated ? .readOnlyAvailable : .needsAuth
                ),
                CapabilityRow(
                    title: "Media upload",
                    detail: isAuthenticated ? "Future server upload flow; no client upload in MVP." : "Requires auth later; upload remains locked in MVP.",
                    state: .locked
                )
            ]
        ),
        CapabilityGroup(
            title: "Server edge",
            subtitle: "Supabase remains the safe boundary.",
            rows: [
                CapabilityRow(title: "wordpress-connection", detail: "Validate and encrypt credentials.", state: .edge),
                CapabilityRow(title: "wordpress-proxy", detail: "Use saved credentials server-side.", state: .edge),
                CapabilityRow(title: "wordpress-sync", detail: "Future content publish pipeline.", state: .edge)
            ]
        ),
        CapabilityGroup(
            title: "Locked for MVP",
            subtitle: "Product capabilities intentionally not exposed.",
            rows: [
                CapabilityRow(title: "Delete post", detail: "Write action is not available in MVP.", state: .locked),
                CapabilityRow(title: "Update settings", detail: "Admin writes require a future approval flow.", state: .locked),
                CapabilityRow(title: "WP-CLI / SSH", detail: "Infrastructure access stays outside the native app.", state: .locked)
            ]
        )
    ]
}

let productionGuardrails: [GuardrailItem] = [
    GuardrailItem(
        title: "Theme upload locked",
        detail: "Requires explicit target and approval."
    ),
    GuardrailItem(
        title: "Plugin activation locked",
        detail: "Requires admin confirmation and audit."
    ),
    GuardrailItem(
        title: "SSH / WP-CLI unavailable",
        detail: "Infrastructure access stays outside this iOS MVP."
    ),
    GuardrailItem(
        title: "Database writes unavailable",
        detail: "Server save flow comes after backend approval."
    )
]
