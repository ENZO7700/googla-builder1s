import Foundation
import Security

struct KeychainCredentialStore {
    enum StoreError: LocalizedError {
        case encodeFailed
        case decodeFailed
        case keychain(OSStatus)

        var errorDescription: String? {
            switch self {
            case .encodeFailed:
                "Connection could not be prepared for secure storage."
            case .decodeFailed:
                "Saved connection could not be read. Forget it and connect again."
            case .keychain(let status):
                "Keychain error \(status)."
            }
        }
    }

    private let service = "sk.larsenevans.wpbox.wordpress-connection"
    private let legacyAccount = "default"

    static func isMissingEntitlement(_ error: Error) -> Bool {
        guard case StoreError.keychain(let status) = error else { return false }
        return status == errSecMissingEntitlement
    }

    func load() throws -> WordPressConnection? {
        try load(account: legacyAccount)
    }

    func load(for profile: SiteProfile) throws -> WordPressConnection? {
        try load(account: profile.id)
    }

    func save(_ connection: WordPressConnection) throws {
        try save(connection, account: legacyAccount)
    }

    func save(_ connection: WordPressConnection, for profile: SiteProfile) throws {
        try save(connection, account: profile.id)
    }

    func clear() throws {
        try clear(account: legacyAccount)
    }

    func clear(for profile: SiteProfile) throws {
        try clear(account: profile.id)
    }

    private func load(account: String) throws -> WordPressConnection? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw StoreError.keychain(status)
        }
        guard let data = item as? Data else {
            throw StoreError.decodeFailed
        }
        do {
            return try JSONDecoder().decode(WordPressConnection.self, from: data)
        } catch {
            throw StoreError.decodeFailed
        }
    }

    private func save(_ connection: WordPressConnection, account: String) throws {
        guard let data = try? JSONEncoder().encode(connection) else {
            throw StoreError.encodeFailed
        }

        var query = baseQuery(account: account)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw StoreError.keychain(updateStatus)
        }

        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let addStatus = SecItemAdd(query as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw StoreError.keychain(addStatus)
        }
    }

    private func clear(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw StoreError.keychain(status)
        }
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
