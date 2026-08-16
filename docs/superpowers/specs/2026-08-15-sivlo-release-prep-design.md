# Sivlo v0.1.0 Public Beta Release Design

- **Status:** Approved design
- **Date:** 2026-08-15

## 1. Product / Distribution Decisions

- **Product:** Sivlo
- **First public release:** v0.1.0
- **Release positioning:** Public Beta

Do **NOT** display "Beta" in the application name, window title, or normal app UI. The beta label exists only in release/download messaging.

**Distribution:**

- Direct-download signed and notarized macOS DMGs.
- No Mac App Store for v0.1.0.

**Minimum supported OS:** macOS 13 Ventura.

**Architectures:**

- Apple Silicon / arm64
- Intel / x86_64

Ship separate binaries/DMGs. Do **NOT** build a universal binary for v0.1.0.

## 2. Source + Release Repositories

**Source repository:** Private.

**Release repository:** Public — `drewsephski/sivlo-releases`.

The public repository contains no application source code. It exists only for:

- GitHub Releases
- DMG downloads
- Tauri updater artifacts
- updater signatures
- `latest.json`
- release notes
- a minimal README explaining that it hosts official Sivlo binaries

The website can link directly to release assets, but users should not need to interact with the release repository directly.

## 3. Release Trigger

Production releases are tag-driven.

- **Tag pattern:** `v*`
- **First release:** `v0.1.0`

**Normal release flow:**

```
feature work
→ merge to main
→ verify main
→ bump version
→ push release tag
→ GitHub Actions builds/releases
```

No permanent release branch is needed for the beta phase. `main` is the releasable branch.

## 4. Release Pipeline Architecture

Use **one** GitHub Actions workflow in the **private** source repository.

A version tag triggers two independent macOS build jobs:

- **A. Apple Silicon** — Target: `aarch64-apple-darwin`
- **B. Intel** — Target: `x86_64-apple-darwin`

Each build job performs:

```
checkout
→ install dependencies
→ install Rust target/toolchain requirements
→ frontend tests
→ Rust tests
→ frontend production build
→ Tauri bundle
→ Developer ID signing
→ Apple notarization
→ notarization validation/stapling where appropriate
→ Tauri updater artifact generation
→ Tauri updater signing
→ architecture/signature/version validation
→ upload private GitHub Actions artifacts
```

**Nothing is published if either architecture fails.** A final publish job runs only after BOTH architecture jobs succeed.

## 5. Published Artifacts

**Conceptual public release assets:**

```
Sivlo_0.1.0_aarch64.dmg
Sivlo_0.1.0_x86_64.dmg

Sivlo_0.1.0_aarch64.app.tar.gz
Sivlo_0.1.0_aarch64.app.tar.gz.sig

Sivlo_0.1.0_x86_64.app.tar.gz
Sivlo_0.1.0_x86_64.app.tar.gz.sig

latest.json
```

Exact filenames may follow Tauri's actual generated naming where required, but the architecture and version must remain obvious and deterministic.

**Release title:** `Sivlo 0.1.0 Public Beta`

## 6. Version Consistency

Before expensive release work begins, CI must validate that release versions agree. At minimum compare:

| Source | Example |
| --- | --- |
| Git tag | `v0.1.0` |
| Tauri application version | `0.1.0` |
| frontend/package version (if applicable to this repository) | `0.1.0` |

If versions disagree: **fail immediately.** Do not publish mismatched builds.

## 7. Production Application Identity

- **Production bundle identifier:** `com.drewsepeczi.sivlo`
- **Application name:** `Sivlo`

The current Meetily-derived production identity must be audited.

For v0.1.0, Sivlo is treated as a **NEW application**. There is **NO** Meetily-to-Sivlo data migration.

Do **NOT** retain `com.meetily.ai` as the production bundle identifier.

## 8. Local Data Policy

**Approved behavior:** Start clean.

Sivlo creates its own new application data/storage. Existing Meetily-era data must **NOT** be:

- deleted
- overwritten
- moved
- silently migrated
- renamed in place

Old development/Meetily data remains untouched and ignored by the new Sivlo installation.

Audit active production paths such as:

- Application Support
- databases
- recordings
- caches
- preferences
- recovery storage
- IndexedDB/browser storage where applicable

New active storage should use Sivlo identity. Examples conceptually:

```
Sivlo
Sivlo-recordings
SivloRecoveryDB
```

Legacy-import functionality may intentionally retain Meetily paths when its explicit purpose is detecting old installations. **Classify** those references rather than blindly replacing them.

## 9. Apple Code Signing

Direct-download releases must use **Developer ID Application** signing.

- The certificate/private key must **NOT** be committed.
- CI should import the certificate into a temporary keychain.

**Conceptual GitHub Actions secrets:**

```
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
KEYCHAIN_PASSWORD
```

The exact encoding/secret mechanism should follow current Tauri/macOS CI best practices during implementation.

## 10. Apple Notarization

Use an **App Store Connect TEAM API key**. Do **NOT** use Apple ID + app-specific password.

**Conceptual secrets:**

```
APPLE_API_ISSUER
APPLE_API_KEY
APPLE_API_PRIVATE_KEY
```

The `.p8` key must exist only transiently during CI execution. It must never be committed or uploaded to the public release repository.

## 11. Tauri Updater Signing

Generate a **NEW** Sivlo-specific Tauri updater keypair. This is separate from Apple Developer signing.

- **Public key:** embedded in Sivlo's production updater configuration.
- **Private key:** GitHub Actions secret + secure offline backup.

**Conceptual secrets:**

```
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

Never commit the updater private key. Updater signature verification must remain **mandatory**.

## 12. Public Update Feed

Automatic updates are included in v0.1.0. The update feed is hosted through `drewsephski/sivlo-releases`.

Use Tauri-compatible static updater metadata. `latest.json` must describe **both**:

- `darwin-aarch64`
- `darwin-x86_64`

Each platform entry includes:

- updater artifact URL
- generated Tauri signature **CONTENT** (not merely a link to the `.sig` file)

The release repository may also expose `.sig` files as assets.

## 13. Update UX

Sivlo checks for updates automatically. Updates must **NOT** install silently.

When a newer version is available, show restrained UI conceptually like:

```
Sivlo 0.1.1 is available

[Later]
[Update & Restart]
```

User approval is required before installing.

**Flow:**

```
launch
→ check update feed
→ newer valid version found
→ show update prompt
→ user approves
→ download
→ signature verification
→ install
→ restart
```

**Failures must be non-blocking.** If:

- network unavailable
- GitHub unavailable
- `latest.json` invalid
- updater signature invalid
- update download fails

then: continue running the currently installed Sivlo version. Recording and normal app usage must remain available. **No forced updates in v0.1.0.**

## 14. Release-Repo Authentication

The private source repository publishes to the public release repository using a **fine-grained GitHub PAT**.

**Conceptual secret:**

```
SIVLO_RELEASES_PAT
```

Scope the PAT only to `drewsephski/sivlo-releases`. Grant only permissions necessary to create/update releases and upload release assets. Do not use a broad classic PAT if avoidable.

## 15. Secrets Boundary

These must **NEVER** enter the public release repository:

- Developer ID private certificate
- certificate password
- keychain password
- App Store Connect `.p8` private key
- Tauri updater private key
- updater private-key password
- GitHub publishing PAT

The public repository may contain **ONLY** public/distributable material such as:

- DMGs
- updater archives
- updater signatures
- `latest.json`
- release notes
- README
- other non-secret release metadata

## 16. Analytics / Privacy

No inherited upstream Meetily telemetry may ship **active** in the production Sivlo beta.

**Analytics policy:** explicit opt-in, **default OFF**.

Before consent: **ZERO** analytics events should leave the app.

**Audit:**

- PostHog
- analytics commands
- hardcoded upstream project keys
- user identifiers
- network calls
- crash/debug reporting

**Meeting content must never be an analytics payload.** Specifically protect:

- audio
- transcripts
- summaries
- notes
- meeting titles

If no Sivlo-owned analytics infrastructure is ready for v0.1.0: ship analytics **disabled entirely**. Do not block the release on analytics.

## 17. Release Validation Gate

Before publication, verify each artifact. At minimum:

- frontend tests pass
- Rust tests pass
- frontend production build succeeds
- expected architecture
- expected version
- expected bundle ID: `com.drewsepeczi.sivlo`
- Developer ID code signature valid
- notarization accepted
- Gatekeeper validation succeeds
- updater archive exists
- updater signature exists
- `latest.json` parses correctly
- `latest.json` contains both architectures
- updater signatures correspond to artifacts
- artifact filenames/version are correct
- no obvious secret material included

**Fail closed.** Any failed validation means **NO public release**.

## 18. Publication Atomicity

Both architecture builds must succeed before release publication. Do not intentionally publish only the arm64 release while Intel failed for a release advertised as supporting both.

Build jobs may retain private CI artifacts for debugging. Public release occurs only from the final successful aggregation/publish job.

## 19. Failure Policy

| Failure | Result |
| --- | --- |
| tests fail | no release |
| Apple signing fails | no release |
| notarization fails | no release |
| Intel build fails | no release |
| arm64 build fails | no release |
| updater signing fails | no release |
| `latest.json` invalid | no release |
| public-release upload fails | binaries remain only in private CI artifacts |

## 20. Post-Publish Smoke Test

Do **NOT** immediately promote the download publicly just because CI passes. After publishing v0.1.0, manually download the **PUBLIC** DMG and test it like an actual user.

**Apple Silicon smoke test:**

```
download DMG
→ open
→ install Sivlo
→ launch from Finder
→ confirm Gatekeeper accepts it
→ grant microphone permissions
→ record a meeting
→ stop
→ transcription
→ summary
→ AI meeting title
→ Actions / Decisions
→ Notes save/reopen
→ search
→ quit
→ relaunch
→ confirm meetings persist
```

Also inspect:

- Dock icon
- Cmd+Tab icon
- menu-bar/tray icon
- About screen
- application version
- Sivlo bundle identity
- no visible Meetily branding

## 21. Intel Validation

CI builds the Intel binary.

- If physical Intel hardware is available: perform a real smoke test.
- If no Intel hardware is available: ship it as part of the beta if CI validation succeeds, but document internally that Intel runtime verification is still pending.

Do not pretend physical Intel runtime validation happened if it did not.

## 22. Updater End-to-End Test

Before relying on updater behavior publicly, validate a real production-style upgrade.

**Recommended test:**

```
create signed/notarized v0.0.9 prerelease
→ install v0.0.9
→ publish v0.1.0
→ launch v0.0.9
→ update detected
→ choose Update & Restart
→ updater signature verifies
→ Sivlo becomes v0.1.0
→ existing Sivlo data remains intact
```

This validates the REAL:

- public update endpoint
- release metadata
- updater artifact URLs
- updater signatures
- installation behavior
- restart
- persistence

The v0.0.9 test release may remain a prerelease or be removed later as appropriate.

## 23. Release Immutability / Rollback

Never replace a published production binary with another binary using the same version.

**Example:**

```
bad v0.1.1
→ fix
→ publish v0.1.2
```

NOT:

```
bad v0.1.1
→ secretly replace v0.1.1 artifact
```

Every released version is **immutable**.

**Rollback strategy for beta:** publish a fixed higher version. Do not build a complex rollback infrastructure for v0.1.0.

## 24. Release Repo README

The public release repository should remain minimal.

README should communicate:

- this repository hosts official Sivlo application releases
- it contains binaries/update metadata rather than the private source repository
- users should obtain Sivlo through the official Sivlo download surface

Do not expose implementation/private-repo information unnecessarily.

## 25. Non-Goals

Explicitly **OUT OF SCOPE** for this release-prep project:

- Mac App Store distribution
- Windows public release
- Linux public release
- universal macOS binary
- forced automatic updates
- silent updates
- complex rollback infrastructure
- Meetily data migration
- deleting Meetily user data
- analytics platform implementation if Sivlo analytics is not ready
- new meeting/product features
- redesigning Sivlo UI
- changing AI meeting-title behavior
- changing recording/transcription architecture
- unrelated bulk-delete functionality

## 26. Implementation Phases

Implementation should proceed in isolated phases so failures are easy to reason about.

- **Phase 1** — Production identity + clean storage
- **Phase 2** — Privacy/network/analytics audit
- **Phase 3** — Tauri updater ownership + key configuration
- **Phase 4** — macOS Developer ID signing/notarization configuration
- **Phase 5** — private GitHub Actions architecture matrix
- **Phase 6** — public `sivlo-releases` publishing
- **Phase 7** — `latest.json`/update-feed generation
- **Phase 8** — release validation gates
- **Phase 9** — v0.0.9 → v0.1.0 updater dress rehearsal
- **Phase 10** — v0.1.0 public-beta smoke test
