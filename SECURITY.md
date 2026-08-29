# Security policy

## Supported versions

Until the first stable release, security fixes are made on the latest `main` branch and the newest tagged prerelease only.

## Report a vulnerability

Please use the repository’s **Security → Report a vulnerability** flow to open a private GitHub Security Advisory. Do not include real passwords, browser exports, API keys, personal vault data, or proof-of-concept data belonging to anyone else.

Include:

- affected version or commit;
- operating system and architecture;
- concise reproduction steps using fictional credentials;
- security impact and which trust boundary is crossed;
- suggested mitigation, if known.

Please do not open a public issue for a suspected credential disclosure or sandbox escape. Maintainers should acknowledge a complete report within seven days, provide a status update within fourteen days, and coordinate disclosure after a fix is available.

## Security-sensitive contribution rules

- Never log credentials, password fields, clipboard values, full password hashes, HIBP response bodies, or CSV contents.
- Do not add a renderer network destination without updating the threat model, CSP, session allowlist, and security tests.
- Do not expose filesystem paths or bulk secrets through the preload bridge.
- New export formats must be explicit and accurately labeled as plaintext or password-free.
- Dependencies that process secrets or cross a process boundary require focused review.
- Security behavior changes require tests.
