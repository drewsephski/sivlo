# Changelog

All notable changes to Sivlo are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.1] - 2026-08-18

### Added

- PR CI workflow, Dependabot, `SECURITY.md`, production smoke tests, and E2E scaffold
- Secure API key storage in OS credential store (Keychain) with legacy SQLite migration
- React error boundary and production `console.log` stripping

### Changed

- README, privacy policy, and landing page aligned to Sivlo branding and macOS-only beta scope
- Version strings unified across app, analytics, and marketing surfaces

### Removed

- Legacy `lib_old_complex.rs`, incomplete `audio_v2/` modules, and committed build tooling binary

## [0.1.0] - 2026-08-18

### Added

- Sivlo branding and macOS public beta release pipeline (signed, notarized DMGs)
- Landing page at `landing/`
- Opt-in analytics with allowlist sanitization (default off)
- Auto-update support via Tauri updater
- Secure API key storage in macOS Keychain (migrates legacy plaintext keys on read)
- React error boundary for graceful crash recovery
- PR CI workflow (frontend tests, lint, build; Rust tests)
- Dependabot for npm, Cargo, and GitHub Actions
- `SECURITY.md` and `CHANGELOG.md`

### Changed

- Rebranded from Meetily to Sivlo across app, docs, and privacy policy
- Production builds strip `console.log` / `console.debug` (warn/error retained)
- Version strings aligned to 0.1.0 across app, analytics, and landing page

### Removed

- Legacy `lib_old_complex.rs`, `audio_v2/` incomplete modules, and backup files
- Committed `vs_buildtools.exe` binary from repository

### Security

- API keys no longer stored in plaintext SQLite columns
- Archived backend directory clearly marked as unsupported

[0.1.1]: https://github.com/drewsephski/sivlo/releases/tag/v0.1.1
[0.1.0]: https://github.com/drewsephski/sivlo/releases/tag/v0.1.0
