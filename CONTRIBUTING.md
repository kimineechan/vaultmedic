# Contributing to VaultMedic

Thanks for helping make password rotation less intimidating and more honest.

## Before you start

Read [THREAT_MODEL.md](THREAT_MODEL.md), [SECURITY.md](SECURITY.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Changes that make the app more convenient must not silently broaden its trust boundary.

Use only fictional credentials in tests, screenshots, issues, and pull requests. Never attach a real browser export.

## Development

```bash
npm ci
npm run dev
```

Before opening a pull request:

```bash
npm run check
```

## Pull requests

Explain:

- the user problem being solved;
- any data that newly enters a process, file, clipboard, or network request;
- changes to preload IPC or external destinations;
- security tests added or updated;
- user-visible changes to the threat model or export warnings.

Keep dependencies small and justified. Prefer platform APIs and existing modules over new packages, particularly in the main process.

## Product language

Do not claim that VaultMedic automatically changes passwords on arbitrary websites. Use “assist,” “open,” “guide,” “stage,” or “track” unless the application actually performs and verifies an action.

Do not describe a password as “safe” solely because it was absent from Pwned Passwords. “Not found” is accurate; “not compromised” is not provable.
