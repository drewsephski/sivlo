# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

If you discover a security issue in Sivlo, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email **security@sivlo.app** (or open a private security advisory on GitHub if email is unavailable).
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if any)

We aim to acknowledge reports within **48 hours** and provide a status update within **7 days**.

## Scope

In scope:

- The Sivlo Tauri desktop application (`frontend/src-tauri`)
- The Sivlo Next.js UI bundled in the desktop app (`frontend/src`)
- Release artifacts published to [drewsephski/sivlo](https://github.com/drewsephski/sivlo/releases)

Out of scope:

- The archived Python/FastAPI backend under `backend/` (unsupported legacy code)
- Third-party cloud AI providers you configure (Claude, Groq, OpenRouter, etc.)
- Social engineering attacks

## Security practices

- API keys are stored in the OS credential store (macOS Keychain), not plaintext in SQLite
- Analytics are opt-in and default-off; meeting content is never an analytics payload
- macOS releases are code-signed and notarized
- Dependencies are monitored via Dependabot

## Disclosure policy

We follow coordinated disclosure. We will credit reporters who wish to be acknowledged in the changelog, unless they prefer to remain anonymous.
