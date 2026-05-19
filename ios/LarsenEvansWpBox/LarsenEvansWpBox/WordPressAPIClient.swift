import Foundation

struct WordPressAPIClient {
    enum ClientError: LocalizedError {
        case invalidURL
        case missingCredentials
        case insecureCredentialURL
        case network(String)
        case rejected(Int, String)

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                "Enter a valid WordPress URL."
            case .missingCredentials:
                "Username and Application Password are required."
            case .insecureCredentialURL:
                "Application Password môžeme poslať iba cez HTTPS. Pre lokálny vývoj je povolený localhost."
            case .network(let message):
                message
            case .rejected(let code, let message):
                "HTTP \(code): \(message)"
            }
        }
    }

    func runHealthChecks(baseURL: String, credentials: WordPressConnection? = nil) async -> [HealthEndpoint] {
        await withTaskGroup(of: HealthEndpoint.self) { group in
            for endpoint in defaultHealthEndpoints {
                group.addTask {
                    await check(endpoint: endpoint, baseURL: baseURL, credentials: credentials)
                }
            }

            var checks: [HealthEndpoint] = []
            for await check in group {
                checks.append(check)
            }
            return checks.sorted { lhs, rhs in
                defaultHealthEndpoints.firstIndex { $0.name == lhs.name } ?? 0 <
                    defaultHealthEndpoints.firstIndex { $0.name == rhs.name } ?? 0
            }
        }
    }

    func validateConnection(baseURL: String, username: String, applicationPassword: String) async throws -> WordPressUser {
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !applicationPassword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ClientError.missingCredentials
        }

        guard let url = makeURL(baseURL: baseURL, path: "/wp/v2/users/me?context=edit") else {
            throw ClientError.invalidURL
        }
        guard isSafeCredentialURL(url) else {
            throw ClientError.insecureCredentialURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Basic \(basicAuth(username: username, password: applicationPassword))", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw ClientError.network("WordPress returned an invalid response.")
            }

            if !(200..<300).contains(http.statusCode) {
                let error = try? JSONDecoder().decode(WPErrorResponse.self, from: data)
                let message = error?.message?.strippingHTML ?? "WordPress rejected the credentials."
                throw ClientError.rejected(http.statusCode, message)
            }

            let decoded = try JSONDecoder().decode(WPMeResponse.self, from: data)
            return decoded.user
        } catch let error as ClientError {
            throw error
        } catch {
            throw ClientError.network(error.localizedDescription)
        }
    }

    func fetchContent(baseURL: String, type: WordPressContentType) async throws -> [WordPressContentItem] {
        guard let url = makeURL(baseURL: baseURL, path: type.path) else {
            throw ClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw ClientError.network("WordPress returned an invalid response.")
            }
            if !(200..<300).contains(http.statusCode) {
                let error = try? JSONDecoder().decode(WPErrorResponse.self, from: data)
                let message = error?.message?.strippingHTML ?? "Content endpoint is not available."
                throw ClientError.rejected(http.statusCode, message)
            }
            guard !data.isEmpty else {
                return []
            }

            let decoded = try JSONDecoder().decode([WPContentResponse].self, from: data)
            return decoded.map { $0.item(type: type) }
        } catch let error as ClientError {
            throw error
        } catch {
            throw ClientError.network(error.localizedDescription)
        }
    }

    func fetchContentCount(baseURL: String, type: WordPressContentType) async throws -> Int {
        guard let url = makeURL(baseURL: baseURL, path: type.countPath) else {
            throw ClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw ClientError.network("WordPress returned an invalid response.")
            }
            if !(200..<300).contains(http.statusCode) {
                let error = try? JSONDecoder().decode(WPErrorResponse.self, from: data)
                let message = error?.message?.strippingHTML ?? "Content count endpoint is not available."
                throw ClientError.rejected(http.statusCode, message)
            }
            if let total = http.value(forHTTPHeaderField: "X-WP-Total"),
               let count = Int(total) {
                return count
            }
            guard !data.isEmpty else {
                return 0
            }

            let decoded = try JSONDecoder().decode([WPContentResponse].self, from: data)
            return decoded.count
        } catch let error as ClientError {
            throw error
        } catch {
            throw ClientError.network(error.localizedDescription)
        }
    }

    private func check(endpoint: HealthEndpoint, baseURL: String, credentials: WordPressConnection?) async -> HealthEndpoint {
        var next = endpoint
        guard let url = makeURL(baseURL: baseURL, path: endpoint.path) else {
            next.state = .failed("Invalid URL")
            next.detail = "URL could not be created."
            return next
        }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if endpoint.protectedIsExpected, let credentials, isSafeCredentialURL(url) {
            request.setValue("Basic \(basicAuth(username: credentials.username, password: credentials.applicationPassword))", forHTTPHeaderField: "Authorization")
        }

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                next.state = .failed("Invalid response")
                next.detail = "No HTTP response."
                return next
            }

            next.applyHTTPStatus(http.statusCode)
        } catch {
            next.state = .failed(error.localizedDescription)
            next.detail = "Network request failed."
        }

        return next
    }

    func makeURL(baseURL: String, path: String) -> URL? {
        let cleanBase = baseURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingTrailingSlash
        guard !cleanBase.isEmpty else { return nil }
        return URL(string: "\(cleanBase)/wp-json\(path)")
    }

    func isSafeCredentialURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        if scheme == "https" { return true }
        guard scheme == "http", let host = url.host?.lowercased() else { return false }
        return ["localhost", "127.0.0.1", "::1"].contains(host)
    }

    private func basicAuth(username: String, password: String) -> String {
        Data("\(username):\(password)".utf8).base64EncodedString()
    }
}

private struct WPErrorResponse: Decodable {
    let message: String?
}

private struct WPMeResponse: Decodable {
    let id: Int?
    let name: String?
    let slug: String?
    let roles: [String]?
    let capabilities: [String: Bool]?
    let avatarURLs: [String: String]?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case roles
        case capabilities
        case avatarURLs = "avatar_urls"
    }

    var user: WordPressUser {
        WordPressUser(
            id: id ?? 0,
            name: name ?? "WordPress user",
            slug: slug ?? "",
            roles: roles ?? [],
            capabilities: (capabilities ?? [:])
                .filter { $0.value }
                .map { $0.key }
                .sorted(),
            avatarURL: avatarURLs?["96"].flatMap(URL.init(string:))
        )
    }
}

struct WPContentResponse: Decodable {
    let id: Int?
    let slug: String?
    let title: WPRenderedText?
    let excerpt: WPRenderedText?
    let content: WPRenderedText?
    let caption: WPRenderedText?
    let description: WPRenderedText?
    let altText: String?
    let status: String?
    let date: String?
    let link: String?
    let mediaType: String?
    let mimeType: String?
    let sourceURL: String?

    enum CodingKeys: String, CodingKey {
        case id
        case slug
        case title
        case excerpt
        case content
        case caption
        case description
        case altText = "alt_text"
        case status
        case date
        case link
        case mediaType = "media_type"
        case mimeType = "mime_type"
        case sourceURL = "source_url"
    }

    func item(type: WordPressContentType) -> WordPressContentItem {
        let cleanSlug = slug?.nonEmpty ?? ""
        let cleanTitle = title?.rendered.strippingHTML.nonEmpty ?? cleanSlug.replacingOccurrences(of: "-", with: " ").nonEmpty ?? type.title
        let cleanExcerpt = excerpt?.rendered.strippingHTML.nonEmpty
        let cleanContent = content?.rendered.strippingHTML.nonEmpty
        let cleanCaption = caption?.rendered.strippingHTML.nonEmpty
        let cleanDescription = description?.rendered.strippingHTML.nonEmpty
        let cleanAltText = altText?.nonEmpty
        let detail = cleanExcerpt ?? cleanContent ?? cleanCaption ?? cleanDescription ?? cleanAltText ?? sourceURL ?? "No preview text available."
        let subtitle = subtitleText(type: type)

        return WordPressContentItem(
            id: id ?? 0,
            type: type,
            title: cleanTitle,
            slug: cleanSlug,
            subtitle: subtitle,
            detail: detail,
            status: status ?? mediaType ?? "available",
            date: date.flatMap(Self.parseDate),
            link: link.flatMap(URL.init(string:)),
            mediaURL: sourceURL.flatMap(URL.init(string:)),
            mediaType: mediaType,
            mimeType: mimeType
        )
    }

    private func subtitleText(type: WordPressContentType) -> String {
        switch type {
        case .posts, .pages:
            [status, slug].compactMap { $0?.nonEmpty }.joined(separator: " · ").nonEmpty ?? type.title
        case .media:
            [mediaType, mimeType].compactMap { $0?.nonEmpty }.joined(separator: " · ").nonEmpty ?? "media"
        }
    }

    static func parseDate(_ value: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter.date(from: value)
    }
}

struct WPRenderedText: Decodable {
    let rendered: String

    enum CodingKeys: String, CodingKey {
        case rendered
    }

    init(from decoder: Decoder) throws {
        if let value = try? decoder.singleValueContainer().decode(String.self) {
            rendered = value
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        rendered = try container.decodeIfPresent(String.self, forKey: .rendered) ?? ""
    }
}

extension String {
    var trimmingTrailingSlash: String {
        var value = self
        while value.hasSuffix("/") {
            value.removeLast()
        }
        return value
    }

    var strippingHTML: String {
        replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
