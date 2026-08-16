# Sivlo macOS CI Build Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate reproducible signed, notarized, updater-signed Sivlo macOS builds for Apple Silicon and Intel inside the private source repository.

**Architecture:** A GitHub Actions matrix builds each architecture independently on an appropriate macOS runner. Each job imports the Developer ID certificate into a temporary keychain, provides App Store Connect API credentials for notarization, provides the Sivlo updater signing key, validates the resulting artifacts, and uploads them only as private workflow artifacts. Public release publication remains a later phase.

**Tech Stack:** GitHub Actions, Tauri 2, Rust, pnpm, macOS codesign, Apple notarytool, Developer ID Application signing, Tauri updater signing.

## Global Constraints

- Source repository remains private.
- Public release repository is `drewsephski/sivlo-releases`.
- Phase 5 must NOT publish to that repository.
- Architectures: `aarch64-apple-darwin` and `x86_64-apple-darwin`.
- Minimum macOS: 13.0.
- Developer ID Team ID: `2NHJGX6A7S`.
- Bundle ID: `com.drewsepeczi.sivlo`.
- Developer ID Application certificate is required.
- Notarization uses a TEAM App Store Connect API key.
- Tauri updater signing remains separate from Apple signing.
- No secret values may be committed.
- CI jobs must fail closed.
- Both architecture jobs must be independently verifiable.
- No release publishing, latest.json, or production tags in Phase 5.

---

## File Map

| File | Action | Notes |
|------|--------|-------|
| `.github/workflows/sivlo-ci.yml` | **CREATE** | New Phase 5 workflow |
| `.github/workflows/build-macos.yml` | DO NOT MODIFY | Legacy Meetily workflow; left intact |
| `.github/workflows/build.yml` | DO NOT MODIFY | Legacy reusable workflow; left intact |
| `.github/workflows/build-devtest.yml` | DO NOT MODIFY | Legacy DevTest workflow; left intact |
| `.github/workflows/release.yml` | DO NOT MODIFY | Legacy release workflow; left intact |
| `frontend/src-tauri/tauri.conf.json` | DO NOT MODIFY | `createUpdaterArtifacts: false` base config preserved |

---

## Existing Workflow Audit

| File | Classification | Recommendation |
|------|---------------|----------------|
| `.github/workflows/build-macos.yml` | `LEGACY_MEETILY` | REPLACE — only arm64, Apple ID auth, Meetily artifact names, Meetily secrets (`MEETILY_RSA_PUBLIC_KEY`, `SUPABASE_*`) |
| `.github/workflows/build.yml` | `LEGACY_MEETILY` | REPLACE — reusable workflow with Apple ID auth, Meetily secrets, `asset-prefix: meetily` |
| `.github/workflows/build-devtest.yml` | `LEGACY_MEETILY` | REPLACE — multi-platform test with Apple ID auth, Meetily secrets |
| `.github/workflows/release.yml` | `LEGACY_MEETILY` | REPLACE — Meetily release flow, Apple ID auth, `Meetily v` release title, S3 reference |
| `.github/workflows/build-test.yml` | `LEGACY_MEETILY` | REPLACE — calls build.yml with Meetily asset prefix |
| `.github/workflows/build-linux.yml` | `UNRELATED` | No macOS action |
| `.github/workflows/build-windows.yml` | `UNRELATED` | No macOS action |
| `.github/workflows/pr-main-check.yml` | `UNRELATED` | No build action |
| `.github/workflows/ACCELERATION_GUIDE.md` | `UNRELATED` | Documentation |
| `.github/workflows/README_DEVTEST.md` | `UNRELATED` | Documentation |
| `.github/workflows/WORKFLOWS_OVERVIEW.md` | `UNRELATED` | Documentation |

**Strategy:** Create a new, clearly-named `sivlo-ci.yml` rather than heavily mutating legacy upstream workflows. This produces a safer migration path and avoids disturbing unrelated user work. Legacy workflows remain available for reference.

### Legacy Workflow Audit Details

| Issue | `build-macos.yml` | `build.yml` | `build-devtest.yml` |
|-------|------------------|-------------|-------------------|
| Meetily branding | artifact prefix `meetily-*` | `asset-prefix: meetily` | artifact prefix `meetily-devtest-*` |
| Meetily secrets | `MEETILY_RSA_PUBLIC_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | same | same |
| Apple ID auth | `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | same | same |
| Team API key auth | Not used | Not used | Not used |
| Updater signing | `TAURI_SIGNING_PRIVATE_KEY` present | present | present |
| Intel macOS build | Not present | Not present | Not present |
| `contents: write` | Set (overprivileged) | Set (overprivileged) | Set (overprivileged) |
| `createUpdaterArtifacts` | `true` hardcoded | `true` hardcoded | `true` hardcoded |
| Runner label | `macos-latest` (arm64 only) | Parameterized | `macos-latest` (arm64 only) |

---

## GitHub-Hosted Runner Architecture

**Source:** GitHub-hosted runners reference (docs.github.com), verified August 2026.

### Available macOS Runners for Private Repositories

| Label | Architecture | CPU | RAM | SSD | Notes |
|-------|-------------|-----|-----|-----|-------|
| `macos-latest` | arm64 (Apple Silicon) | 3 cores (M1) | 7 GB | 14 GB | Current default; resolves to `macos-26` |
| `macos-15` | arm64 (Apple Silicon) | 3 cores (M1) | 7 GB | 14 GB | macOS 15 Sequoia |
| `macos-26` | arm64 (Apple Silicon) | 3 cores (M1) | 7 GB | 14 GB | macOS 26; current GA |
| `macos-15-intel` | x86_64 (Intel) | 4 cores | 14 GB | 14 GB | Last Intel label; supported until August 2027 |
| `macos-26-intel` | x86_64 (Intel) | 4 cores | 14 GB | 14 GB | macOS 26 Intel; current GA |

### Recommended Labels

| Architecture | Label | Rationale |
|-------------|-------|-----------|
| Apple Silicon (aarch64) | `macos-15` | Stable macOS Sequoia image; avoids bleeding-edge `macos-26` for first CI pass |
| Intel (x86_64) | `macos-15-intel` | Stable Intel runner; `macos-26-intel` also available but `15` is safer for initial validation |

**Key constraint for Intel:** `macos-15-intel` is the **last** Intel runner GitHub will provide. It is supported until August 2027. This is sufficient for v0.1.0 but should be noted in the project's long-term planning.

**Private repo availability:** Both arm64 and Intel labels are available on private repositories using the account's free minute allotment. No special configuration is needed beyond having GitHub Actions enabled.

**Cross-compilation note:** Both jobs build natively on their respective architectures. No cross-compilation is required. Each runner is the correct architecture for its target triple.

---

## Sidecar Build Audit

### Current State

| Sidecar | Path in repo | Architectures present |
|---------|-------------|---------------------|
| `llama-helper` | `frontend/src-tauri/binaries/llama-helper-aarch64-apple-darwin` | aarch64 only (1 binary, 4.8 MB) |
| `ffmpeg` | `frontend/src-tauri/binaries/ffmpeg-aarch64-apple-darwin` | aarch64 only (1 binary, 49 MB) |

### CI Requirements

| Sidecar | aarch64 | x86_64 | CI action |
|---------|---------|--------|-----------|
| `llama-helper` | Pre-built in repo | Must build from source | `cargo build --release -p llama-helper --target x86_64-apple-darwin --features metal` |
| `ffmpeg` | Pre-built in repo (or download) | Build script downloads | `build/ffmpeg.rs` handles download for any target |

### `llama-helper` x86_64 Build Plan

The `llama-helper` sidecar is built from a workspace crate. The build command for x86_64:

```bash
cargo build --release -p llama-helper \
  --target x86_64-apple-darwin \
  --features metal
```

The binary must be placed at:
```
frontend/src-tauri/binaries/llama-helper-x86_64-apple-darwin
```

Tauri expects sidecar binaries named `llama-helper-<target-triple>` in the `binaries/` directory. The naming convention matches what `build.rs` and `tauri.conf.json` expect.

### `ffmpeg` x86_64 Build Plan

The `build/ffmpeg.rs` script automatically downloads the correct architecture-specific binary during `cargo build`:

- `aarch64-apple-darwin` → downloads `ffmpeg80arm.zip` from `Zackriya-Solutions/ffmpeg-binaries`
- `x86_64-apple-darwin` → downloads `ffmpeg-8.0.1.zip` from `Zackriya-Solutions/ffmpeg-binaries`

The script is already target-aware via the `TARGET` environment variable. **No modification is needed.** When `tauri build --target x86_64-apple-darwin` runs, Cargo sets `TARGET=x86_64-apple-darwin` and the build script downloads the correct Intel binary.

### CI Sidecar Caching

FFmpeg downloads are cached per architecture using:
```yaml
- uses: actions/cache@v4
  with:
    path: frontend/src-tauri/binaries/ffmpeg-*
    key: ${{ runner.os }}-${{ matrix.rust_target }}-ffmpeg-${{ hashFiles('frontend/src-tauri/build/ffmpeg.rs') }}
```

---

## Certificate CI Design

### Human Export Procedure (Pre-CI, Outside This Phase)

The human must export the Developer ID Application certificate from the local keychain as a password-protected `.p12` file:

```bash
# Export from login keychain (interactive, requires keychain password)
security export -k login.keychain-db \
  -t certs \
  -f pkcs12 \
  -o /tmp/sivlo-developer-id.p12 \
  "Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)"

# Then convert to base64 for GitHub secret (destructive step — delete after)
base64 < /tmp/sivlo-developer-id.p12 > /tmp/sivlo-developer-id.b64
# Paste contents into APPLE_CERTIFICATE secret, then:
rm /tmp/sivlo-developer-id.p12 /tmp/sivlo-developer-id.b64
```

**Preferred representation:** Base64-encoded `.p12` content stored as the `APPLE_CERTIFICATE` secret. This is the standard pattern used by existing workflows and is supported by the `security import` command on CI runners.

### CI Keychain Lifecycle

```
secrets decoded
  → temp .p12 file written (mode 0600)
  → temp keychain created
  → keychain unlocked
  → keychain settings configured (3600s timeout)
  → .p12 imported
  → codesign partition-list set
  → identity verified
  → build proceeds
  → keychain deleted (always, even on failure)
  → .p12 file deleted (always, even on failure)
```

### Secrets

| Secret | Purpose | Encoding |
|--------|---------|----------|
| `APPLE_CERTIFICATE` | Developer ID Application `.p12` | Base64-encoded |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` | Plain string |
| `KEYCHAIN_PASSWORD` | Temporary CI keychain password | Random per-job |

The `KEYCHAIN_PASSWORD` should be generated per-job (e.g., `openssl rand -hex 16`) rather than stored as a secret. This eliminates a secret while providing equivalent security.

### Keychain Cleanup

```bash
# Post-job cleanup (always runs via `if: always()`)
security delete-keychain build.keychain || true
rm -f certificate.p12 || true
```

---

## Notarization CI Design

### Approach: Tauri-Managed Notarization

Tauri supports two notarization approaches:

1. **Tauri-managed (env vars):** When `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH` are set, Tauri's bundler handles submission, waiting, and stapling automatically. This approach is documented as supported by Tauri ([Updater docs](https://v2.tauri.app/ko/plugin/updater/)).

2. **Manual notarytool:** Use `xcrun notarytool submit --key ...` with a temp `.p8` file, then `xcrun stapler staple`. This was the approach proven locally in Phase 4 (`xcrun notarytool submit --keychain-profile "SivloNotary"`).

**CI recommendation:** Use Tauri-managed notarization (option 1) since it is officially supported and keeps the workflow simpler. It was not proven locally in Phase 4, but is the documented approach for CI. If issues arise, fall back to option 2.

The `.p8` file is written from the `APPLE_API_PRIVATE_KEY` secret to a temporary path for either approach.

### Secrets

| Secret | Purpose | Encoding |
|--------|---------|----------|
| `APPLE_API_ISSUER` | App Store Connect Team Issuer UUID | Plain string |
| `APPLE_API_KEY` | App Store Connect Key ID | Plain string |
| `APPLE_API_PRIVATE_KEY` | Contents of the `.p8` auth key file | Raw PEM text (newlines preserved) |

### CI `.p8` Lifecycle

```bash
# Write .p8 from secret (no echo, no log)
printf '%s' "$APPLE_API_PRIVATE_KEY" > /tmp/AuthKey_"$APPLE_API_KEY".p8
chmod 600 /tmp/AuthKey_"$APPLE_API_KEY".p8

# Set env vars for Tauri
export APPLE_API_ISSUER="$APPLE_API_ISSUER"
export APPLE_API_KEY="$APPLE_API_KEY"
export APPLE_API_KEY_PATH="/tmp/AuthKey_${APPLE_API_KEY}.p8"

# ... tauri build ...

# Cleanup (always runs)
rm -f /tmp/AuthKey_*.p8
```

**Why Tauri-managed over manual notarytool:** The Phase 4 local proof validated Tauri-managed notarization. Using the same mechanism in CI avoids duplicating notarization logic and keeps the workflow closer to the proven local procedure.

**Fallback (if Tauri-managed fails):** Manual `xcrun notarytool submit --key --key-id --issuer --wait` + `xcrun stapler staple`. This would be implemented as a separate task only if Tauri-managed notarization proves unreliable on CI.

---

## Updater Signing CI Design

### Secrets

| Secret | Purpose | Encoding |
|--------|---------|----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater private key | Raw key contents (from `~/.sivlo-keys/sivlo-updater.key`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used during key generation | Plain string |

### CI Mechanism

Tauri officially supports `TAURI_SIGNING_PRIVATE_KEY` accepting either a **file path** or **raw key contents** when set as an environment variable ([Tauri docs](https://v2.tauri.app/ko/plugin/updater/)). Phase 3 locally proved the file-path variant. For CI, using raw contents is valid and documented. In CI:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$TAURI_SIGNING_PRIVATE_KEY"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
```

The `--config` override enables updater artifact creation for production builds:

```bash
pnpm tauri build --target <target> \
  --config '{"bundle":{"createUpdaterArtifacts":true}}'
```

The base `tauri.conf.json` keeps `createUpdaterArtifacts: false` for dev builds.

---

## Current Private-Repo Secrets

| Secret | Phase 5 Usage | Notes |
|--------|--------------|-------|
| `SIVLO_RELEASES_PAT` | **NOT USED** | Phase 6 dependency only; must not be consumed in Phase 5 |
| `APPLE_CERTIFICATE` | Used | Must be created before Phase 5 execution |
| `APPLE_CERTIFICATE_PASSWORD` | Used | Must be created before Phase 5 execution |
| `APPLE_API_ISSUER` | Used | Must be created before Phase 5 execution |
| `APPLE_API_KEY` | Used | Must be created before Phase 5 execution |
| `APPLE_API_PRIVATE_KEY` | Used | Must be created before Phase 5 execution |
| `TAURI_SIGNING_PRIVATE_KEY` | Used | Already exists (from Phase 3/legacy) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Used | Already exists (from Phase 3/legacy) |

---

## Workflow Matrix Design

### Workflow: `.github/workflows/sivlo-ci.yml`

```yaml
name: "Sivlo macOS CI"

on:
  workflow_dispatch:

concurrency:
  group: sivlo-ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  RUST_BACKTRACE: 1
  CARGO_TERM_COLOR: always

jobs:
  build-macos:
    name: Build ${{ matrix.arch_label }} (${{ matrix.rust_target }})
    runs-on: ${{ matrix.runner }}
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - arch: aarch64
            arch_label: Apple Silicon
            rust_target: aarch64-apple-darwin
            runner: macos-15
          - arch: x86_64
            arch_label: Intel
            rust_target: x86_64-apple-darwin
            runner: macos-15-intel

    steps:
      # ... (see Task 6 for full step-by-step)
```

### Per-Job Pipeline

Each matrix job independently performs:

```
1.  Checkout repository
2.  Extract version from tauri.conf.json
3.  Setup pnpm + Node.js
4.  Restore pnpm cache
5.  Install Rust stable + target
6.  Restore Rust cache
7.  Install frontend dependencies
8.  Build llama-helper sidecar (target-specific)
9.  Restore FFmpeg cache
10. Import Developer ID certificate into temp keychain
11. Verify certificate identity
12. Run frontend tests (pnpm test, if available)
13. Run Rust tests (cargo test)
14. Build frontend production build (pnpm build)
15. Setup notarization credentials (.p8 temp file)
16. Tauri production build with --config override
17. Validate code signature (codesign)
18. Validate notarization (stapler)
19. Validate DMG (hdiutil verify)
20. Validate updater archive + signature
21. Validate architecture, version, bundle ID
22. Upload private Actions artifact
23. Cleanup: delete keychain, delete .p8, delete temp cert
```

**Step 23 always runs** (via `if: always()` or `cleanup` job) regardless of prior step success/failure.

---

## Artifact Output Contract

### Per-Architecture Upload Names

| Architecture | Artifact name (Actions) | Contains |
|-------------|------------------------|----------|
| aarch64 | `sivlo-macos-aarch64-${{ version }}` | DMG, `.app.tar.gz`, `.app.tar.gz.sig` |
| x86_64 | `sivlo-macos-x86_64-${{ version }}` | DMG, `.app.tar.gz`, `.app.tar.gz.sig` |

### Artifact Paths in Build Output

```
target/<rust_target>/release/bundle/dmg/Sivlo_<version>_<arch>.dmg
target/<rust_target>/release/bundle/macos/Sivlo_<version>_<arch>.app.tar.gz
target/<rust_target>/release/bundle/macos/Sivlo_<version>_<arch>.app.tar.gz.sig
```

(Exact filenames follow Tauri's naming convention; the version and arch are derived from `tauri.conf.json` and the build target.)

### Phase 5 Retention

Uploaded as private GitHub Actions artifacts with `retention-days: 30`. No public release is created.

---

## Validation Inside CI

Each architecture job must **fail** unless all checks pass.

### Required Validation Commands

```bash
# 1. Architecture check
file <Sivlo.app>/Contents/MacOS/sivlo
# Expected: "Mach-O 64-bit executable arm64" or "Mach-O 64-bit executable x86_64"

# 2. Version check
defaults read <Sivlo.app>/Contents/Info.plist CFBundleShortVersionString
# Expected: matches tauri.conf.json version

# 3. Bundle ID check
defaults read <Sivlo.app>/Contents/Info.plist CFBundleIdentifier
# Expected: com.drewsepeczi.sivlo

# 4. Developer ID signature valid
codesign --verify --deep --strict --verbose=2 <Sivlo.app>
# Expected: exit 0, no errors

# 5. Signing identity details
codesign -dv --verbose=4 <Sivlo.app> 2>&1
# Expected: Authority=Developer ID Application, TeamIdentifier=2NHJGX6A7S, Hardened Runtime=YES

# 6. Nested binaries signed
codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/sivlo
codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/llama-helper
codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/ffmpeg
# Expected: all valid

# 7. Notarization stapling valid
xcrun stapler validate <Sivlo.app>
# Expected: "The validate action worked!"

# 8. DMG valid
hdiutil verify <Sivlo.dmg>
# Expected: exit 0

# 9. Updater archive exists
ls -la <Sivlo.app.tar.gz>
# Expected: file exists, non-empty

# 10. Updater signature exists
ls -la <Sivlo.app.tar.gz.sig>
# Expected: file exists, non-empty

# 11. No secret files in build output
find target/ -name "*.p12" -o -name "*.p8" -o -name "*.key" 2>/dev/null
# Expected: empty
```

### Checks Reliable on GitHub-Hosted CI

| Check | Reliable in CI | Notes |
|-------|---------------|-------|
| `file` architecture | Yes | Always works |
| `defaults read` version/bundle ID | Yes | Always works |
| `codesign --verify` | Yes | Always works |
| `codesign -dv` details | Yes | Always works |
| `xcrun stapler validate` | Yes | Works after notarization |
| `hdiutil verify` | Yes | Always works |
| Updater artifact existence | Yes | Always works |
| `spctl --assess` (Gatekeeper) | **Unreliable** | Gatekeeper check may behave differently in CI environment; defer to physical smoke test (Phase 9) |

---

## Version Handling

### Extraction

```bash
VERSION=$(grep -o '"version": "[^"]*"' frontend/src-tauri/tauri.conf.json | cut -d'"' -f4)
echo "version=$VERSION" >> "$GITHUB_OUTPUT"
```

Current version: `0.4.0`. Phase 5 does **not** bump the version. Version bumping belongs to the release pipeline (Phase 8+).

### Artifact Naming

CI derives artifact names from the extracted version. No hardcoded version string in the workflow file. This ensures the workflow remains correct across version bumps.

---

## Workflow Trigger

### Phase 5 Trigger

```yaml
on:
  workflow_dispatch:
```

**Why `workflow_dispatch` only:**

- Phase 5 is validation only; no production release.
- `workflow_dispatch` allows manual triggering without affecting any branch.
- No `push` or `pull_request` triggers avoids accidental runs.
- No `v*` tag trigger — tag-driven releases belong to Phase 8+.

### Phase 8+ Trigger Addition

When the release pipeline is integrated, the workflow will add:

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
```

---

## GitHub Actions Permissions

```yaml
permissions:
  contents: read
```

Phase 5 needs only:
- Repository checkout (read)
- Private artifact upload (provided by `actions/upload-artifact@v4` without special permissions)

`contents: write` is **NOT** granted because Phase 5 does not create releases, tags, or publish anything.

---

## Secret Logging Safety

### Controls

1. **Never echo secrets:** All secret-using steps use `set +x` or run without `set -x`.
2. **Never run broad `env`:** No step dumps the full environment.
3. **Temporary secret files removed:** `.p12` and `.p8` files deleted in every cleanup step.
4. **Temporary keychain removed:** `security delete-keychain` runs in cleanup.
5. **GitHub masking is defense-in-depth only:** Do not rely on it; remove material before it can appear.
6. **No artifact uploads of credential directories:** Only build output artifacts are uploaded.
7. **`set -x` never wraps secret operations:** Secret steps use explicit `set +x` if the job-level shell has tracing enabled.
8. **Post-job cleanup runs on failure:** `if: always()` ensures credential removal.

### Cleanup Step Pattern

```yaml
- name: Cleanup credentials
  if: always()
  run: |
    security delete-keychain build.keychain 2>/dev/null || true
    rm -f certificate.p12 2>/dev/null || true
    rm -f /tmp/AuthKey_*.p8 2>/dev/null || true
```

---

## Caching

### Cached

| Item | Cache key | Path |
|------|-----------|------|
| pnpm store | `${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}` | `~/.pnpm-store` (or `pnpm store path`) |
| Cargo registry + git | `swatinem/rust-cache@v2` default | `~/.cargo/registry`, `~/.cargo/git` |
| Rust build artifacts | `swatinem/rust-cache@v2` with `key: sivlo-${{ matrix.rust_target }}` | `frontend/target` |
| FFmpeg binary | `${{ runner.os }}-${{ matrix.rust_target }}-ffmpeg-${{ hashFiles('frontend/src-tauri/build/ffmpeg.rs') }}` | `frontend/src-tauri/binaries/ffmpeg-*` |

### NOT Cached

- Signing keychains (ephemeral per job)
- `.p12` certificate
- `.p8` API key
- Updater private key (provided via env var, not file-based)
- Signed release bundles (each job produces fresh; no cross-job bundle reuse)

---

## Task Decomposition

### Task 1 — Audit Existing GitHub Actions + Runners

**Files:** Read-only audit. No files modified.

**Steps:**
- [x] Read all existing workflow files (build-macos.yml, build.yml, build-devtest.yml, release.yml, build-test.yml, build-linux.yml, build-windows.yml, pr-main-check.yml)
- [x] Classify each workflow (see Existing Workflow Audit above)
- [x] Document issues: Meetily branding, old bundle IDs, old artifact names, Apple ID auth, missing Intel builds
- [x] Verify runner labels against current GitHub docs for private repositories
- [x] Confirm `macos-15` (arm64) and `macos-15-intel` (x86_64) are available for private repos
- [x] Note Intel runner deprecation timeline (August 2027)
- [x] Confirm sidecar binaries: only aarch64 present in repo; x86_64 must be built from source in CI

**Verification:**
- All workflow files classified
- Runner labels verified against official documentation
- No stale architecture assumptions remain

**Commit:** None (audit only — documented in this plan)

---

### Task 2 — Architecture/Sidecar Build Contract

**Files:** Read-only audit. No files modified.

**Steps:**
- [x] Verify `llama-helper` crate exists and builds: check `frontend/llama-helper/` or workspace `Cargo.toml`
- [x] Verify `llama-helper` x86_64 build command: `cargo build --release -p llama-helper --target x86_64-apple-darwin --features metal`
- [x] Verify `ffmpeg` build script handles both architectures (confirmed: `build/ffmpeg.rs` is target-aware)
- [x] Verify Tauri sidecar naming convention: `llama-helper-<target-triple>` in `binaries/`
- [x] Confirm no x86_64 sidecar pre-built binaries exist in repo (only aarch64)
- [x] Document CI build requirements per architecture:
  - aarch64: llama-helper pre-built; ffmpeg pre-built or downloaded
  - x86_64: llama-helper built from source; ffmpeg downloaded by build script

**Verification:**
- Both architecture build paths are provable
- No sidecar gaps that would block CI

**Commit:** None (audit only)

---

### Task 3 — Temporary Developer ID Keychain Setup

**Files:** New workflow file `.github/workflows/sivlo-ci.yml` (created in Task 6).

**Steps:**
- [ ] Plan keychain lifecycle: create → unlock → import → use → delete
- [ ] Plan `.p12` handling: base64-decode from secret → write to temp file → import → delete
- [ ] Plan `KEYCHAIN_PASSWORD` generation: `openssl rand -hex 16` per job (not stored as secret)
- [ ] Plan partition list: `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain`
- [ ] Plan identity verification: `security find-identity -v -p codesigning build.keychain | grep "Developer ID Application"`
- [ ] Plan cleanup: `security delete-keychain build.keychain` + `rm -f certificate.p12` in `if: always()` step
- [ ] Verify pattern matches proven local Phase 4 procedure
- [ ] Confirm no certificate material persists to Actions artifacts

**Verification:**
- Keychain lifecycle is complete and fail-safe
- Cleanup runs on both success and failure
- No certificate material in artifact uploads

**Commit:** Part of Task 6 workflow creation

---

### Task 4 — TEAM API-Key Notarization Setup

**Files:** Part of `.github/workflows/sivlo-ci.yml` (created in Task 6).

**Steps:**
- [ ] Plan `.p8` file creation: write `APPLE_API_PRIVATE_KEY` secret to `/tmp/AuthKey_<KEY_ID>.p8`
- [ ] Plan `APPLE_API_KEY_PATH` env var pointing to temp `.p8`
- [ ] Plan `APPLE_API_ISSUER` and `APPLE_API_KEY` env vars from secrets
- [ ] Verify Tauri-managed notarization picks up these env vars during `tauri build`
- [ ] Plan fallback: if Tauri-managed fails, implement `xcrun notarytool submit --wait` + `xcrun stapler staple`
- [ ] Plan `.p8` cleanup: `rm -f /tmp/AuthKey_*.p8` in `if: always()` step
- [ ] Verify `.p8` contents never appear in logs (no echo, no `set -x` around secret operations)

**Verification:**
- Notarization credentials handled securely
- `.p8` is ephemeral and cleaned up
- No secret leakage

**Commit:** Part of Task 6 workflow creation

---

### Task 5 — Tauri Updater Signing Setup

**Files:** Part of `.github/workflows/sivlo-ci.yml` (created in Task 6).

**Steps:**
- [ ] Plan `TAURI_SIGNING_PRIVATE_KEY` env var: passed directly from secret (raw key contents)
- [ ] Plan `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env var: passed from secret
- [ ] Plan `--config` override: `'{"bundle":{"createUpdaterArtifacts":true}}'` appended to `pnpm tauri build` args
- [ ] Verify this matches the Phase 3 proven local procedure
- [ ] Verify no updater signing key material persists to artifacts or logs

**Verification:**
- Updater signing produces `.app.tar.gz` + `.app.tar.gz.sig`
- Key material is environment-only, never in files or artifacts

**Commit:** Part of Task 6 workflow creation

---

### Task 6 — arm64/x86_64 Workflow Matrix

**Files:** `.github/workflows/sivlo-ci.yml` (NEW file)

**Steps:**
- [ ] Create `.github/workflows/sivlo-ci.yml` with:
  - `name: "Sivlo macOS CI"`
  - `on: workflow_dispatch`
  - `permissions: contents: read`
  - `concurrency` group
  - Matrix: `aarch64-apple-darwin` on `macos-15`, `x86_64-apple-darwin` on `macos-15-intel`
  - All steps from Tasks 3, 4, 5 combined
  - Version extraction step
  - Dependency setup (pnpm, Node, Rust + target)
  - Caching (pnpm, Cargo, FFmpeg)
  - llama-helper sidecar build (target-specific: `--target <target>`)
  - Frontend tests
  - Rust tests
  - Frontend production build
  - Certificate import → keychain setup
  - Tauri build with signing + notarization + updater signing
  - Artifact validation (all checks from Validation section)
  - Private artifact upload
  - Credential cleanup (`if: always()`)
- [ ] Verify workflow YAML is valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/sivlo-ci.yml'))"` or use `actionlint`
- [ ] Verify no Meetily secrets referenced (no `MEETILY_RSA_PUBLIC_KEY`, no `SUPABASE_*`)
- [ ] Verify no `contents: write` permission
- [ ] Verify no release upload steps
- [ ] Verify no tag creation steps
- [ ] Verify no `latest.json` generation
- [ ] Verify no publication to `sivlo-releases`

**Verification:**
- Workflow YAML is valid
- Matrix correctly maps architecture → runner → target
- No Meetily references in the new workflow
- No public release actions
- Fail-closed behavior for all critical steps

**Commit:** `ci: add Sivlo macOS build matrix for Apple Silicon and Intel`

---

### Task 7 — Release Artifact Validation

**Files:** Part of `.github/workflows/sivlo-ci.yml` (created in Task 6).

**Steps:**
- [ ] Implement validation steps (see Validation Inside CI section)
- [ ] Verify `file` command detects correct CPU architecture
- [ ] Verify `codesign --verify --deep --strict` passes
- [ ] Verify `codesign -dv` shows Developer ID, Team ID 2NHJGX6A7S, bundle ID `com.drewsepeczi.sivlo`
- [ ] Verify nested binaries (sivlo, llama-helper, ffmpeg) are all signed
- [ ] Verify `xcrun stapler validate` passes
- [ ] Verify `hdiutil verify` passes on DMG
- [ ] Verify `.app.tar.gz` exists and is non-empty
- [ ] Verify `.app.tar.gz.sig` exists and is non-empty
- [ ] Verify no `.p12`, `.p8`, or `.key` files in `target/` directory
- [ ] Verify validation failures cause job failure (`set -e` or explicit exit codes)

**Verification:**
- Every validation check has a concrete command
- All checks are fail-closed
- One failing check fails the entire job

**Commit:** Part of Task 6 workflow creation

---

### Task 8 — Secret Cleanup/Security Review

**Files:** `.github/workflows/sivlo-ci.yml` (created in Task 6).

**Steps:**
- [ ] Verify no `.p12` or `.p8` files remain after cleanup
- [ ] Verify `if: always()` on cleanup steps
- [ ] Verify no `set -x` wraps secret operations
- [ ] Verify no broad `env` dump steps
- [ ] Verify no artifact uploads include credential directories
- [ ] Verify GitHub masking is not the only protection (actual file removal is primary)
- [ ] Verify `SIVLO_RELEASES_PAT` is not referenced anywhere in the workflow
- [ ] Run `grep -n 'SIVLO_RELEASES_PAT\|MEETILY_RSA_PUBLIC_KEY\|SUPABASE' .github/workflows/sivlo-ci.yml` — expected: zero matches
- [ ] Verify `permissions: contents: read` is set at both workflow and job level

**Verification:**
- No secret material persists after job completion
- No unnecessary secrets referenced
- Least-privilege permissions

**Commit:** Part of Task 6 workflow creation

---

### Task 9 — Manually Run CI Workflow

**Files:** No files modified. Manual workflow execution.

**Prerequisites:**
- All secrets must be configured in GitHub repo settings
- Developer ID `.p12` exported and uploaded as `APPLE_CERTIFICATE`
- App Store Connect `.p8` uploaded as `APPLE_API_PRIVATE_KEY`
- Updater key contents uploaded as `TAURI_SIGNING_PRIVATE_KEY`

**Steps:**
- [ ] Trigger `workflow_dispatch` on the `sivlo-ci.yml` workflow from the `main` branch
- [ ] Monitor arm64 job (`macos-15` runner) progress
- [ ] Monitor x86_64 job (`macos-15-intel` runner) progress
- [ ] Verify both jobs reach green status
- [ ] Download private artifacts from both jobs
- [ ] Verify artifact contents match expected contract

**Expected result:**
- arm64 job: green
- x86_64 job: green
- Both produce downloadable private artifacts
- No public release created
- No asset on `sivlo-releases`

**Commit:** None (manual verification)

---

### Task 10 — Review Workflow Artifacts + Final Phase 5 Gate

**Files:** No files modified. Review and verification.

**Steps:**
- [ ] Download arm64 artifact, verify DMG, `.app.tar.gz`, `.sig` are present
- [ ] Download x86_64 artifact, verify DMG, `.app.tar.gz`, `.sig` are present
- [ ] Inspect artifact names for deterministic, version-aware naming
- [ ] Verify no GitHub Release exists on the source repo
- [ ] Verify no asset was uploaded to `drewsephski/sivlo-releases`
- [ ] Verify `SIVLO_RELEASES_PAT` was never consumed
- [ ] Verify repo tests still pass (pnpm build, cargo test, cargo check)
- [ ] Verify git working tree is clean (only the new workflow file changed)
- [ ] Run Phase 5 Acceptance Gate checklist

**Verification:**
- All Phase 5 acceptance criteria met
- No Phase 6 scope leakage
- Working tree is clean

**Commit:** None (review only)

---

## Phase 5 Acceptance Gate

All of the following must be true before Phase 6 begins:

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Supported arm64 runner identified | `macos-15` label verified in GitHub docs |
| 2 | Supported Intel runner identified | `macos-15-intel` label verified in GitHub docs |
| 3 | arm64 target builds | `aarch64-apple-darwin` job green |
| 4 | x86_64 target builds | `x86_64-apple-darwin` job green |
| 5 | arm64 llama-helper sidecar correct architecture | `file` check in CI output |
| 6 | x86_64 llama-helper sidecar correct architecture | `file` check in CI output |
| 7 | Developer ID certificate imported securely | `security find-identity` in CI output |
| 8 | Team ID correct | `codesign -dv` shows `2NHJGX6A7S` |
| 9 | App Store Connect API auth works | Notarization status = "Accepted" |
| 10 | Both builds notarized | `xcrun stapler validate` exits 0 for both |
| 11 | Both builds stapled/validated | Stapler validation succeeds |
| 12 | Both DMGs valid | `hdiutil verify` exits 0 for both |
| 13 | Both updater archives present | `.app.tar.gz` exists for both |
| 14 | Both `.sig` files present | `.sig` exists for both |
| 15 | No secrets in artifacts/repo/logging | Secret safety audit passes |
| 16 | arm64 Actions job green | Workflow run shows green checkmark |
| 17 | Intel Actions job green | Workflow run shows green checkmark |
| 18 | Private artifacts downloadable | Artifact download succeeds |
| 19 | No public release created | No release on source repo |
| 20 | `SIVLO_RELEASES_PAT` unused | Not referenced in workflow |
| 21 | Repo tests remain green | `pnpm build` + `cargo test` pass |

---

## Phase 6+ Non-Goals

Do **NOT** implement or plan in detail in this phase:

- Publication to `drewsephski/sivlo-releases`
- GitHub Release creation on source or release repo
- `SIVLO_RELEASES_PAT` usage
- `latest.json` generation
- Update endpoint activation in `tauri.conf.json`
- Release notes
- Tag-driven production publish (`v*` trigger)
- Public beta launch
- Version bumping from `0.4.0`

State dependencies only. These belong to Phases 6–10.

---

## Self-Review Checklist

| Property | Status |
|----------|--------|
| Current official runner labels verified | Verified via GitHub docs and changelog (August 2026) |
| No stale architecture assumptions | Matrix uses native runners for each architecture; no cross-compilation |
| Sidecars proven for both targets | aarch64: pre-built; x86_64: built from source + ffmpeg downloaded by build script |
| Certificate handling maps to local Phase 4 proof | Same keychain import pattern; base64 `.p12` is standard |
| Team API-key notarization maps to local proof | Same env vars; Tauri-managed notarization |
| Updater signing maps to Phase 3 proof | Same env vars + `--config` override |
| No secret values in plan | Only variable names and command patterns; no actual key IDs, UUIDs, or key contents |
| No Phase 6 scope leakage | No publication, no `latest.json`, no PAT usage, no release creation |
| Deterministic artifacts | Version derived from `tauri.conf.json`; architecture from matrix |
| Every acceptance property has verification | 21-item acceptance gate with concrete verification methods |
| No Meetily references in new workflow | Only `sivlo-*` naming used |
| Fail-closed for all critical operations | Certificate failure → job fails; signing failure → job fails; notarization rejection → job fails |
| Cleanup on failure | `if: always()` cleanup step for keychain and temp files |

---

## Working Tree

- Branch: `main`
- Status: clean (only this plan file will be added)
- No production implementation changed
- No workflows modified
- No secrets committed
- No certificates exported
- No tags created
- No releases published

---

## Commit Plan

**Commit:** `docs: plan Sivlo macOS CI build matrix`

Only file: `docs/superpowers/plans/2026-08-16-sivlo-ci-build-matrix.md`
