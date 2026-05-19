import SwiftUI

@MainActor
@Observable
final class AppViewModel {
    var baseURL = "http://localhost:18090"
    var username = ""
    var applicationPassword = ""
    var healthChecks = defaultHealthEndpoints
    var connectionUser: WordPressUser?
    var connectionError: String?
    var isCheckingHealth = false
    var isTestingConnection = false
    var isConnectionSaved = false
    var connectionNotice: String?
    var selectedContentType: WordPressContentType = .posts
    var contentItems: [WordPressContentItem] = []
    var contentError: String?
    var isLoadingContent = false

    private let api = WordPressAPIClient()
    private let credentialStore = KeychainCredentialStore()
    private var savedConnection: WordPressConnection?

    init() {
        restoreSavedConnection()
    }

    func runHealthChecks() async {
        isCheckingHealth = true
        healthChecks = healthChecks.map { check in
            var next = check
            next.state = .running
            next.detail = "Checking..."
            return next
        }
        healthChecks = await api.runHealthChecks(baseURL: baseURL, credentials: savedConnectionForCurrentBaseURL())
        isCheckingHealth = false
    }

    func testConnection() async {
        isTestingConnection = true
        connectionUser = nil
        connectionError = nil
        connectionNotice = nil
        let password = applicationPassword
        defer {
            applicationPassword = ""
            isTestingConnection = false
        }

        do {
            let user = try await api.validateConnection(
                baseURL: baseURL,
                username: username,
                applicationPassword: password
            )
            let connection = WordPressConnection(
                baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingTrailingSlash,
                username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                applicationPassword: password
            )
            connectionUser = user
            do {
                try credentialStore.save(connection)
                savedConnection = connection
                baseURL = connection.baseURL
                username = connection.username
                isConnectionSaved = true
                connectionNotice = "Connection saved securely in Keychain."
            } catch {
                savedConnection = nil
                isConnectionSaved = false
                connectionNotice = keychainNotice(for: error)
                if connectionNotice == nil {
                    connectionError = "Connected, but the credentials could not be saved: \(error.localizedDescription)"
                }
            }
            healthChecks = await api.runHealthChecks(baseURL: connection.baseURL, credentials: savedConnectionForCurrentBaseURL())
        } catch {
            connectionError = error.localizedDescription
        }
    }

    func loadContent() async {
        isLoadingContent = true
        contentError = nil
        do {
            contentItems = try await api.fetchContent(baseURL: baseURL, type: selectedContentType)
        } catch {
            contentItems = []
            contentError = error.localizedDescription
        }
        isLoadingContent = false
    }

    func refreshAll() async {
        await runHealthChecks()
        await loadContent()
    }

    func forgetConnection() {
        do {
            try credentialStore.clear()
            username = ""
            applicationPassword = ""
            savedConnection = nil
            connectionUser = nil
            connectionError = nil
            isConnectionSaved = false
            connectionNotice = "Saved connection removed from Keychain."
        } catch {
            connectionError = error.localizedDescription
        }
    }

    private func restoreSavedConnection() {
        do {
            guard let connection = try credentialStore.load() else { return }
            baseURL = connection.baseURL
            username = connection.username
            applicationPassword = ""
            savedConnection = connection
            isConnectionSaved = true
            connectionNotice = "Saved connection loaded from Keychain."
        } catch {
            if let notice = keychainNotice(for: error) {
                connectionNotice = notice
            } else {
                connectionError = error.localizedDescription
            }
        }
    }

    private func savedConnectionForCurrentBaseURL() -> WordPressConnection? {
        guard let connection = savedConnection,
              connection.baseURL == baseURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingTrailingSlash else {
            return nil
        }
        return connection
    }

    private func keychainNotice(for error: Error) -> String? {
        if KeychainCredentialStore.isMissingEntitlement(error) {
            return "Keychain needs a signed build. Select your Apple ID team in Xcode before the iPhone test."
        }
        return nil
    }

    var healthSummary: (ok: Int, protected: Int, errors: Int) {
        (
            healthChecks.filter { $0.state == .ok }.count,
            healthChecks.filter { $0.state == .protected }.count,
            healthChecks.filter {
                if case .failed = $0.state { return true }
                return false
            }.count
        )
    }

    var canTestConnection: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !applicationPassword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var isAuthenticatedHealthMode: Bool {
        savedConnectionForCurrentBaseURL() != nil
    }

    var healthModeTitle: String {
        isAuthenticatedHealthMode ? "Authenticated via Keychain" : "Anonymous mode"
    }

    var healthModeDetail: String {
        if isAuthenticatedHealthMode {
            return "Protected checks use saved Keychain credentials."
        }
        return "HTTP 401/403 on protected endpoints means WordPress is locked correctly."
    }
}

struct RootView: View {
    @State private var model = AppViewModel()
#if DEBUG && targetEnvironment(simulator)
    @State private var didRunSimulatorConnectionTest = false
#endif

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    HeroCard()
                    ConnectionCard(model: model)
                    ContentBrowserCard(model: model)
                    HealthCard(model: model)
                    ControlCenterCard(isAuthenticated: model.isAuthenticatedHealthMode)
                    LockedActionsCard()
                }
                .padding(18)
            }
            .refreshable {
                await model.refreshAll()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("wpBOX")
            .navigationDestination(for: WordPressContentItem.self) { item in
                ContentDetailView(item: item)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    StatusPill(title: "MVP", tint: .blue)
                }
            }
            .task {
                if model.healthChecks.allSatisfy({ $0.state == .idle }) {
                    await model.runHealthChecks()
                }
                if model.contentItems.isEmpty {
                    await model.loadContent()
                }
#if DEBUG && targetEnvironment(simulator)
                await runSimulatorConnectionTestIfRequested()
#endif
            }
        }
    }

#if DEBUG && targetEnvironment(simulator)
    private func runSimulatorConnectionTestIfRequested() async {
        guard !didRunSimulatorConnectionTest else { return }
        let environment = ProcessInfo.processInfo.environment
        guard environment["WPBOX_SIMULATOR_AUTOTEST_CONNECTION"] == "1",
              let username = environment["WPBOX_SIMULATOR_USERNAME"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              let password = environment["WPBOX_SIMULATOR_APPLICATION_PASSWORD"]?.trimmingCharacters(in: .whitespacesAndNewlines),
              !username.isEmpty,
              !password.isEmpty else {
            return
        }

        didRunSimulatorConnectionTest = true
        model.baseURL = environment["WPBOX_SIMULATOR_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? model.baseURL
        model.username = username
        model.applicationPassword = password
        await model.testConnection()
    }
#endif
}

private struct HeroCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("LarsenEvans-wpBOX")
                        .font(.title2.bold())
                    Text("Native WordPress control center")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "shippingbox.fill")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(.blue)
                    .symbolRenderingMode(.hierarchical)
            }

            Text("Safe first: read-only checks, credential validation, and locked write actions until the production target is explicit.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                StatusPill(title: "Read-only", tint: .green)
                StatusPill(title: "No SSH", tint: .secondary)
                StatusPill(title: "No WP-CLI", tint: .secondary)
            }
        }
        .cardStyle()
    }
}

private struct ConnectionCard: View {
    @Bindable var model: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(
                icon: "key.horizontal.fill",
                title: "Safe connection setup",
                subtitle: "Tests /wp/v2/users/me only. A valid password is stored only in Keychain."
            )

            HStack {
                StatusPill(title: model.isConnectionSaved ? "Keychain saved" : "Local test", tint: model.isConnectionSaved ? .green : .secondary)
                Spacer()
                if model.isConnectionSaved {
                    Button("Forget") {
                        model.forgetConnection()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(.red)
                }
            }

            VStack(spacing: 12) {
                TextField("WordPress URL", text: $model.baseURL)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .fieldStyle()

                TextField("Username", text: $model.username)
                    .textInputAutocapitalization(.never)
                    .textContentType(.username)
                    .fieldStyle()

                SecureField("Application Password", text: $model.applicationPassword)
                    .textContentType(.oneTimeCode)
                    .fieldStyle()
            }

            Button {
                Task { await model.testConnection() }
            } label: {
                Label(model.isTestingConnection ? "Testing..." : "Test connection", systemImage: model.isTestingConnection ? "hourglass" : "arrow.triangle.2.circlepath")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(model.isTestingConnection || !model.canTestConnection)

            if let user = model.connectionUser {
                UserResultView(user: user)
            }
            if let notice = model.connectionNotice {
                NoticeResultView(message: notice)
            }
            if let error = model.connectionError {
                ErrorResultView(message: error)
            } else if model.connectionUser == nil && model.connectionNotice == nil {
                Text("Waiting for a test. Save-to-Supabase is intentionally not part of this local iOS MVP screen.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .cardStyle()
    }
}

private struct ContentBrowserCard: View {
    @Bindable var model: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                SectionHeader(
                    icon: "square.grid.2x2.fill",
                    title: "Content browser",
                    subtitle: "Real WordPress posts, pages, and media in read-only mode."
                )
                Spacer()
                Button {
                    Task { await model.loadContent() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(model.isLoadingContent)
            }

            Picker("Content type", selection: $model.selectedContentType) {
                ForEach(WordPressContentType.allCases) { type in
                    Label(type.title, systemImage: type.icon).tag(type)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: model.selectedContentType) {
                Task { await model.loadContent() }
            }

            HStack {
                StatusPill(title: "Read-only", tint: .green)
                if !model.isLoadingContent, model.contentError == nil {
                    StatusPill(title: "\(model.contentItems.count) \(model.selectedContentType.title.lowercased())", tint: .secondary)
                }
            }

            if model.isLoadingContent {
                LoadingRow(title: "Loading \(model.selectedContentType.title.lowercased())...")
            } else if let error = model.contentError {
                ErrorResultView(message: error)
            } else if model.contentItems.isEmpty {
                EmptyStateRow(
                    title: "No \(model.selectedContentType.title.lowercased()) found",
                    detail: "The endpoint responded, but there is no public content to show."
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(model.contentItems) { item in
                        NavigationLink(value: item) {
                            ContentRow(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .cardStyle()
    }
}

private struct HealthCard: View {
    @Bindable var model: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                SectionHeader(
                    icon: "waveform.path.ecg.rectangle.fill",
                    title: "REST health",
                    subtitle: "Read-only WordPress endpoint diagnostics."
                )
                Spacer()
                Button {
                    Task { await model.runHealthChecks() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(model.isCheckingHealth)
            }

            HStack {
                StatusPill(title: model.healthModeTitle, tint: model.isAuthenticatedHealthMode ? .blue : .secondary)
                StatusPill(title: "\(model.healthSummary.ok) OK", tint: .green)
                StatusPill(title: "\(model.healthSummary.protected) protected", tint: .orange)
                StatusPill(title: "\(model.healthSummary.errors) errors", tint: model.healthSummary.errors == 0 ? .secondary : .red)
            }
            Text(model.healthModeDetail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 10) {
                ForEach(model.healthChecks) { check in
                    HealthRow(check: check)
                }
            }
        }
        .cardStyle()
    }
}

private struct ControlCenterCard: View {
    let isAuthenticated: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(
                icon: "slider.horizontal.3",
                title: "Control center",
                subtitle: "What the iOS MVP can show safely."
            )

            ForEach(capabilityGroups(isAuthenticated: isAuthenticated)) { group in
                VStack(alignment: .leading, spacing: 10) {
                    Text(group.title)
                        .font(.headline)
                    Text(group.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(group.rows) { row in
                        CapabilityRowView(row: row)
                    }
                }
                .padding(12)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .cardStyle()
    }
}

private struct LockedActionsCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(
                icon: "lock.shield.fill",
                title: "Production guardrails",
                subtitle: "Production-risk actions are blocked by design."
            )

            ForEach(productionGuardrails) { item in
                GuardrailRow(item: item)
            }
        }
        .cardStyle()
    }
}

private struct SectionHeader: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.blue)
                .frame(width: 28, height: 28)
                .background(.blue.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct HealthRow: View {
    let check: HealthEndpoint

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: iconName)
                .font(.body.weight(.semibold))
                .foregroundStyle(check.state.tint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(check.name)
                    .font(.subheadline.weight(.semibold))
                Text(check.path)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(check.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            StatusPill(title: statusTitle, tint: check.state.tint)
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }

    private var statusTitle: String {
        if check.state == .protected {
            return check.state.title
        }
        return check.statusCode.map { "HTTP \($0)" } ?? check.state.title
    }

    private var iconName: String {
        switch check.state {
        case .idle: "circle"
        case .running: "clock"
        case .ok: "checkmark.circle.fill"
        case .protected: "lock.circle.fill"
        case .failed: "xmark.circle.fill"
        }
    }
}

private enum ContentDateFormatter {
    static let short: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static let full: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

private struct ContentRow: View {
    let item: WordPressContentItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.type.icon)
                .font(.body.weight(.semibold))
                .foregroundStyle(item.type == .media ? .purple : .blue)
                .frame(width: 30, height: 30)
                .background((item.type == .media ? Color.purple : Color.blue).opacity(0.12), in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 8) {
                    Text(item.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                    Spacer(minLength: 6)
                    StatusPill(title: item.status, tint: item.status == "publish" ? .green : .secondary)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Label(item.typeLabel, systemImage: item.type.icon)
                    Label(item.slugLabel, systemImage: "number")
                    if let date = item.date {
                        Label(ContentDateFormatter.short.string(from: date), systemImage: "calendar")
                    }
                    if item.type == .media, let mimeType = item.mimeType?.nonEmpty {
                        Label(mimeType, systemImage: "doc")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

                Text(item.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct ContentDetailView: View {
    let item: WordPressContentItem

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Label(item.type.title, systemImage: item.type.icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.blue)
                    Text(item.title)
                        .font(.title2.bold())
                        .fixedSize(horizontal: false, vertical: true)
                    HStack {
                        StatusPill(title: item.status, tint: item.status == "publish" ? .green : .secondary)
                        StatusPill(title: item.typeLabel, tint: .blue)
                        StatusPill(title: item.slugLabel, tint: .secondary)
                    }
                }
                .cardStyle()

                if let mediaURL = item.mediaURL {
                    VStack(alignment: .leading, spacing: 10) {
                        if item.isImageMedia {
                            AsyncImage(url: mediaURL) { image in
                                image
                                    .resizable()
                                    .scaledToFit()
                                    .clipShape(RoundedRectangle(cornerRadius: 16))
                            } placeholder: {
                                LoadingRow(title: "Loading preview...")
                            }
                        } else {
                            EmptyStateRow(title: "Media preview unavailable", detail: item.mimeType ?? "This media type does not render as an image preview.")
                        }
                        Text(mediaURL.absoluteString)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)

                        Link(destination: mediaURL) {
                            Label("Open media source", systemImage: "arrow.up.forward.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                    .cardStyle()
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Read-only preview")
                        .font(.headline)
                    Text(item.detail)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    Divider()

                    MetadataRow(title: "Type", value: item.typeLabel)
                    MetadataRow(title: "Status", value: item.status)
                    MetadataRow(title: "Slug", value: item.slugLabel)
                    MetadataRow(title: "ID", value: "\(item.id)")
                    MetadataRow(title: "Date", value: item.date.map(ContentDateFormatter.full.string(from:)) ?? "Not provided")
                    if let mediaType = item.mediaType?.nonEmpty {
                        MetadataRow(title: "Media", value: mediaType)
                    }
                    if let mimeType = item.mimeType?.nonEmpty {
                        MetadataRow(title: "MIME", value: mimeType)
                    }
                    if let link = item.link {
                        MetadataRow(title: "Link", value: link.absoluteString)
                    }
                    if let mediaURL = item.mediaURL {
                        MetadataRow(title: "Source", value: mediaURL.absoluteString)
                    }
                }
                .cardStyle()

                if let link = item.link {
                    Link(destination: link) {
                        Label("Open in WordPress", systemImage: "safari")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
            .padding(18)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(item.type.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct MetadataRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 74, alignment: .leading)
            Text(value)
                .font(.caption)
                .foregroundStyle(.primary)
                .textSelection(.enabled)
            Spacer()
        }
    }
}

private struct LoadingRow: View {
    let title: String

    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text(title)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct EmptyStateRow: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.footnote.weight(.semibold))
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct UserResultView: View {
    let user: WordPressUser

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                AsyncImage(url: user.avatarURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.largeTitle)
                        .foregroundStyle(.green)
                }
                .frame(width: 44, height: 44)
                .clipShape(Circle())

                VStack(alignment: .leading) {
                    Text(user.name)
                        .font(.headline)
                    Text(user.slug.isEmpty ? "WordPress account" : user.slug)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            HStack {
                ForEach(user.roles.isEmpty ? ["role hidden"] : user.roles, id: \.self) { role in
                    StatusPill(title: role, tint: .green)
                }
                StatusPill(title: "\(user.capabilities.count) caps", tint: .blue)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(.green.opacity(0.20))
        )
    }
}

private struct ErrorResultView: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.red.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct NoticeResultView: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(.green)
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.green.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct CapabilityRowView: View {
    let row: CapabilityRow

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(row.title)
                    .font(.subheadline.weight(.semibold))
                Text(row.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            StatusPill(title: row.state.label, tint: row.state.tint)
        }
        .padding(10)
        .background(Color(.systemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct GuardrailRow: View {
    let item: GuardrailItem

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lock.shield.fill")
                .foregroundStyle(.blue)
                .frame(width: 22, height: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                Text(item.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct StatusPill: View {
    let title: String
    let tint: Color

    var body: some View {
        Text(title)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(tint.opacity(0.12), in: Capsule())
    }
}

private extension View {
    func cardStyle() -> some View {
        self
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 22))
            .overlay(
                RoundedRectangle(cornerRadius: 22)
                    .stroke(Color(.separator).opacity(0.30))
            )
    }

    func fieldStyle() -> some View {
        self
            .textFieldStyle(.plain)
            .padding(12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
            .autocorrectionDisabled()
    }
}
