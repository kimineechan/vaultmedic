# VaultMedic threat model

Last reviewed: 2026-08-27

VaultMedic is intended for a person using a device they control to inspect a temporary plaintext password export and manually improve account security. This document describes the MVP’s boundaries; it is not a claim that the application or the host computer is invulnerable.

## Security goals

VaultMedic aims to:

1. Keep imported passwords on the local device.
2. Avoid sending complete passwords or complete hashes to breach-checking services.
3. Prevent bulk plaintext credentials from crossing into the renderer process.
4. Keep credentials out of telemetry, analytics, logs, crash reporting, and password-free reports.
5. Require an explicit user action before revealing, copying, opening a site, checking a breach, moving a source file, or exporting credentials.
6. Make plaintext-file risk and application limitations visible in the UI.

## Protected assets

- Imported password values
- Generated or manually staged replacement passwords
- Usernames, account URLs, and notes
- Rotation checklist progress
- Original and generated export files

Passwords are the highest-sensitivity asset. Usernames, sites, notes, and reports are also personal data even when no passwords are present.

## Trust boundaries

### Host operating system

The operating system, Electron runtime, and installed VaultMedic package are trusted. VaultMedic cannot protect secrets from a compromised kernel, administrator, malware, a keylogger, screen-capture software, malicious accessibility tooling, memory inspection by a privileged process, or another user who can read the source CSV.

### Main process

The main process is trusted with plaintext passwords. It owns the native file picker, parsing, password analysis, in-memory secret store, HIBP hashing and lookup, clipboard expiry, external-link validation, and exports.

### Renderer

The renderer is treated as less trusted. It is sandboxed, has no Node.js integration, and communicates through a narrow preload API. Bulk imported secrets and source paths are not returned to it. A single current or staged password can enter renderer memory only after an explicit reveal or generation action.

### Pwned Passwords

The Pwned Passwords service and intervening network are not trusted with the complete password or complete hash. VaultMedic sends only the first five characters of a locally computed SHA-1 hash to the fixed HTTPS range endpoint and asks for response padding. Returned suffixes are compared locally. A network observer can still learn that the app queried a particular five-character prefix and can observe timing; padding reduces response-size leakage but does not make the request unlinkable.

### External websites

Websites open in the user’s normal browser, not inside VaultMedic. VaultMedic constructs the W3C `/.well-known/change-password` route for valid origins and validates that links are HTTPS and contain no embedded username or password. Sites may not implement the route correctly, may redirect elsewhere, or may themselves be compromised.

## Data lifecycle

### Import

- File selection uses the native desktop picker.
- The file is limited to 25 MB and 20,000 records.
- NUL-containing and unexpectedly large records are rejected.
- The raw byte buffer is overwritten after parsing.
- Parsed secrets remain in main-process memory for the session.

Overwriting a Node.js buffer is a best-effort measure. JavaScript strings may be copied by the runtime, and garbage collection does not offer a forensic erasure guarantee.

### Analysis

- Weakness checks use local `zxcvbn-ts` dictionaries and heuristics.
- Reuse groups use in-memory SHA-256 fingerprints. Those fingerprints are not exported or persisted.
- Password-analysis results contain labels and scores, not the password.

### Display and clipboard

- Passwords are masked by default.
- Explicitly revealed passwords hide after ten seconds in the current renderer component.
- Explicitly copied passwords are cleared after 45 seconds only if the clipboard still contains the same value.
- Clipboard managers or other software may retain or read copied values before they clear.

### Export

- Password-manager CSV export is an explicit action and is plaintext by necessity.
- The export can contain staged replacements only or include unchanged imported credentials.
- Owner-only POSIX permissions are requested where available.
- Password-free JSON reports exclude imported and staged passwords, notes, and source paths. They include account identifiers and should still be treated as private.

### Session end

- “Lock & clear” replaces stored password and note fields, drops session references, and clears the HIBP response cache.
- Closing the final app window performs the same operation.
- Runtime copies and operating-system paging remain outside guaranteed erasure.

## Network policy

Production renderer requests are limited to local `file:`, `data:`, and `blob:` resources. The session network policy permits the fixed `https://api.pwnedpasswords.com/range/` endpoint for main-process checks. The renderer Content Security Policy sets `connect-src 'none'`.

The application has no telemetry, analytics, advertising, remote configuration, cloud account, sync, or automatic-update implementation in this MVP.

## Out of scope

- Automatic password rotation across arbitrary sites
- Defending a compromised host or Electron installation
- Preventing a user from exporting or revealing data they explicitly request
- Guaranteed secure deletion on SSDs, journaled filesystems, backups, swap, hibernation, or a garbage-collected heap
- Detecting phishing pages opened outside VaultMedic
- Verifying every site’s MFA or passkey availability in real time
- Recovering accounts or bypassing CAPTCHAs, MFA, lockouts, or security controls
- Serving as a password manager or long-term secret store

## Abuse and failure cases

| Case | Mitigation | Remaining risk |
| --- | --- | --- |
| Malformed or huge CSV | Size, row, record, and NUL limits | Parser or runtime vulnerabilities |
| Compromised renderer | Sandbox, context isolation, narrow IPC, no bulk secrets | Explicitly revealed/generated secret may be exposed |
| Renderer network exfiltration | CSP plus session allowlist | A future allowed destination could expand the boundary |
| HIBP traffic analysis | TLS, five-character prefix, padded responses, manual checks | Prefix and timing metadata remain observable |
| Clipboard snooping | Explicit action and conditional 45-second clear | Other apps can read or retain the value first |
| Dangerous external URL | HTTPS-only parser, rejects embedded credentials | Destination can redirect or be malicious |
| Plaintext export left behind | Prominent warnings and recoverable Trash action | User or backups may retain copies |
| Credential logging | No logger/telemetry and sanitized error messages | Runtime, OS, or third-party crash tooling outside the app |

## Verification

`npm test` includes automated checks for:

- HIBP prefix-only request construction and padded headers
- sanitized snapshots and password-free reports
- password generator constraints and randomness-source invariants
- CSV rejection limits
- renderer sandbox and Content Security Policy settings
- blocked navigation, popups, and permission requests
- standard change-password URL construction and external URL checks

CI also runs TypeScript checks, a production build, production dependency auditing, and CodeQL. These controls reduce risk; they do not replace independent security review.
