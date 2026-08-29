# Privacy

VaultMedic is a local desktop application. It has no user accounts, telemetry, analytics, advertising, or cloud sync.

## Data the app processes

When you explicitly select a browser password export, VaultMedic reads account names, URLs, usernames, passwords, and supported note fields into the local desktop process. It uses them to calculate password-health findings and build your rotation checklist.

The app does not upload the selected file or imported password values.

## Network requests

VaultMedic makes no network request until you start a compromised-password check. For each unique password in the current session, it:

1. computes SHA-1 locally;
2. sends the first five hexadecimal hash characters to `https://api.pwnedpasswords.com/range/`;
3. requests a padded response;
4. compares returned suffixes locally.

The complete password and complete hash are not sent. The service and network may observe your IP address, request time, and five-character prefix. Refer to Have I Been Pwned’s own policies for its handling of service metadata.

Opening a website or change-password link launches your normal browser. Your browser and the destination site then apply their own privacy policies.

## Files the app writes

VaultMedic writes a file only after you choose an export action and destination:

- A password-manager CSV contains readable passwords.
- A JSON security report excludes passwords but includes websites and usernames.

The app does not silently persist the active vault or checklist. The original browser export remains where you created it unless you explicitly use “Move source to Trash.”

## Logs

VaultMedic does not implement application analytics, credential logging, or remote crash reporting. Contributors must never add logging of IPC arguments, CSV records, passwords, replacement values, clipboard contents, complete password hashes, HIBP response bodies, or password-manager exports.

## Your responsibilities

Use VaultMedic only on a device you trust. Import the final CSV into a password manager, verify the result, and delete plaintext exports. Avoid copying secrets when untrusted clipboard software is running. Close or lock VaultMedic when finished.
