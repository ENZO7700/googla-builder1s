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
        case .protected: .orange
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

enum WordPressContentType: String, CaseIterable, Identifiable {
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
            "/wp/v2/posts?per_page=20&_fields=id,slug,title,excerpt,status,date,link"
        case .pages:
            "/wp/v2/pages?per_page=20&_fields=id,slug,title,excerpt,status,date,link"
        case .media:
            "/wp/v2/media?per_page=20&_fields=id,slug,title,caption,media_type,mime_type,source_url,date,link"
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

struct WordPressContentItem: Identifiable, Hashable {
    let id: Int
    let type: WordPressContentType
    let title: String
    let subtitle: String
    let detail: String
    let status: String
    let date: Date?
    let link: URL?
    let mediaURL: URL?
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
        case .needsAuth: .orange
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
