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

struct SiteProfile: Identifiable, Codable, Equatable, Hashable {
    let id: String
    var name: String
    var baseURL: String
    var username: String
    var lastRefresh: Date?
    let createdAt: Date
    var updatedAt: Date

    static func make(
        name: String,
        baseURL: String,
        username: String,
        lastRefresh: Date? = nil,
        now: Date = Date()
    ) -> SiteProfile {
        let normalizedBaseURL = normalizeBaseURL(baseURL)
        let cleanUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            ?? URL(string: normalizedBaseURL)?.host
            ?? "WordPress site"

        return SiteProfile(
            id: stableID(baseURL: normalizedBaseURL, username: cleanUsername),
            name: cleanName,
            baseURL: normalizedBaseURL,
            username: cleanUsername,
            lastRefresh: lastRefresh,
            createdAt: now,
            updatedAt: now
        )
    }

    static func normalizeBaseURL(_ baseURL: String) -> String {
        baseURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingTrailingSlash
    }

    static func stableID(baseURL: String, username: String) -> String {
        let rawValue = "\(normalizeBaseURL(baseURL))-\(username.trimmingCharacters(in: .whitespacesAndNewlines))"
        let sanitized = rawValue
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return sanitized.isEmpty ? UUID().uuidString : "site-\(sanitized)"
    }

    var usernameLabel: String {
        username.nonEmpty ?? "Anonymous"
    }
}

struct SiteProfileDraft: Equatable {
    var name: String
    var baseURL: String
    var username: String

    init(name: String = "", baseURL: String = "", username: String = "") {
        self.name = name
        self.baseURL = baseURL
        self.username = username
    }

    var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var normalizedBaseURL: String {
        SiteProfile.normalizeBaseURL(baseURL)
    }

    var trimmedUsername: String {
        username.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var canSave: Bool {
        !trimmedName.isEmpty && !normalizedBaseURL.isEmpty
    }

    func makeProfile(now: Date = Date()) -> SiteProfile {
        SiteProfile.make(
            name: trimmedName,
            baseURL: normalizedBaseURL,
            username: trimmedUsername,
            now: now
        )
    }
}

struct SiteProfileStore {
    private let defaults: UserDefaults
    private let profilesKey: String
    private let activeProfileIDKey: String

    init(
        defaults: UserDefaults = .standard,
        profilesKey: String = "wpbox.savedSiteProfiles",
        activeProfileIDKey: String = "wpbox.activeSiteProfileID"
    ) {
        self.defaults = defaults
        self.profilesKey = profilesKey
        self.activeProfileIDKey = activeProfileIDKey
    }

    func loadProfiles() -> [SiteProfile] {
        guard let data = defaults.data(forKey: profilesKey),
              let profiles = try? JSONDecoder().decode([SiteProfile].self, from: data) else {
            return []
        }
        return profiles.sorted { lhs, rhs in
            lhs.updatedAt > rhs.updatedAt
        }
    }

    func saveProfiles(_ profiles: [SiteProfile]) {
        guard let data = try? JSONEncoder().encode(profiles) else { return }
        defaults.set(data, forKey: profilesKey)
    }

    func upsert(_ profile: SiteProfile, into profiles: [SiteProfile]) -> [SiteProfile] {
        var next = profiles.filter { $0.id != profile.id }
        next.insert(profile, at: 0)
        saveProfiles(next)
        saveActiveProfileID(profile.id)
        return next
    }

    func deleteProfile(id: SiteProfile.ID, from profiles: [SiteProfile]) -> [SiteProfile] {
        let next = profiles.filter { $0.id != id }
        saveProfiles(next)
        if loadActiveProfileID() == id {
            saveActiveProfileID(next.first?.id)
        }
        return next
    }

    func loadActiveProfileID() -> SiteProfile.ID? {
        defaults.string(forKey: activeProfileIDKey)?.nonEmpty
    }

    func saveActiveProfileID(_ id: SiteProfile.ID?) {
        if let id {
            defaults.set(id, forKey: activeProfileIDKey)
        } else {
            defaults.removeObject(forKey: activeProfileIDKey)
        }
    }
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

struct CleanupPluginStatus: Equatable {
    static let namespace = "/ultra-clean/v1"

    var routes: [CleanupRoute] = []

    var isDetected: Bool {
        !routes.isEmpty
    }

    var readOnlyRoutes: [CleanupRoute] {
        routes.filter { !$0.isDestructive }
    }

    var lockedRoutes: [CleanupRoute] {
        routes.filter(\.isDestructive)
    }

    var statusLabel: String {
        isDetected ? "Plugin detected" : "Plugin not detected"
    }
}

struct CleanupRoute: Identifiable, Equatable {
    let path: String
    let methods: [String]

    var id: String { path }

    var methodLabel: String {
        methods.isEmpty ? "GET" : methods.joined(separator: ", ")
    }

    var isDestructive: Bool {
        let writeMethods = Set(["POST", "PUT", "PATCH", "DELETE"])
        return methods.contains { writeMethods.contains($0.uppercased()) }
            || path.lowercased().contains("deep-clean")
            || path.lowercased().contains("rollback")
            || path.lowercased().contains("delete")
            || path.lowercased().contains("cleanup")
    }

    var lockLabel: String {
        isDestructive ? "Locked" : "Read-only"
    }
}

struct CleanupHistoryItem: Identifiable, Equatable, Decodable {
    let id: String
    let action: String
    let status: String
    let message: String
    let removedCount: Int?
    let date: Date?

    var summary: String {
        if let removedCount {
            return "\(message) · \(removedCount) items"
        }
        return message
    }

    init(
        id: String,
        action: String,
        status: String,
        message: String,
        removedCount: Int? = nil,
        date: Date? = nil
    ) {
        self.id = id
        self.action = action
        self.status = status
        self.message = message
        self.removedCount = removedCount
        self.date = date
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: FlexibleCodingKey.self)
        let fallbackID = UUID().uuidString
        id = container.flexibleString(for: ["id", "history_id", "uuid"]) ?? fallbackID
        action = container.flexibleString(for: ["action", "type", "operation", "cleanup_type"]) ?? "Cleanup"
        status = container.flexibleString(for: ["status", "result", "state"]) ?? "recorded"
        message = container.flexibleString(for: ["message", "summary", "description", "details"]) ?? action
        removedCount = container.flexibleInt(for: ["removed", "deleted", "items_removed", "count", "total"])
        date = container.flexibleDate(for: ["date", "created_at", "timestamp", "time"])
    }
}

struct CleanupBackupItem: Identifiable, Equatable, Decodable {
    let id: String
    let name: String
    let status: String
    let sizeLabel: String?
    let date: Date?

    init(
        id: String,
        name: String,
        status: String,
        sizeLabel: String? = nil,
        date: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.status = status
        self.sizeLabel = sizeLabel
        self.date = date
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: FlexibleCodingKey.self)
        let fallbackID = UUID().uuidString
        id = container.flexibleString(for: ["id", "backup_id", "uuid", "file"]) ?? fallbackID
        name = container.flexibleString(for: ["name", "filename", "file", "path"]) ?? "Backup"
        status = container.flexibleString(for: ["status", "state", "result"]) ?? "available"
        sizeLabel = container.flexibleString(for: ["size", "size_label", "filesize"])
            ?? container.flexibleInt(for: ["bytes", "size_bytes"]).map { "\($0) bytes" }
        date = container.flexibleDate(for: ["date", "created_at", "timestamp", "time"])
    }
}

struct CleanupDiagnosticsPayload: Equatable {
    var status = CleanupPluginStatus()
    var history: [CleanupHistoryItem] = []
    var backups: [CleanupBackupItem] = []

    var historyCount: Int { history.count }
    var backupsCount: Int { backups.count }
    var latestHistory: CleanupHistoryItem? { history.first }
    var latestBackup: CleanupBackupItem? { backups.first }
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

struct FlexibleCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = "\(intValue)"
        self.intValue = intValue
    }
}

extension KeyedDecodingContainer where Key == FlexibleCodingKey {
    func flexibleString(for keys: [String]) -> String? {
        for keyName in keys {
            guard let key = FlexibleCodingKey(stringValue: keyName) else { continue }
            if let decoded = try? decodeIfPresent(String.self, forKey: key),
               let value = decoded.nonEmpty {
                return value
            }
            if let decoded = try? decodeIfPresent(Int.self, forKey: key) {
                return "\(decoded)"
            }
            if let decoded = try? decodeIfPresent(Double.self, forKey: key) {
                return "\(decoded)"
            }
        }
        return nil
    }

    func flexibleInt(for keys: [String]) -> Int? {
        for keyName in keys {
            guard let key = FlexibleCodingKey(stringValue: keyName) else { continue }
            if let decoded = try? decodeIfPresent(Int.self, forKey: key) {
                return decoded
            }
            if let decoded = try? decodeIfPresent(String.self, forKey: key),
               let intValue = Int(decoded.trimmingCharacters(in: .whitespacesAndNewlines)) {
                return intValue
            }
        }
        return nil
    }

    func flexibleDate(for keys: [String]) -> Date? {
        for keyName in keys {
            guard let key = FlexibleCodingKey(stringValue: keyName) else { continue }
            if let decoded = try? decodeIfPresent(String.self, forKey: key),
               let date = CleanupDateParser.parse(decoded) {
                return date
            }
            if let decoded = try? decodeIfPresent(Double.self, forKey: key) {
                return Date(timeIntervalSince1970: decoded)
            }
            if let decoded = try? decodeIfPresent(Int.self, forKey: key) {
                return Date(timeIntervalSince1970: TimeInterval(decoded))
            }
        }
        return nil
    }
}

enum CleanupDateParser {
    static func parse(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if let timestamp = TimeInterval(trimmed) {
            return Date(timeIntervalSince1970: timestamp)
        }

        for formatter in formatters {
            if let date = formatter.date(from: trimmed) {
                return date
            }
        }
        return nil
    }

    private static let formatters: [DateFormatter] = [
        makeFormatter("yyyy-MM-dd'T'HH:mm:ssXXXXX"),
        makeFormatter("yyyy-MM-dd'T'HH:mm:ss"),
        makeFormatter("yyyy-MM-dd HH:mm:ss"),
        makeFormatter("yyyy-MM-dd")
    ]

    private static func makeFormatter(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = format
        return formatter
    }
}
