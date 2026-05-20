import SwiftUI
import UIKit

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
    var contentSearchQuery = ""
    var contentStatusFilter = ContentExplorerFilter.allStatuses
    var contentSortOption: ContentSortOption = .newestFirst
    var contentItems: [WordPressContentItem] = []
    var contentError: String?
    var isLoadingContent = false
    var overviewCounts = SiteOverviewCounts()
    var overviewError: String?
    var isLoadingOverview = false
    var lastOverviewRefresh: Date?
    var snapshotItems: [WordPressContentType: [WordPressContentItem]] = [:]
    var snapshotError: String?
    var isLoadingSnapshot = false
    var lastSnapshotRefresh: Date?
    var hasLoadedSnapshot = false
    var siteProfiles: [SiteProfile] = []
    var selectedSiteProfileID: SiteProfile.ID?
    var siteProfileName = "Local WordPress"
    var siteProfileNotice: String?
    var siteProfileError: String?
    var addSiteDraft = SiteProfileDraft()
    var addSiteError: String?
    var isSwitchingSite = false
    var cleanupDiagnostics = CleanupDiagnosticsPayload()
    var cleanupDiagnosticsError: String?
    var isLoadingCleanupDiagnostics = false

    private let api = WordPressAPIClient()
    private let credentialStore = KeychainCredentialStore()
    private let siteProfileStore = SiteProfileStore()
    private var savedConnection: WordPressConnection?

    init() {
        restoreSiteProfiles()
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
        overviewError = nil
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
                let profile = currentSiteProfile(lastRefresh: Date())
                try credentialStore.save(connection, for: profile)
                try credentialStore.save(connection)
                savedConnection = connection
                baseURL = connection.baseURL
                username = connection.username
                isConnectionSaved = true
                upsertSiteProfile(profile)
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
            await refreshContentCounts()
            let refreshDate = Date()
            lastOverviewRefresh = refreshDate
            recordActiveSiteRefresh(refreshDate)
        } catch {
            connectionError = error.localizedDescription
        }
    }

    func refreshOverview() async {
        isLoadingOverview = true
        overviewError = nil
        defer { isLoadingOverview = false }

        await runHealthChecks()
        await refreshSavedConnectionUser()
        await refreshContentCounts()
        let refreshDate = Date()
        lastOverviewRefresh = refreshDate
        recordActiveSiteRefresh(refreshDate)
    }

    func testSavedConnection() async {
        guard let connection = savedConnectionForCurrentBaseURL() else {
            connectionError = "No saved Keychain connection for this WordPress URL."
            return
        }

        isTestingConnection = true
        connectionError = nil
        connectionNotice = nil
        overviewError = nil
        defer { isTestingConnection = false }

        do {
            connectionUser = try await api.validateConnection(
                baseURL: connection.baseURL,
                username: connection.username,
                applicationPassword: connection.applicationPassword
            )
            connectionNotice = "Saved Keychain connection is valid."
            healthChecks = await api.runHealthChecks(baseURL: connection.baseURL, credentials: connection)
            await refreshContentCounts()
            let refreshDate = Date()
            lastOverviewRefresh = refreshDate
            recordActiveSiteRefresh(refreshDate)
        } catch {
            connectionUser = nil
            connectionError = "Saved connection test failed: \(error.localizedDescription)"
            overviewError = connectionError
        }
    }

    func loadContent() async {
        isLoadingContent = true
        contentError = nil
        do {
            contentItems = try await api.fetchContent(baseURL: baseURL, type: selectedContentType)
            normalizeContentStatusFilter()
        } catch {
            contentItems = []
            contentError = error.localizedDescription
        }
        isLoadingContent = false
    }

    func refreshAll() async {
        await refreshOverview()
        await refreshCleanupDiagnostics()
        await loadContent()
    }

    func refreshCleanupDiagnostics() async {
        isLoadingCleanupDiagnostics = true
        cleanupDiagnosticsError = nil
        defer { isLoadingCleanupDiagnostics = false }

        var next = CleanupDiagnosticsPayload()
        var failures: [String] = []
        let credentials = savedConnectionForCurrentBaseURL()

        do {
            next.status = CleanupPluginStatus(routes: try await api.fetchCleanupRoutes(baseURL: baseURL, credentials: credentials))
        } catch {
            failures.append("Routes: \(error.localizedDescription)")
        }

        do {
            next.history = try await api.fetchCleanupHistory(baseURL: baseURL, credentials: credentials)
        } catch {
            failures.append("History: \(error.localizedDescription)")
        }

        do {
            next.backups = try await api.fetchCleanupBackups(baseURL: baseURL, credentials: credentials)
        } catch {
            failures.append("Backups: \(error.localizedDescription)")
        }

        cleanupDiagnostics = next
        cleanupDiagnosticsError = failures.isEmpty ? nil : failures.joined(separator: "\n")
    }

    func refreshSnapshot() async {
        isLoadingSnapshot = true
        snapshotError = nil
        defer { isLoadingSnapshot = false }

        await refreshOverview()

        var nextItems: [WordPressContentType: [WordPressContentItem]] = [:]
        var failures: [String] = []
        for type in WordPressContentType.allCases {
            do {
                let items = try await api.fetchContent(baseURL: baseURL, type: type)
                nextItems[type] = Array(items.prefix(5))
            } catch {
                nextItems[type] = []
                failures.append("\(type.title): \(error.localizedDescription)")
            }
        }

        snapshotItems = nextItems
        hasLoadedSnapshot = true
        lastSnapshotRefresh = Date()
        if !failures.isEmpty {
            snapshotError = failures.joined(separator: "\n")
        }
    }

    func forgetConnection() {
        do {
            if let profile = activeSiteProfile {
                try credentialStore.clear(for: profile)
            }
            try credentialStore.clear()
            username = ""
            applicationPassword = ""
            savedConnection = nil
            connectionUser = nil
            connectionError = nil
            overviewError = nil
            snapshotError = nil
            snapshotItems = [:]
            hasLoadedSnapshot = false
            lastSnapshotRefresh = nil
            isConnectionSaved = false
            connectionNotice = "Saved connection removed from Keychain."
        } catch {
            connectionError = error.localizedDescription
        }
    }

    func forgetConnectionAndRefresh() async {
        forgetConnection()
        await refreshOverview()
    }

    func saveCurrentSiteProfile() {
        siteProfileNotice = nil
        siteProfileError = nil
        let profile = currentSiteProfile(lastRefresh: lastOverviewRefresh)

        do {
            if let connection = savedConnectionForCurrentBaseURL() {
                try credentialStore.save(connection, for: profile)
            }
            upsertSiteProfile(profile)
            siteProfileNotice = savedConnectionForCurrentBaseURL() == nil
                ? "Site profile saved without credentials. Add an Application Password to authenticate it."
                : "Site profile saved. Credentials remain only in Keychain."
        } catch {
            siteProfileError = keychainNotice(for: error) ?? error.localizedDescription
        }
    }

    func prepareAddSiteProfile() {
        addSiteError = nil
        let defaultName = siteProfiles.isEmpty ? "Local WordPress" : "Local WordPress Anonymous"
        addSiteDraft = SiteProfileDraft(
            name: defaultName,
            baseURL: normalizedBaseURL,
            username: ""
        )
    }

    func addSiteProfileFromDraft() async -> Bool {
        addSiteError = nil
        siteProfileNotice = nil
        siteProfileError = nil

        guard addSiteDraft.canSave else {
            addSiteError = "Add a site name and WordPress URL."
            return false
        }

        let profile = addSiteDraft.makeProfile()
        upsertSiteProfile(profile)
        await selectSiteProfile(profile)
        siteProfileNotice = "Site profile added without credentials. Add an Application Password only when this site needs authenticated reads."
        return true
    }

    func selectSiteProfile(_ profile: SiteProfile) async {
        isSwitchingSite = true
        siteProfileNotice = nil
        siteProfileError = nil
        addSiteError = nil
        prepareForSiteSwitch(to: profile)
        defer { isSwitchingSite = false }

        do {
            savedConnection = try credentialStore.load(for: profile)
            isConnectionSaved = savedConnection != nil
            connectionNotice = savedConnection == nil
                ? "Site profile selected. Add an Application Password to authenticate it."
                : "Site profile selected with Keychain credentials."
        } catch {
            savedConnection = nil
            isConnectionSaved = false
            siteProfileError = keychainNotice(for: error) ?? error.localizedDescription
        }

        await refreshAll()
    }

    func forgetSiteProfile(_ profile: SiteProfile) async {
        siteProfileNotice = nil
        siteProfileError = nil

        do {
            try credentialStore.clear(for: profile)
            if profile.id == selectedSiteProfileID {
                try credentialStore.clear()
            }
            siteProfiles = siteProfileStore.deleteProfile(id: profile.id, from: siteProfiles)

            if profile.id == selectedSiteProfileID {
                if let nextProfile = siteProfiles.first {
                    await selectSiteProfile(nextProfile)
                } else {
                    resetToAnonymousSiteState()
                    await refreshAll()
                }
            }
            siteProfileNotice = "Site profile removed locally. WordPress was not changed."
        } catch {
            siteProfileError = keychainNotice(for: error) ?? error.localizedDescription
        }
    }

    private func restoreSiteProfiles() {
        siteProfiles = siteProfileStore.loadProfiles()
        let savedActiveID = siteProfileStore.loadActiveProfileID()
        selectedSiteProfileID = siteProfiles.contains { $0.id == savedActiveID } ? savedActiveID : siteProfiles.first?.id
        if let profile = activeSiteProfile {
            siteProfileName = profile.name
            baseURL = profile.baseURL
            username = profile.username
        }
    }

    private func restoreSavedConnection() {
        do {
            if let profile = activeSiteProfile {
                if let connection = try credentialStore.load(for: profile) {
                    applySavedConnection(connection, notice: "Saved connection loaded from Keychain.")
                    return
                }
                connectionNotice = "Site profile loaded. Add an Application Password to authenticate it."
                return
            }

            guard let connection = try credentialStore.load() else { return }
            let profile = SiteProfile.make(
                name: siteProfileName,
                baseURL: connection.baseURL,
                username: connection.username,
                lastRefresh: lastOverviewRefresh
            )
            upsertSiteProfile(profile)
            try? credentialStore.save(connection, for: profile)
            applySavedConnection(connection, notice: "Saved connection loaded from Keychain.")
        } catch {
            if let notice = keychainNotice(for: error) {
                connectionNotice = notice
            } else {
                connectionError = error.localizedDescription
            }
        }
    }

    private func applySavedConnection(_ connection: WordPressConnection, notice: String) {
        baseURL = connection.baseURL
        username = connection.username
        applicationPassword = ""
        savedConnection = connection
        isConnectionSaved = true
        connectionNotice = notice
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

    var connectionMode: SiteConnectionMode {
        isAuthenticatedHealthMode ? .authenticatedViaKeychain : .anonymous
    }

    var normalizedBaseURL: String {
        baseURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingTrailingSlash
    }

    var activeSiteProfile: SiteProfile? {
        siteProfiles.first { $0.id == selectedSiteProfileID }
    }

    var canSaveCurrentSiteProfile: Bool {
        !siteProfileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !normalizedBaseURL.isEmpty
    }

    var contentExplorerFilter: ContentExplorerFilter {
        ContentExplorerFilter(
            searchQuery: contentSearchQuery,
            status: contentStatusFilter,
            sort: contentSortOption
        )
    }

    var contentExplorerResult: ContentExplorerResult {
        ContentExplorer.result(for: contentItems, filter: contentExplorerFilter)
    }

    var filteredContentItems: [WordPressContentItem] {
        contentExplorerResult.items
    }

    var contentFilterIsActive: Bool {
        !contentExplorerFilter.isDefault
    }

    var availableContentStatuses: [String] {
        ContentExplorer.statusOptions(for: contentItems)
    }

    var contentStatusFilterLabel: String {
        contentStatusFilter == ContentExplorerFilter.allStatuses ? "All statuses" : contentStatusFilter
    }

    func resetContentExplorerFilters() {
        contentSearchQuery = ""
        contentStatusFilter = ContentExplorerFilter.allStatuses
        contentSortOption = .newestFirst
    }

    var snapshotSections: [SiteSnapshotSection] {
        WordPressContentType.allCases.map { type in
            SiteSnapshotSection(
                type: type,
                totalCount: overviewCounts.count(for: type),
                items: snapshotItems[type] ?? []
            )
        }
    }

    var siteSnapshotReportText: String {
        let health = healthSummary
        let lastRefresh = lastOverviewRefresh.map(SnapshotDateFormatter.report.string(from:)) ?? "Not refreshed yet"
        let snapshotRefresh = lastSnapshotRefresh.map(SnapshotDateFormatter.report.string(from:)) ?? "Not generated yet"
        let userLabel: String
        if let user = connectionUser {
            let roles = user.roles.isEmpty ? "roles hidden" : user.roles.joined(separator: ", ")
            userLabel = "\(user.name) (\(roles))"
        } else {
            userLabel = isAuthenticatedHealthMode ? "Authenticated user not verified yet" : "Not connected"
        }

        var lines = [
            "LarsenEvans-wpBOX Site Snapshot",
            "",
            "WordPress URL: \(normalizedBaseURL)",
            "Auth mode: \(connectionMode.label)",
            "User: \(userLabel)",
            "REST health: \(health.ok) OK / \(health.protected) protected / \(health.errors) errors",
            "Counts: \(overviewCounts.count(for: .posts)) posts / \(overviewCounts.count(for: .pages)) pages / \(overviewCounts.count(for: .media)) media",
            "Last overview refresh: \(lastRefresh)",
            "Snapshot generated: \(snapshotRefresh)",
            "",
            "Content summary"
        ]

        for section in snapshotSections {
            lines.append("")
            lines.append("\(section.type.title) (\(section.countLabel))")
            lines.append(contentsOf: section.exportLines())
        }

        lines.append("")
        lines.append("Read-only export. No WordPress write actions were executed.")
        return lines.joined(separator: "\n")
    }

    private func refreshSavedConnectionUser() async {
        guard let connection = savedConnectionForCurrentBaseURL() else {
            connectionUser = nil
            return
        }

        do {
            connectionUser = try await api.validateConnection(
                baseURL: connection.baseURL,
                username: connection.username,
                applicationPassword: connection.applicationPassword
            )
            connectionError = nil
        } catch {
            connectionUser = nil
            connectionError = "Saved connection test failed: \(error.localizedDescription)"
            overviewError = connectionError
        }
    }

    private func refreshContentCounts() async {
        do {
            var next: [WordPressContentType: Int] = [:]
            for type in WordPressContentType.allCases {
                next[type] = try await api.fetchContentCount(baseURL: baseURL, type: type)
            }
            overviewCounts = SiteOverviewCounts(values: next)
        } catch {
            overviewError = error.localizedDescription
        }
    }

    private func currentSiteProfile(lastRefresh: Date?) -> SiteProfile {
        SiteProfile.make(
            name: siteProfileName,
            baseURL: baseURL,
            username: username,
            lastRefresh: lastRefresh
        )
    }

    private func upsertSiteProfile(_ profile: SiteProfile) {
        siteProfiles = siteProfileStore.upsert(profile, into: siteProfiles)
        selectedSiteProfileID = profile.id
        siteProfileName = profile.name
    }

    private func recordActiveSiteRefresh(_ date: Date) {
        guard let activeID = selectedSiteProfileID,
              let index = siteProfiles.firstIndex(where: { $0.id == activeID }) else {
            return
        }
        siteProfiles[index].lastRefresh = date
        siteProfiles[index].updatedAt = date
        siteProfileStore.saveProfiles(siteProfiles)
    }

    private func resetToAnonymousSiteState() {
        selectedSiteProfileID = nil
        siteProfileStore.saveActiveProfileID(nil)
        siteProfileName = "Local WordPress"
        baseURL = "http://localhost:18090"
        username = ""
        applicationPassword = ""
        clearSiteScopedState()
        resetContentExplorerFilters()
    }

    private func prepareForSiteSwitch(to profile: SiteProfile) {
        selectedSiteProfileID = profile.id
        siteProfileStore.saveActiveProfileID(profile.id)
        siteProfileName = profile.name
        baseURL = profile.baseURL
        username = profile.username
        applicationPassword = ""
        clearSiteScopedState()
        resetContentExplorerFilters()
    }

    private func clearSiteScopedState() {
        savedConnection = nil
        connectionUser = nil
        connectionError = nil
        connectionNotice = nil
        isConnectionSaved = false
        healthChecks = defaultHealthEndpoints
        overviewCounts = SiteOverviewCounts()
        overviewError = nil
        lastOverviewRefresh = nil
        contentItems = []
        contentError = nil
        cleanupDiagnostics = CleanupDiagnosticsPayload()
        cleanupDiagnosticsError = nil
        snapshotItems = [:]
        snapshotError = nil
        hasLoadedSnapshot = false
        lastSnapshotRefresh = nil
    }

    private func normalizeContentStatusFilter() {
        guard contentStatusFilter != ContentExplorerFilter.allStatuses else { return }
        if !availableContentStatuses.contains(contentStatusFilter) {
            contentStatusFilter = ContentExplorerFilter.allStatuses
        }
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
                    SavedSitesCard(model: model)
                    SiteOverviewCard(model: model)
                    DatabaseCleanupCard(model: model)
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
                await model.refreshOverview()
                await model.refreshCleanupDiagnostics()
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
                    ForgetConnectionButton(model: model, isFullWidth: false)
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

private enum OverviewDateFormatter {
    static let timestamp: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

private enum SnapshotDateFormatter {
    static let report: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

private enum CleanupDateFormatter {
    static let short: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

private struct SiteOverviewCard: View {
    @Bindable var model: AppViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                SectionHeader(
                    icon: "gauge.medium",
                    title: "Site overview",
                    subtitle: "Connection, REST health, and content counts at a glance."
                )
                Spacer()
                Button {
                    Task { await model.refreshOverview() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(model.isSwitchingSite || model.isLoadingOverview || model.isCheckingHealth)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    StatusPill(title: model.connectionMode.label, tint: model.connectionMode.tint)
                    StatusPill(title: "\(model.healthSummary.ok) OK", tint: .green)
                }
                HStack {
                    StatusPill(title: "\(model.healthSummary.protected) protected", tint: .blue)
                    StatusPill(title: "\(model.healthSummary.errors) errors", tint: model.healthSummary.errors == 0 ? .secondary : .red)
                }
            }
            Text(model.connectionMode.detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                OverviewMetricTile(
                    title: "Posts",
                    value: model.overviewCounts.count(for: .posts),
                    icon: WordPressContentType.posts.icon,
                    tint: .blue
                )
                OverviewMetricTile(
                    title: "Pages",
                    value: model.overviewCounts.count(for: .pages),
                    icon: WordPressContentType.pages.icon,
                    tint: .indigo
                )
                OverviewMetricTile(
                    title: "Media",
                    value: model.overviewCounts.count(for: .media),
                    icon: WordPressContentType.media.icon,
                    tint: .purple
                )
            }

            VStack(alignment: .leading, spacing: 8) {
                MetadataRow(title: "URL", value: model.normalizedBaseURL)
                MetadataRow(title: "Mode", value: model.connectionMode.label)
                MetadataRow(title: "User", value: overviewUserLabel)
                MetadataRow(title: "Roles", value: overviewRoleLabel)
                MetadataRow(title: "Refresh", value: lastRefreshLabel)
            }
            .padding(12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))

            VStack(spacing: 10) {
                Button {
                    Task { await model.refreshOverview() }
                } label: {
                    Label(model.isLoadingOverview ? "Refreshing..." : "Refresh overview", systemImage: "arrow.clockwise")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isSwitchingSite || model.isLoadingOverview)

                NavigationLink {
                    SiteSnapshotView(model: model)
                } label: {
                    Label("Open Site Snapshot", systemImage: "doc.text.magnifyingglass")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await model.testSavedConnection() }
                } label: {
                    Label(model.isTestingConnection ? "Testing..." : "Test connection again", systemImage: "checkmark.shield")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(model.isSwitchingSite || model.isTestingConnection || !model.isAuthenticatedHealthMode)

                if model.isConnectionSaved {
                    ForgetConnectionButton(model: model, isFullWidth: true)
                }
            }

            if model.isSwitchingSite {
                LoadingRow(title: "Switching to \(model.siteProfileName)...")
            } else if model.isLoadingOverview {
                LoadingRow(title: "Refreshing site overview...")
            }
            if let notice = model.connectionMode.notice {
                NoticeResultView(message: notice)
            }
            if let error = model.overviewError {
                ErrorResultView(message: error)
            }
        }
        .cardStyle()
    }

    private var overviewUserLabel: String {
        guard let user = model.connectionUser else {
            return model.isAuthenticatedHealthMode ? "Not verified yet" : "Not connected"
        }
        return user.name
    }

    private var overviewRoleLabel: String {
        guard let user = model.connectionUser else {
            return model.isAuthenticatedHealthMode ? "Pending test" : "None"
        }
        return user.roles.isEmpty ? "Role hidden" : user.roles.joined(separator: ", ")
    }

    private var lastRefreshLabel: String {
        guard let date = model.lastOverviewRefresh else {
            return "Not refreshed yet"
        }
        return OverviewDateFormatter.timestamp.string(from: date)
    }
}

private struct ForgetConnectionButton: View {
    @Bindable var model: AppViewModel
    let isFullWidth: Bool
    @State private var isConfirming = false

    var body: some View {
        Button(role: .destructive) {
            isConfirming = true
        } label: {
            if isFullWidth {
                Label("Forget saved connection", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            } else {
                Text("Forget")
            }
        }
        .buttonStyle(.bordered)
        .controlSize(isFullWidth ? .regular : .small)
        .disabled(model.isSwitchingSite || model.isLoadingOverview || model.isTestingConnection)
        .alert("Forget saved connection?", isPresented: $isConfirming) {
            Button("Cancel", role: .cancel) {}
            Button("Forget", role: .destructive) {
                Task { await model.forgetConnectionAndRefresh() }
            }
        } message: {
            Text("This removes only the local Keychain connection. WordPress content and settings are not changed.")
        }
    }
}

private struct DatabaseCleanupCard: View {
    @Bindable var model: AppViewModel

    var body: some View {
        let diagnostics = model.cleanupDiagnostics

        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                SectionHeader(
                    icon: "externaldrive.badge.checkmark",
                    title: "Database Cleanup",
                    subtitle: "Read-only diagnostics for Clean H4CK3D Database."
                )
                Spacer()
                Button {
                    Task { await model.refreshCleanupDiagnostics() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(model.isSwitchingSite || model.isLoadingCleanupDiagnostics)
            }

            HStack {
                StatusPill(title: "Read-only diagnostics", tint: .green)
                StatusPill(title: diagnostics.status.statusLabel, tint: diagnostics.status.isDetected ? .blue : .secondary)
            }
            HStack {
                StatusPill(title: "Cleanup locked", tint: .secondary)
                StatusPill(title: "Rollback locked", tint: .secondary)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                OverviewMetricTile(
                    title: "Routes",
                    value: diagnostics.status.routes.count,
                    icon: "point.3.connected.trianglepath.dotted",
                    tint: .blue
                )
                OverviewMetricTile(
                    title: "History",
                    value: diagnostics.historyCount,
                    icon: "clock.arrow.circlepath",
                    tint: .green
                )
                OverviewMetricTile(
                    title: "Backups",
                    value: diagnostics.backupsCount,
                    icon: "archivebox.fill",
                    tint: .purple
                )
            }

            VStack(alignment: .leading, spacing: 10) {
                MetadataRow(title: "Namespace", value: CleanupPluginStatus.namespace)
                MetadataRow(title: "Safe GET", value: diagnostics.status.readOnlyRoutes.map(\.path).joined(separator: ", ").nonEmpty ?? "history, backups")
                MetadataRow(title: "Locked writes", value: diagnostics.status.lockedRoutes.map(\.path).joined(separator: ", ").nonEmpty ?? "deep-clean, rollback")
            }
            .padding(12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))

            if model.isLoadingCleanupDiagnostics {
                LoadingRow(title: "Checking cleanup plugin read-only endpoints...")
            }

            if let latestHistory = diagnostics.latestHistory {
                CleanupLatestHistoryRow(item: latestHistory)
            } else if !model.isLoadingCleanupDiagnostics {
                EmptyStateRow(
                    title: "No cleanup history loaded",
                    detail: "The diagnostic panel has not received a cleanup history record yet."
                )
            }

            if let latestBackup = diagnostics.latestBackup {
                CleanupLatestBackupRow(item: latestBackup)
            }

            if !diagnostics.status.routes.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Available plugin endpoints")
                        .font(.subheadline.weight(.semibold))
                    ForEach(diagnostics.status.routes) { route in
                        CleanupRouteRow(route: route)
                    }
                }
            }

            if let error = model.cleanupDiagnosticsError {
                NoticeResultView(message: "Some cleanup diagnostics are unavailable in read-only mode:\n\(error)")
            }
        }
        .cardStyle()
    }
}

private struct CleanupLatestHistoryRow: View {
    let item: CleanupHistoryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Latest cleanup record", systemImage: "clock.arrow.circlepath")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                StatusPill(title: item.status.capitalized, tint: .blue)
            }
            Text(item.action)
                .font(.caption.weight(.semibold))
            Text(item.summary)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if let date = item.date {
                Text(CleanupDateFormatter.short.string(from: date))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct CleanupLatestBackupRow: View {
    let item: CleanupBackupItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Latest backup", systemImage: "archivebox.fill")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                StatusPill(title: item.status.capitalized, tint: .purple)
            }
            Text(item.name)
                .font(.caption.weight(.semibold))
                .lineLimit(2)
            if let sizeLabel = item.sizeLabel {
                Text(sizeLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let date = item.date {
                Text(CleanupDateFormatter.short.string(from: date))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct CleanupRouteRow: View {
    let route: CleanupRoute

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: route.isDestructive ? "lock.shield.fill" : "checkmark.shield.fill")
                .foregroundStyle(route.isDestructive ? Color.secondary : Color.green)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(route.path)
                    .font(.caption.monospaced())
                    .lineLimit(1)
                Text(route.methodLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            StatusPill(title: route.lockLabel, tint: route.isDestructive ? .secondary : .green)
        }
        .padding(10)
        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct SavedSitesCard: View {
    @Bindable var model: AppViewModel
    @State private var isShowingAddSite = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(
                icon: "globe.badge.chevron.backward",
                title: "Saved Sites",
                subtitle: "Local site profiles. Secrets stay in Keychain, never in UserDefaults."
            )

            HStack {
                StatusPill(title: model.connectionMode.label, tint: model.connectionMode.tint)
                StatusPill(title: "\(model.siteProfiles.count) saved", tint: .secondary)
                if model.isSwitchingSite {
                    StatusPill(title: "Switching", tint: .blue)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                TextField("Site name", text: $model.siteProfileName)
                    .textInputAutocapitalization(.words)
                    .fieldStyle()

                Button {
                    model.saveCurrentSiteProfile()
                } label: {
                    Label("Save current site profile", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(model.isSwitchingSite || !model.canSaveCurrentSiteProfile)

                Button {
                    model.prepareAddSiteProfile()
                    isShowingAddSite = true
                } label: {
                    Label("Add another site", systemImage: "plus.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isSwitchingSite)
            }

            if model.siteProfiles.isEmpty {
                EmptyStateRow(
                    title: "No saved sites yet",
                    detail: "Save the current WordPress URL as a local profile. Application Passwords stay only in Keychain after a successful connection test."
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(model.siteProfiles) { profile in
                        SavedSiteRow(model: model, profile: profile)
                    }
                }
            }

            if let notice = model.siteProfileNotice {
                NoticeResultView(message: notice)
            }
            if let error = model.siteProfileError {
                ErrorResultView(message: error)
            }
        }
        .cardStyle()
        .sheet(isPresented: $isShowingAddSite) {
            AddSiteProfileSheet(model: model)
        }
    }
}

private struct AddSiteProfileSheet: View {
    @Bindable var model: AppViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeader(
                        icon: "plus.circle.fill",
                        title: "Add site profile",
                        subtitle: "Create a local profile without saving any Application Password."
                    )

                    VStack(spacing: 12) {
                        TextField("Site name", text: $model.addSiteDraft.name)
                            .textInputAutocapitalization(.words)
                            .fieldStyle()

                        TextField("WordPress URL", text: $model.addSiteDraft.baseURL)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.URL)
                            .textContentType(.URL)
                            .fieldStyle()

                        TextField("Username optional", text: $model.addSiteDraft.username)
                            .textInputAutocapitalization(.never)
                            .textContentType(.username)
                            .fieldStyle()
                    }

                    NoticeResultView(message: "This saves only name, URL, and username. Application Passwords are added later through Safe connection setup and stored only in Keychain.")

                    if let error = model.addSiteError {
                        ErrorResultView(message: error)
                    }
                }
                .padding(18)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Add Site")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await model.addSiteProfileFromDraft() {
                                dismiss()
                            }
                        }
                    }
                    .disabled(!model.addSiteDraft.canSave)
                }
            }
        }
    }
}

private struct SavedSiteRow: View {
    @Bindable var model: AppViewModel
    let profile: SiteProfile
    @State private var isConfirmingForget = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: isActive ? "checkmark.circle.fill" : "globe")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(isActive ? .green : .blue)
                    .frame(width: 28, height: 28)
                    .background((isActive ? Color.green : Color.blue).opacity(0.12), in: Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(profile.name)
                        .font(.subheadline.weight(.semibold))
                    Text(profile.baseURL)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Text("User: \(profile.usernameLabel)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let lastRefresh = profile.lastRefresh {
                        Text("Last refresh: \(OverviewDateFormatter.timestamp.string(from: lastRefresh))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
                StatusPill(title: isActive ? "Selected" : "Saved", tint: isActive ? .green : .secondary)
            }

            if isActive {
                HStack {
                    StatusPill(title: model.connectionMode.label, tint: model.connectionMode.tint)
                    StatusPill(title: model.isConnectionSaved ? "Keychain" : "No credentials", tint: model.isConnectionSaved ? .blue : .secondary)
                }
            }

            HStack(spacing: 10) {
                Button {
                    Task { await model.selectSiteProfile(profile) }
                } label: {
                    Label(isActive ? "Selected" : "Use site", systemImage: "arrow.right.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isActive || model.isSwitchingSite)

                Button(role: .destructive) {
                    isConfirmingForget = true
                } label: {
                    Label("Forget site", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(model.isSwitchingSite)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
        .alert("Forget this site profile?", isPresented: $isConfirmingForget) {
            Button("Cancel", role: .cancel) {}
            Button("Forget site", role: .destructive) {
                Task { await model.forgetSiteProfile(profile) }
            }
        } message: {
            Text("This removes the local profile and matching Keychain credentials only. WordPress content, settings, plugins, and database are not changed.")
        }
    }

    private var isActive: Bool {
        profile.id == model.selectedSiteProfileID
    }
}

private struct OverviewMetricTile: View {
    let title: String
    let value: Int
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            Text("\(value)")
                .font(.title3.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct SiteSnapshotView: View {
    @Bindable var model: AppViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeader(
                        icon: "doc.text.magnifyingglass",
                        title: "Site Snapshot",
                        subtitle: "A read-only export report for the current WordPress connection."
                    )

                    HStack {
                        StatusPill(title: "Read-only export", tint: .green)
                        StatusPill(title: model.connectionMode.label, tint: model.connectionMode.tint)
                    }

                    Text("Includes URL, auth mode, REST health, content counts, last refresh, and a short public content summary.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    ShareLink(item: model.siteSnapshotReportText) {
                        Label("Share snapshot", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(model.isSwitchingSite)

                    Button {
                        Task { await model.refreshSnapshot() }
                    } label: {
                        Label(model.isLoadingSnapshot ? "Refreshing snapshot..." : "Refresh snapshot", systemImage: "arrow.clockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(model.isSwitchingSite || model.isLoadingSnapshot)
                }
                .cardStyle()

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(
                        icon: "list.clipboard.fill",
                        title: "Report metadata",
                        subtitle: "Current values captured from the local app state."
                    )

                    MetadataRow(title: "URL", value: model.normalizedBaseURL)
                    MetadataRow(title: "Mode", value: model.connectionMode.label)
                    MetadataRow(title: "User", value: userLabel)
                    MetadataRow(title: "Health", value: healthLabel)
                    MetadataRow(title: "Counts", value: countsLabel)
                    MetadataRow(title: "Overview", value: overviewRefreshLabel)
                    MetadataRow(title: "Snapshot", value: snapshotRefreshLabel)
                }
                .cardStyle()

                if model.isSwitchingSite {
                    LoadingRow(title: "Switching site before building snapshot...")
                } else if model.isLoadingSnapshot {
                    LoadingRow(title: "Building read-only site snapshot...")
                }
                if let error = model.snapshotError {
                    ErrorResultView(message: error)
                }

                ForEach(model.snapshotSections) { section in
                    SnapshotSectionCard(section: section)
                }
            }
            .padding(18)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Site Snapshot")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await model.refreshSnapshot() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(model.isSwitchingSite || model.isLoadingSnapshot)
            }
        }
        .task {
            if !model.hasLoadedSnapshot {
                await model.refreshSnapshot()
            }
        }
    }

    private var userLabel: String {
        guard let user = model.connectionUser else {
            return model.isAuthenticatedHealthMode ? "Not verified yet" : "Not connected"
        }
        let roles = user.roles.isEmpty ? "roles hidden" : user.roles.joined(separator: ", ")
        return "\(user.name) (\(roles))"
    }

    private var healthLabel: String {
        let health = model.healthSummary
        return "\(health.ok) OK / \(health.protected) protected / \(health.errors) errors"
    }

    private var countsLabel: String {
        "\(model.overviewCounts.count(for: .posts)) posts / \(model.overviewCounts.count(for: .pages)) pages / \(model.overviewCounts.count(for: .media)) media"
    }

    private var overviewRefreshLabel: String {
        model.lastOverviewRefresh.map(SnapshotDateFormatter.report.string(from:)) ?? "Not refreshed yet"
    }

    private var snapshotRefreshLabel: String {
        model.lastSnapshotRefresh.map(SnapshotDateFormatter.report.string(from:)) ?? "Not generated yet"
    }
}

private struct SnapshotSectionCard: View {
    let section: SiteSnapshotSection

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                SectionHeader(
                    icon: section.type.icon,
                    title: section.type.title,
                    subtitle: "Read-only summary of public \(section.type.title.lowercased())."
                )
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    StatusPill(title: section.countLabel, tint: .secondary)
                    StatusPill(title: section.loadedLabel, tint: .blue)
                }
            }

            if section.items.isEmpty {
                EmptyStateRow(
                    title: "No \(section.type.title.lowercased()) in snapshot",
                    detail: "Refresh the snapshot after WordPress has public \(section.type.title.lowercased()) to show here."
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(section.items) { item in
                        NavigationLink(value: item) {
                            SnapshotItemSummaryRow(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .cardStyle()
    }
}

private struct SnapshotItemSummaryRow: View {
    let item: WordPressContentItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.type.icon)
                .foregroundStyle(item.type == .media ? .purple : .blue)
                .frame(width: 28, height: 28)
                .background((item.type == .media ? Color.purple : Color.blue).opacity(0.12), in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 5) {
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                HStack {
                    StatusPill(title: item.status, tint: item.status == "publish" ? .green : .secondary)
                    StatusPill(title: item.slugLabel, tint: .secondary)
                }
                Text(summaryDetail)
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

    private var summaryDetail: String {
        var parts = [item.typeLabel]
        if let date = item.date {
            parts.append(ContentDateFormatter.short.string(from: date))
        }
        if item.type == .media, let mimeType = item.mimeType?.nonEmpty {
            parts.append(mimeType)
        }
        return parts.joined(separator: " · ")
    }
}

private struct ContentBrowserCard: View {
    @Bindable var model: AppViewModel

    var body: some View {
        let explorer = model.contentExplorerResult

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
                .disabled(model.isSwitchingSite || model.isLoadingContent)
            }

            Picker("Content type", selection: $model.selectedContentType) {
                ForEach(WordPressContentType.allCases) { type in
                    Label(type.title, systemImage: type.icon).tag(type)
                }
            }
            .pickerStyle(.segmented)
            .disabled(model.isSwitchingSite)
            .onChange(of: model.selectedContentType) {
                Task { await model.loadContent() }
            }

            VStack(alignment: .leading, spacing: 10) {
                TextField("Search title, slug, status", text: $model.contentSearchQuery)
                    .textInputAutocapitalization(.never)
                    .fieldStyle()
                    .disabled(model.isSwitchingSite)

                HStack(spacing: 10) {
                    Menu {
                        Button("All statuses") {
                            model.contentStatusFilter = ContentExplorerFilter.allStatuses
                        }
                        ForEach(model.availableContentStatuses, id: \.self) { status in
                            Button(status) {
                                model.contentStatusFilter = status
                            }
                        }
                    } label: {
                        ExplorerMenuLabel(
                            icon: "line.3.horizontal.decrease.circle",
                            title: "Status",
                            value: model.contentStatusFilterLabel
                        )
                    }

                    Menu {
                        ForEach(ContentSortOption.allCases) { option in
                            Button(option.label) {
                                model.contentSortOption = option
                            }
                        }
                    } label: {
                        ExplorerMenuLabel(
                            icon: "arrow.up.arrow.down.circle",
                            title: "Sort",
                            value: model.contentSortOption.label
                        )
                    }
                }
                .disabled(model.isSwitchingSite)

                if model.contentFilterIsActive {
                    Button {
                        model.resetContentExplorerFilters()
                    } label: {
                        Label("Clear search/filter", systemImage: "xmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(model.isSwitchingSite)
                }
            }

            HStack {
                StatusPill(title: "Read-only", tint: .green)
                if !model.isSwitchingSite, !model.isLoadingContent, model.contentError == nil {
                    StatusPill(title: "\(explorer.totalCount) loaded", tint: .secondary)
                    StatusPill(title: "\(explorer.filteredCount) shown", tint: explorer.isFiltered ? .blue : .secondary)
                }
            }

            if model.isSwitchingSite {
                LoadingRow(title: "Switching site and clearing previous content...")
            } else if model.isLoadingContent {
                LoadingRow(title: "Loading \(model.selectedContentType.title.lowercased())...")
            } else if let error = model.contentError {
                ErrorResultView(message: "Could not load \(model.selectedContentType.title.lowercased()): \(error)")
            } else if model.contentItems.isEmpty {
                EmptyStateRow(
                    title: "No \(model.selectedContentType.title.lowercased()) found",
                    detail: "The endpoint responded, but there is no public content to show."
                )
            } else if model.filteredContentItems.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    EmptyStateRow(
                        title: "No matching content",
                        detail: "Try a different search, status filter, or sort option."
                    )
                    Button {
                        model.resetContentExplorerFilters()
                    } label: {
                        Label("Clear search/filter", systemImage: "xmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
            } else {
                VStack(spacing: 10) {
                    ForEach(model.filteredContentItems) { item in
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

private struct ExplorerMenuLabel: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Image(systemName: "chevron.down")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.tertiary)
        }
        .padding(10)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
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

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    StatusPill(title: model.healthModeTitle, tint: model.isAuthenticatedHealthMode ? .blue : .secondary)
                    StatusPill(title: "\(model.healthSummary.ok) OK", tint: .green)
                }
                HStack {
                    StatusPill(title: "\(model.healthSummary.protected) protected", tint: .blue)
                    StatusPill(title: "\(model.healthSummary.errors) errors", tint: model.healthSummary.errors == 0 ? .secondary : .red)
                }
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
    @State private var copiedMessage: String?

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

                ContentDetailActionsCard(item: item, copiedMessage: $copiedMessage)

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
            }
            .padding(18)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(item.type.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ContentDetailActionsCard: View {
    let item: WordPressContentItem
    @Binding var copiedMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Read-only actions")
                .font(.headline)

            if let link = item.link {
                Link(destination: link) {
                    Label("Open in WordPress", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }

            if let link = item.link {
                copyButton(title: "Copy WordPress link", systemImage: "link", value: link.absoluteString)
            }

            if let slug = item.slug.nonEmpty {
                copyButton(title: "Copy slug", systemImage: "number", value: slug)
            }

            if item.type == .media, let mediaURL = item.mediaURL {
                copyButton(title: "Copy media source URL", systemImage: "photo", value: mediaURL.absoluteString)
            }

            if let copiedMessage {
                NoticeResultView(message: copiedMessage)
            }
        }
        .cardStyle()
    }

    private func copyButton(title: String, systemImage: String, value: String) -> some View {
        Button {
            UIPasteboard.general.string = value
            copiedMessage = "\(title.replacingOccurrences(of: "Copy ", with: "")) copied."
        } label: {
            Label(title, systemImage: systemImage)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
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
