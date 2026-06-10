# LarsenEvans-wpBOX iOS MVP

Clean SwiftUI client for the wpBOX WordPress control center.

## Scope

- Native SwiftUI app shell.
- Read-only WordPress REST health checks.
- Safe `/wp/v2/users/me?context=edit` Application Password test.
- Keychain storage for validated WordPress credentials.
- Read-only content browser for posts, pages, and media.
- Capability map for public, authenticated, server-edge, and locked actions.
- No SSH, no WP-CLI, no theme upload, no plugin activation, no production writes.

## Local target

- Default WordPress URL: `http://localhost:18090`
- Bundle ID: `sk.larsenevans.wpbox.erik`
- Minimum iOS target: iOS 18.0

## Open

Open `LarsenEvansWpBox.xcodeproj` in Xcode or build the `LarsenEvansWpBox` scheme for an iOS simulator.

## Tests

The `LarsenEvansWpBoxTests` target covers URL safety, HTTPS credential guards, and REST health status mapping.

## Install on iPhone with a free Apple ID

1. Connect the iPhone by cable and trust the Mac.
2. Enable Developer Mode on the iPhone in Settings > Privacy & Security > Developer Mode.
3. Open `LarsenEvansWpBox.xcodeproj` in Xcode.
4. Select the physical iPhone as the run destination.
5. In Signing & Capabilities, choose your personal Apple ID team.
6. Run with Cmd+R.

Free provisioning works for local testing, but the installed app expires after roughly 7 days and must be rebuilt from Xcode.

For physical iPhone testing, `localhost` means the iPhone itself. Use a local HTTPS tunnel or a LAN-accessible HTTPS WordPress URL before testing Application Password credentials from a real device.
