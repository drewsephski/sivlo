# Sivlo macOS Signing + Notarization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure and prove Developer ID signing and Apple notarization for Sivlo's direct-download macOS distribution without committing Apple private credentials.

**Architecture:** Sivlo release builds are signed with a Developer ID Application certificate, notarized using a team App Store Connect API key, and validated locally with Apple's code-signing, notarization, stapling, and Gatekeeper tools. Secrets remain outside the repository; Phase 5 will later translate the proven local procedure into GitHub Actions.

**Tech Stack:** Tauri 2, macOS codesign, Xcode notarytool/stapler, Apple Developer ID, App Store Connect API authentication.

## Global Constraints

- Product: Sivlo
- Bundle identifier: com.drewsepeczi.sivlo
- Minimum macOS: 13.0
- Distribution: direct-download DMG
- Signing certificate type: Developer ID Application
- Notarization auth: TEAM App Store Connect API key
- Do not use an individual App Store Connect API key for notarytool.
- Do not use Apple ID + app-specific password for the production CI design.
- Apple private keys/certificates must never be committed.
- App Store Connect .p8 contents must never be committed.
- Certificate-export passwords must never be committed.
- Do not expose secret values in commands, logs, reports, or documentation.
- Phase 4 proves the process locally; Phase 5 automates it in CI.
- Do not publish a public release in Phase 4.
- Do not modify updater trust unless signing integration requires a narrowly justified compatibility change.
- Use small, reviewable commits.

---

## File Map

| File | Current role | Phase 4 action |
|------|-------------|----------------|
| `frontend/src-tauri/tauri.conf.json` | `signingIdentity: "-"`, `hardenedRuntime: true`, `entitlements: "entitlements.plist"`, `createUpdaterArtifacts: false` | No config change — signing driven by env vars |
| `frontend/src-tauri/entitlements.plist` | Four entitlements: audio-input, audio-output, microphone, screen-capture | No change (minimum required entitlements) |
| `frontend/src-tauri/Info.plist` | Microphone/screen/audio capture usage descriptions | No change |
| `frontend/src-tauri/Cargo.toml` | Crate name still `meetily`, upstream repo URL | No change (out of scope) |
| `frontend/src-tauri/build.rs` | FFmpeg binary download + tauri_build::build() | No change |
| `frontend/src-tauri/binaries/llama-helper-aarch64-apple-darwin` | Sidecar binary | Signed during build (Tauri handles) |
| `frontend/src-tauri/binaries/ffmpeg-aarch64-apple-darwin` | Sidecar binary | Signed during build (Tauri handles) |
| `.github/workflows/build-macos.yml` | Legacy Meetily signing (Apple ID + app-specific password) | Phase 5 rewrite, not Phase 4 |
| `.github/workflows/build.yml` | Reusable build workflow (Apple ID notarization) | Phase 5 rewrite, not Phase 4 |
| `.github/workflows/build-devtest.yml` | DevTest workflow (Apple ID notarization) | Phase 5 rewrite, not Phase 4 |

No new files are created in the repository beyond the plan itself. All credential material stays outside the repository.

---

## Current Signing State Audit

### Active Signing Configuration

**File:** `frontend/src-tauri/tauri.conf.json:105-110`

```json
"macOS": {
    "minimumSystemVersion": "13.0",
    "entitlements": "entitlements.plist",
    "signingIdentity": "-",
    "hardenedRuntime": true
}
```

| Property | Current Value | Phase 4 Action |
|----------|---------------|----------------|
| `signingIdentity` | `"-"` (ad-hoc) | No change — `APPLE_SIGNING_IDENTITY` env var overrides at build time |
| `hardenedRuntime` | `true` | No change (default for Developer ID) |
| `entitlements` | `"entitlements.plist"` | No change |
| `minimumSystemVersion` | `"13.0"` | No change |

**Classification:** `ACTIVE_SIGNING_CONFIG`

The `-` identity means local `tauri build` without `APPLE_SIGNING_IDENTITY` uses ad-hoc signing. For Phase 4 release builds, `APPLE_SIGNING_IDENTITY` is set in the environment and overrides this value. This is the correct pattern — the committed config stays neutral for dev builds while CI/local release builds provide the real identity via env var.

### Current Entitlements

**File:** `frontend/src-tauri/entitlements.plist`

```xml
<dict>
    <key>com.apple.security.device.audio-input</key>     <true/>
    <key>com.apple.security.device.audio-output</key>    <true/>
    <key>com.apple.security.device.microphone</key>      <true/>
    <key>com.apple.security.device.screen-capture</key>  <true/>
</dict>
```

**Classification:** `ENTITLEMENT`

| Entitlement | Why Sivlo Needs It | Required for Dev ID | Weakens Hardened Runtime |
|-------------|--------------------|---------------------|--------------------------|
| `com.apple.security.device.audio-input` | Microphone capture for meeting recording | Yes — microphone access is core functionality | No — standard audio entitlement |
| `com.apple.security.device.audio-output` | System audio output monitoring/volume detection | Yes — system audio capture uses ScreenCaptureKit | No — standard audio entitlement |
| `com.apple.security.device.microphone` | Microphone permission prompt (duplicate of audio-input for older macOS) | Yes — triggers the macOS permission dialog | No — standard entitlement |
| `com.apple.security.device.screen-capture` | ScreenCaptureKit for system audio capture (macOS 13+) | Yes — primary mechanism for system audio capture | No — standard entitlement, required by ScreenCaptureKit |

**Assessment:** All four entitlements are necessary and minimum for Sivlo's core functionality. No changes needed. No `com.apple.security.app-sandbox` (not sandboxed — direct-download distribution). No `com.apple.security.cs.disable-library-validation` needed (no unsigned dynamic libraries). No hardened-runtime exceptions needed.

### Info.plist Usage Descriptions

**File:** `frontend/src-tauri/Info.plist`

| Key | Description | Required |
|-----|-------------|----------|
| `NSMicrophoneUsageDescription` | "This application needs access to your microphone to record meeting audio." | Yes — triggers mic permission prompt |
| `NSScreenCaptureUsageDescription` | "This application needs screen recording permission to capture system audio during meetings." | Yes — triggers ScreenCaptureKit permission prompt |
| `NSAudioCaptureUsageDescription` | "This application needs permission to capture system audio output for meeting transcription and recording." | Yes — system audio capture permission |
| `com.apple.security.device.audio-input` | `<true/>` | Redundant with entitlements.plist, but harmless |

**Assessment:** All usage descriptions are appropriate. No changes needed.

### GitHub Actions Signing (Legacy — Phase 5 Scope)

The existing workflows use Apple ID + app-specific password for notarization:

| Workflow | Signing Method | Notarization Method |
|----------|---------------|---------------------|
| `build-macos.yml` | `APPLE_CERTIFICATE` + `APPLE_ID` + `APPLE_ID_PASSWORD` | Apple ID auth |
| `build.yml` | `APPLE_CERTIFICATE` + `APPLE_ID` + `APPLE_ID_PASSWORD` | Apple ID auth |
| `build-devtest.yml` | `APPLE_CERTIFICATE` + `APPLE_ID` + `APPLE_ID_PASSWORD` | Apple ID auth |

**Classification:** `PHASE_5_CI`

Phase 5 must rewrite these workflows to use TEAM App Store Connect API key authentication (`APPLE_API_ISSUER` + `APPLE_API_KEY` + `APPLE_API_KEY_PATH`) instead of Apple ID. Phase 4 only proves the process locally.

### Other Audit Surfaces

| File | Reference | Classification |
|------|-----------|----------------|
| `frontend/src-tauri/Cargo.toml:2` | `name = "meetily"` | INHERITED_UPSTREAM (out of scope) |
| `frontend/src-tauri/Cargo.toml:7` | `repository = "https://github.com/Zackriya-Solutions/meeting-minutes"` | INHERITED_UPSTREAM (out of scope) |
| `frontend/src-tauri/tauri.conf.json:112` | Windows `signCommand` | UNRELATED (Windows signing, not macOS) |
| `frontend/src-tauri/tauri.conf.json:117` | Updater pubkey (Sivlo's, from Phase 3) | PRESERVED — no change |

---

## Developer ID Certificate Status

### Local Keychain Check

```bash
security find-identity -v -p codesigning
```

**Result:**

```
1) 57B9E15868FE9A3722A24C5B68397BC8D63A5E98 "Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)"
1 valid identities found
```

**Status: INSTALLED.** A valid Developer ID Application certificate is present in the login keychain.

| Property | Value |
|----------|-------|
| Certificate type | Developer ID Application |
| Certificate holder | ANDREW DOUGLAS SEPECZI |
| Team ID | 2NHJGX6A7S |
| Keychain | login keychain |
| Phase 4 action | No creation needed — use the existing certificate |

The private key for this certificate remains in the login keychain. Phase 4 signing will use it directly. The plan does not export it.

### Certificate Identity Name

The signing identity string for `APPLE_SIGNING_IDENTITY` is:

```
Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)
```

This must be passed exactly as the `APPLE_SIGNING_IDENTITY` environment variable during local release builds.

---

## App Store Connect Team API Key

### Required Credentials

| Credential | Conceptual Secret Name | Local Storage |
|------------|----------------------|---------------|
| Issuer ID | `APPLE_API_ISSUER` | UUID format, known to developer |
| Key ID | `APPLE_API_KEY` | 10+ alphanumeric characters, known to developer |
| Auth key file | `APPLE_API_KEY_PATH` | `.p8` file at `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8` |

### Phase 4 Human-Only Checkpoint

**STOP if any of the following are missing:**

1. Apple Developer Program enrollment (paid)
2. Developer ID Application certificate (installed — confirmed above)
3. App Store Connect TEAM API key (`.p8` file)

The execution phase must verify the `.p8` file exists at the expected path before attempting notarization. If the key does not exist, execution halts for the human to create/download it from App Store Connect.

### Key Storage Policy

| Location | Allowed | Notes |
|----------|---------|-------|
| `~/.appstoreconnect/private_keys/` | Yes | Tauri/notarytool default search path |
| `~/.sivlo-keys/` | Yes | Alternate explicit path via `APPLE_API_KEY_PATH` |
| Repository root | **NO** | Never committed |
| `.env` committed file | **NO** | Never committed |
| docs/ | **NO** | Never committed |
| `.p8` file contents in any text file | **NO** | Never committed |

### Phase 5 Future Secrets (Conceptual Only)

| Secret Name | Purpose |
|-------------|---------|
| `APPLE_API_ISSUER` | Issuer UUID for notarytool |
| `APPLE_API_KEY` | Key ID for notarytool |
| `APPLE_API_PRIVATE_KEY` | Base64-encoded `.p8` file contents |

Do not create GitHub secrets in Phase 4.

---

## Signing Configuration Design

### Approach: Environment Variable Override

**Decision:** Use `APPLE_SIGNING_IDENTITY` environment variable rather than changing `tauri.conf.json`'s `signingIdentity`.

**Rationale:**

1. `tauri.conf.json` is committed to the repository; the identity string contains a personal name and team ID that should not be committed
2. The env var cleanly overrides the config value at build time
3. Works identically for local Phase 4 verification and Phase 5 CI
4. The current `"-"` in config works for unsigned dev builds — no config change needed

**Build-time behavior:**

| Scenario | `APPLE_SIGNING_IDENTITY` | `signingIdentity` in config | Actual identity used |
|----------|--------------------------|----------------------------|---------------------|
| Local dev (`tauri dev`) | Not set | `"-"` | Ad-hoc (fine for dev) |
| Local release build (Phase 4) | Set to Developer ID name | `"-"` (ignored) | Developer ID Application |
| CI release build (Phase 5) | Set from cert extraction | `"-"` (ignored) | Developer ID Application |

### Notarization Configuration Design

Tauri's bundler automatically performs notarization when notarization credentials are present in the environment. The preferred Phase 4 path is **Tauri-managed notarization during `tauri build`** (option A), because:

1. It is the documented Tauri 2 mechanism
2. It handles submission, waiting, and stapling automatically
3. It maps cleanly to Phase 5 CI (same env vars)
4. It avoids duplicating notarization logic

**Required environment variables for notarization:**

| Variable | Value Source | Phase 4 Source |
|----------|-------------|----------------|
| `APPLE_API_ISSUER` | App Store Connect → Users and Access → Keys → Team ID section | Developer enters in shell |
| `APPLE_API_KEY` | Key ID from App Store Connect | Developer enters in shell |
| `APPLE_API_KEY_PATH` | Path to `AuthKey_<KEY_ID>.p8` | `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8` or explicit via env |

**Alternative: notarytool + keychain profile**

If Tauri-managed notarization is problematic, the fallback is:

```bash
xcrun notarytool store-credentials "sivlo-notary" \
    --key ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 \
    --key-id <KEY_ID> \
    --issuer <ISSUER_UUID>

xcrun notarytool submit <artifact> \
    --keychain-profile "sivlo-notary" \
    --wait
```

Phase 4 should try Tauri-managed first; fall back to manual `notarytool` if Tauri's integration fails.

---

## Hardened Runtime

**Current state:** `hardenedRuntime: true` in `tauri.conf.json`.

**Tauri 2 default:** Hardened runtime is enabled by default for macOS bundles (`hardenedRuntime: true` is the documented default).

**Apple notarization requirement:** Hardened runtime is **mandatory** for notarized apps distributed outside the App Store. The current configuration already enables this.

**Entitlements compatibility:** The four current entitlements (`audio-input`, `audio-output`, `microphone`, `screen-capture`) are all compatible with hardened runtime. None are hardened-runtime exceptions.

**No configuration change needed.** Hardened runtime is already correctly enabled.

---

## Nested Binaries Audit

### Binaries to Sign/Verify

| Binary | Path in .app Bundle | Signing Method |
|--------|-------------------|----------------|
| Main executable | `Contents/MacOS/sivlo` | Tauri signs with Developer ID during build |
| llama-helper sidecar | `Contents/MacOS/llama-helper` | Tauri signs as sidecar (Tauri handles) |
| ffmpeg sidecar | `Contents/MacOS/ffmpeg` | Tauri signs as sidecar (Tauri handles) |

### Additional Search for Nested Code

- `.dylib` files in source tree: **None found** in `frontend/src-tauri/`
- `.framework` bundles in source tree: **None found** in `frontend/src-tauri/`
- Build output may contain dylibs from dependencies — `codesign --deep --strict` during verification will catch any issues

### Signing Order

Tauri's bundler signs nested binaries automatically in the correct order:
1. `llama-helper` and `ffmpeg` (sidecars) are signed first
2. `sivlo` (main binary) is signed after
3. The `.app` bundle is signed last
4. Notarization is submitted after signing

### Verification Commands

```bash
# Verify main app signature
codesign --verify --deep --strict --verbose=2 <Sivlo.app>

# Inspect signing details
codesign -dv --verbose=4 <Sivlo.app>

# Verify specific nested binaries
codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/sivlo
codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/llama-helper
codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/ffmpeg
```

---

## DMG Packaging

### Known Issue

A previous Phase 3 local build encountered a `bundle_dmg.sh` failure when attempting full DMG generation. The exact error was not captured, but the failure was during the DMG creation step in Tauri's bundler.

### Phase 4 Investigation

Phase 4 must:

1. Attempt `tauri build` which produces both `.app` and `.dmg`
2. If DMG generation fails, capture the full error output
3. Investigate whether the failure is:
   - Missing `create-dmg` or `hdiutil` issue
   - Disk space or permissions issue
   - Tauri bundler DMG template issue
   - Code signing conflict during DMG packaging
4. Debug systematically before declaring the signing process proven

### Expected Output

```
target/release/bundle/macos/Sivlo.app
target/release/bundle/dmg/Sivlo_0.4.0_aarch64.dmg
```

(Version and architecture suffixes follow Tauri's naming convention.)

---

## Local Signed Build Dress Rehearsal Plan

### Build Command

```bash
cd frontend
APPLE_SIGNING_IDENTITY="Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)" \
APPLE_API_ISSUER="<ISSUER_UUID>" \
APPLE_API_KEY="<KEY_ID>" \
pnpm tauri build --target aarch64-apple-darwin
```

Updater artifacts remain disabled (`createUpdaterArtifacts: false` in config) for the isolated signing test. The updater signing path is proven separately in Phase 3.

### Expected Artifacts

```
frontend/target/aarch64-apple-darwin/release/bundle/macos/Sivlo.app
frontend/target/aarch64-apple-darwin/release/bundle/dmg/Sivlo_<version>_aarch64.dmg
```

### Verification Steps

1. **codesign verification:**
   ```bash
   codesign --verify --deep --strict --verbose=2 Sivlo.app
   # Expected: no errors, valid signature

   codesign -dv --verbose=4 Sivlo.app
   # Expected: Authority=Developer ID Application, TeamIdentifier=2NHJGX6A7S
   #           Identifier=com.drewsepeczi.sivlo
   ```

2. **Nested binary verification:**
   ```bash
   codesign --verify --verbose=2 Sivlo.app/Contents/MacOS/sivlo
   codesign --verify --verbose=2 Sivlo.app/Contents/MacOS/llama-helper
   codesign --verify --verbose=2 Sivlo.app/Contents/MacOS/ffmpeg
   # Expected: all valid
   ```

3. **Notarization status:** If Tauri-managed notarization succeeds, the app is already notarized. If using manual notarytool, verify status is "Accepted".

4. **Stapling (if applicable):**
   ```bash
   xcrun stapler staple Sivlo.app
   xcrun stapler validate Sivlo.app
   ```

5. **Gatekeeper validation:**
   ```bash
   spctl --assess --type exec --verbose=2 Sivlo.app
   # Expected: accepted, source=Notarized Developer ID
   ```

---

## Task Decomposition

### Task 1 — Signing + Entitlement Audit

**Files:** This plan document only.

**Steps:**
- [x] Read `tauri.conf.json` macOS signing config
- [x] Read `entitlements.plist` and classify every entitlement
- [x] Read `Info.plist` usage descriptions
- [x] Verify `APPLE_SIGNING_IDENTITY` env var overrides `signingIdentity`
- [x] Verify `hardenedRuntime: true` is correct for notarization
- [x] Confirm entitlements are minimum required (no excess privileges)
- [x] Confirm no hardened-runtime exceptions needed
- [x] Audit nested binaries (llama-helper, ffmpeg)
- [x] Verify no unexpected dylibs/frameworks in source tree

**Verification:**
- All signing surfaces classified
- Entitlements are minimum required
- No config changes needed for signing

**Commit:** None (audit only — this plan document)

---

### Task 2 — Developer ID Local Identity Validation

**Files:** No repository files changed. Local verification only.

**Steps:**
- [ ] Verify Developer ID Application certificate exists:
  ```bash
  security find-identity -v -p codesigning | grep "Developer ID Application"
  ```
- [ ] Record the exact identity string for use in Task 4
- [ ] Verify the certificate is valid (not expired, not revoked):
  ```bash
  security find-certificate -c "Developer ID Application" -p | openssl x509 -noout -dates
  ```
- [ ] Verify the Team ID matches expected value: `2NHJGX6A7S`
- [ ] Verify the private key is in the login keychain (not just the certificate):
  ```bash
  security find-identity -v -p codesigning | grep -c "Developer ID Application"
  # Expected: 1 (certificate + private key pair)
  ```
- [ ] **If no valid certificate exists: STOP** — human must create/import Developer ID Application certificate via Apple Developer portal before proceeding

**Verification:**
- Valid Developer ID Application certificate found
- Certificate is not expired
- Private key is present in keychain
- Team ID is `2NHJGX6A7S`

**Commit:** None (verification only)

---

### Task 3 — App Store Connect API Key Human Setup

**Files:** No repository files changed. External human-only action.

**Steps:**
- [ ] Verify App Store Connect TEAM API key exists:
  ```bash
  ls ~/.appstoreconnect/private_keys/AuthKey_*.p8 2>/dev/null
  ```
- [ ] **If `.p8` file does not exist: STOP** — human must:
  1. Log in to [App Store Connect](https://appstoreconnect.apple.com/)
  2. Navigate to Users and Access → Keys → App Store Connect API
  3. Generate a TEAM API key (not individual) with "Developer" access
  4. Download the `.p8` file
  5. Save to `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8`
  6. Set permissions: `chmod 600 ~/.appstoreconnect/private_keys/AuthKey_*.p8`
  7. Record the Key ID and Issuer ID (do NOT paste into any file)
- [ ] Record the Issuer ID (UUID format) for Task 5
- [ ] Record the Key ID for Task 5
- [ ] Verify the `.p8` file is readable:
  ```bash
  head -c 20 ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
  # Expected: starts with "-----BEGIN PRIVATE KEY-----"
  ```
- [ ] Verify `.p8` is NOT in the repository:
  ```bash
  find /path/to/repo -name "*.p8" -not -path "*/.git/*" 2>/dev/null
  # Expected: empty
  ```

**Verification:**
- `.p8` file exists at expected path
- File starts with `-----BEGIN PRIVATE KEY-----`
- File permissions are 600
- `.p8` is not in the repository

**Commit:** None (external setup only)

---

### Task 4 — Local Developer ID Signed App Build

**Files:** No repository files changed. Local build verification.

**Steps:**
- [ ] Set environment variables:
  ```bash
  export APPLE_SIGNING_IDENTITY="Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)"
  ```
- [ ] Build the app (without updater artifacts, without notarization — isolate signing):
  ```bash
  cd frontend
  APPLE_SIGNING_IDENTITY="Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)" \
  pnpm tauri build --target aarch64-apple-darwin
  ```
- [ ] Locate the built `.app`:
  ```bash
  find frontend/target/aarch64-apple-darwin/release/bundle/macos -name "*.app" -type d
  ```
- [ ] Verify main app signature:
  ```bash
  codesign --verify --deep --strict --verbose=2 <Sivlo.app>
  # Expected: valid signature, no errors
  ```
- [ ] Inspect signing details:
  ```bash
  codesign -dv --verbose=4 <Sivlo.app>
  # Expected: Authority=Developer ID Application
  #           TeamIdentifier=2NHJGX6A7S
  #           Identifier=com.drewsepeczi.sivlo
  #           Hardened Runtime=YES
  ```
- [ ] Verify nested binaries:
  ```bash
  codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/sivlo
  codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/llama-helper
  codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/ffmpeg
  # Expected: all valid
  ```
- [ ] Verify the signature is NOT ad-hoc:
  ```bash
  codesign -dv --verbose=4 <Sivlo.app> 2>&1 | grep "Signature"
  # Expected: "Signature is a signed bundle" (NOT "adhoc")
  ```
- [ ] Unset environment after verification:
  ```bash
  unset APPLE_SIGNING_IDENTITY
  ```
- [ ] **Do not proceed to notarization yet** — verify signing is correct first

**Verification:**
- `.app` produced successfully
- Developer ID Application signature (not ad-hoc)
- Correct Team ID (`2NHJGX6A7S`)
- Correct bundle ID (`com.drewsepeczi.sivlo`)
- Hardened runtime enabled
- All nested binaries signed

**Commit:** None (verification only)

---

### Task 5 — Local Apple Notarization

**Files:** No repository files changed. Local notarization verification.

**Prerequisites:** Tasks 2, 3, and 4 must be complete and verified.

**Steps:**
- [ ] Verify API key credentials are available:
  ```bash
  echo "Issuer: ${APPLE_API_ISSUER:-NOT SET}"
  echo "Key ID: ${APPLE_API_KEY:-NOT SET}"
  echo "Key path: ${APPLE_API_KEY_PATH:-~/.appstoreconnect/private_keys}"
  ```
- [ ] Build with notarization credentials (Tauri manages submission):
  ```bash
  cd frontend
  APPLE_SIGNING_IDENTITY="Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)" \
  APPLE_API_ISSUER="<ISSUER_UUID>" \
  APPLE_API_KEY="<KEY_ID>" \
  pnpm tauri build --target aarch64-apple-darwin
  ```
- [ ] If Tauri-managed notarization succeeds: proceed to Task 6
- [ ] If Tauri-managed notarization fails: fall back to manual notarytool:
  ```bash
  # Store credentials in keychain (one-time)
  xcrun notarytool store-credentials "sivlo-notary" \
      --key ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 \
      --key-id <KEY_ID> \
      --issuer <ISSUER_UUID>

  # Submit the .app for notarization
  xcrun notarytool submit <Sivlo.app> \
      --keychain-profile "sivlo-notary" \
      --wait

  # Expected: status = "Accepted"

  # If rejected: retrieve log
  xcrun notarytool log <SUBMISSION_ID> --keychain-profile "sivlo-notary"
  ```
- [ ] Capture notarization status (must be "Accepted")
- [ ] Capture submission ID for audit trail
- [ ] Unset secrets after verification:
  ```bash
  unset APPLE_SIGNING_IDENTITY
  unset APPLE_API_ISSUER
  unset APPLE_API_KEY
  unset APPLE_API_KEY_PATH
  ```

**Verification:**
- Notarization status = "Accepted"
- No notarization rejections
- No entitlements issues reported by notarytool
- Credentials not leaked in build output

**Commit:** None (verification only)

---

### Task 6 — Stapling Verification

**Files:** No repository files changed. Local verification.

**Steps:**
- [ ] Check if Tauri automatically stapled the `.app`:
  ```bash
  xcrun stapler validate <Sivlo.app>
  # Expected: "The validate action worked!"
  ```
- [ ] If not stapled, manually staple:
  ```bash
  xcrun stapler staple <Sivlo.app>
  xcrun stapler validate <Sivlo.app>
  ```
- [ ] If `.dmg` was produced, attempt stapling:
  ```bash
  xcrun stapler staple <Sivlo.dmg>
  xcrun stapler validate <Sivlo.dmg>
  ```
- [ ] Note: DMG stapling may not be supported or necessary — if it fails, document that the `.app` inside the DMG is stapled

**Verification:**
- Stapler validation succeeds for `.app`
- Stapler validation succeeds for `.dmg` (if supported)

**Commit:** None (verification only)

---

### Task 7 — DMG Generation Investigation

**Files:** No repository files changed. Investigation and debugging.

**Steps:**
- [ ] If DMG was produced in Task 4/5: verify it is not corrupted:
  ```bash
  hdiutil verify <Sivlo.dmg>
  ```
- [ ] If DMG was NOT produced or failed:
  1. Re-run with verbose output:
     ```bash
     cd frontend
     APPLE_SIGNING_IDENTITY="Developer ID Application: ANDREW DOUGLAS SEPECZI (2NHJGX6A7S)" \
     pnpm tauri build --target aarch64-apple-darwin 2>&1 | tee /tmp/tauri-build.log
     ```
  2. Search for DMG-related errors:
     ```bash
     grep -i "dmg\|hdiutil\|create-dmg\|bundle_dmg" /tmp/tauri-build.log
     ```
  3. Check if `create-dmg` is installed:
     ```bash
     which create-dmg
     ```
  4. If missing: `brew install create-dmg`
  5. Re-run the build and check if DMG is produced
  6. If DMG still fails: investigate whether the issue is:
     - Code signing conflict during DMG packaging
     - Insufficient disk space
     - Path issue with `.app` bundle
     - Tauri bundler DMG template issue
- [ ] Document the exact cause and resolution (if any)

**Verification:**
- DMG is produced or the exact failure reason is documented
- If DMG is produced, it passes `hdiutil verify`

**Commit:** None (investigation only)

---

### Task 8 — Gatekeeper / Install Verification

**Files:** No repository files changed. Local verification.

**Steps:**
- [ ] Gatekeeper validation on the `.app`:
  ```bash
  spctl --assess --type exec --verbose=2 <Sivlo.app>
  # Expected: source=Notarized Developer ID, accepted
  ```
- [ ] Gatekeeper validation on the `.dmg` (if produced):
  ```bash
  spctl --assess --type open --context context:primary-signature --verbose=2 <Sivlo.dmg>
  ```
- [ ] Copy `.app` to a test location (outside build directory) to simulate user experience:
  ```bash
  cp -r <Sivlo.app> /tmp/Sivlo-test.app
  spctl --assess --type exec --verbose=2 /tmp/Sivlo-test.app
  ```
- [ ] Verify the app launches (smoke test):
  ```bash
  open /tmp/Sivlo-test.app
  # Verify: app opens, no Gatekeeper block, microphone permission prompt appears
  ```
- [ ] Clean up test artifacts:
  ```bash
  rm -rf /tmp/Sivlo-test.app
  ```

**Verification:**
- Gatekeeper accepts the app
- App launches without security warnings
- Microphone permission prompt appears on first launch
- No ad-hoc signature artifacts

**Commit:** None (verification only)

---

### Task 9 — Secret Safety + Static Audit

**Files:** No repository files changed. Security audit.

**Steps:**
- [ ] Verify no `.p12` files in the repository:
  ```bash
  find /path/to/repo -name "*.p12" -not -path "*/.git/*" 2>/dev/null
  # Expected: empty
  ```
- [ ] Verify no `.p8` files in the repository:
  ```bash
  find /path/to/repo -name "*.p8" -not -path "*/.git/*" 2>/dev/null
  # Expected: empty
  ```
- [ ] Verify no `AuthKey_*` files in the repository:
  ```bash
  find /path/to/repo -name "AuthKey_*" -not -path "*/.git/*" 2>/dev/null
  # Expected: empty
  ```
- [ ] Verify no secret variable values appear in committed code:
  ```bash
  rg -n 'APPLE_CERTIFICATE_PASSWORD|KEYCHAIN_PASSWORD|APPLE_API_ISSUER|APPLE_API_KEY_PATH|PRIVATE_KEY' \
    --glob '!docs/superpowers/**' \
    --glob '!.github/**' \
    frontend/src-tauri/
  # Expected: zero matches (variable NAMES in docs are allowed; values forbidden)
  ```
- [ ] Verify `.gitignore` coverage:
  ```bash
  grep -n '\.p12\|\.p8\|\.key' /path/to/repo/.gitignore
  # Expected: patterns exist for sensitive file types
  ```
- [ ] Verify Phase 3 updater config is unchanged:
  ```bash
  git diff -- frontend/src-tauri/tauri.conf.json
  # Expected: no changes to updater pubkey or endpoints
  ```
- [ ] If any secret material is found in the repository: **STOP immediately** and report the path only

**Verification:**
- No `.p12`, `.p8`, or `AuthKey_*` files in repo
- No secret variable values in committed code
- `.gitignore` covers sensitive file types
- Phase 3 updater config unchanged

**Commit:** None (audit only)

---

### Task 10 — Full Phase 4 Verification

**Files:** No repository files changed. Full verification pass.

**Steps:**

**A. Developer ID certificate:**
- [ ] `security find-identity -v -p codesigning | grep "Developer ID Application"` — valid identity found
- [ ] Certificate not expired: `security find-certificate -c "Developer ID Application" -p | openssl x509 -noout -dates`

**B. App Store Connect API key:**
- [ ] `.p8` file exists at `~/.appstoreconnect/private_keys/AuthKey_*.p8`
- [ ] `.p8` file not in repository

**C. Signed app produced:**
- [ ] `.app` exists in `frontend/target/aarch64-apple-darwin/release/bundle/macos/`
- [ ] `codesign --verify --deep --strict --verbose=2 <Sivlo.app>` — valid
- [ ] `codesign -dv --verbose=4 <Sivlo.app>` — Developer ID Application, Team ID `2NHJGX6A7S`, bundle ID `com.drewsepeczi.sivlo`

**D. Nested binaries signed:**
- [ ] `codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/sivlo` — valid
- [ ] `codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/llama-helper` — valid
- [ ] `codesign --verify --verbose=2 <Sivlo.app>/Contents/MacOS/ffmpeg` — valid

**E. Hardened runtime + entitlements:**
- [ ] `codesign -dv --verbose=4 <Sivlo.app>` — Hardened Runtime=YES
- [ ] Entitlements match `entitlements.plist` (audio-input, audio-output, microphone, screen-capture)

**F. Notarization:**
- [ ] Notarization status = "Accepted" (either Tauri-managed or manual notarytool)
- [ ] Stapling validation succeeds: `xcrun stapler validate <Sivlo.app>`

**G. Gatekeeper:**
- [ ] `spctl --assess --type exec --verbose=2 <Sivlo.app>` — accepted, source=Notarized Developer ID

**H. DMG:**
- [ ] `.dmg` produced (or failure reason documented)
- [ ] `hdiutil verify <Sivlo.dmg>` — passes (if DMG produced)

**I. Clean install test:**
- [ ] `.app` copied to `/tmp/` and launched successfully
- [ ] No Gatekeeper security warnings
- [ ] Microphone permission prompt appeared

**J. Secret safety:**
- [ ] No `.p12` in repo
- [ ] No `.p8` in repo
- [ ] No `AuthKey_*` in repo
- [ ] No secret values in committed code

**K. Phase 3 preservation:**
- [ ] Updater pubkey unchanged in `tauri.conf.json`
- [ ] `createUpdaterArtifacts: false` unchanged
- [ ] No inherited Meetily updater references reintroduced

**L. App tests remain green:**
- [ ] `cd frontend && pnpm build` — passes
- [ ] `cd frontend && pnpm lint` — passes (if configured)
- [ ] `cd frontend/src-tauri && cargo check` — passes
- [ ] `cd frontend/src-tauri && cargo test` — passes

**M. Git hygiene:**
- [ ] `git status` — clean (only this plan file changed)
- [ ] `git diff --check` — no whitespace errors

**N. No scope leakage:**
- [ ] No GitHub Actions workflow changes
- [ ] No version bumps
- [ ] No public release created
- [ ] No updater config changes
- [ ] No Phase 5 implementation

---

## Phase 4 Acceptance Gate

All of the following must be true before Phase 5 begins:

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Valid Developer ID Application identity available | `security find-identity -v -p codesigning` shows valid identity |
| 2 | Team App Store Connect API key available securely | `~/.appstoreconnect/private_keys/AuthKey_*.p8` exists |
| 3 | Signed Sivlo.app produced | `.app` exists in bundle output |
| 4 | No ad-hoc signature for production dress rehearsal | `codesign -dv` shows Developer ID, not "adhoc" |
| 5 | Nested executables correctly signed | `codesign --verify` passes for sivlo, llama-helper, ffmpeg |
| 6 | codesign verification succeeds | `codesign --verify --deep --strict` exits 0 |
| 7 | Notarization status = Accepted | notarytool confirms "Accepted" |
| 8 | Stapling validation succeeds | `xcrun stapler validate` exits 0 |
| 9 | Gatekeeper accepts app | `spctl --assess` exits 0 |
| 10 | DMG generation succeeds | `.dmg` produced (or failure documented) |
| 11 | Clean install-style launch succeeds | App launches from `/tmp/` without Gatekeeper warnings |
| 12 | Private certificate material absent from repo | No `.p12` files found |
| 13 | `.p8` absent from repo | No `.p8` files found |
| 14 | Updater private key still absent from repo | No updater key files found |
| 15 | Phase 3 updater config unchanged | `git diff` shows no updater changes |
| 16 | `pnpm build` green | Exits 0 |
| 17 | `cargo check` green | Exits 0 |
| 18 | `cargo test` green | Passes |
| 19 | `git diff --check` clean | No whitespace errors |

No GitHub Actions required yet.

---

## Phase 5+ Non-Goals

Do NOT plan implementation of:

- GitHub Actions release matrix
- Certificate import into CI keychain
- GitHub secret creation
- Intel CI build
- Release-repo publication
- `latest.json`
- PAT
- GitHub Release
- `v0.1.0` tag
- Public beta publication

Phase 4 should produce the locally proven recipe that Phase 5 automates.

---

## Self-Review Checklist

| Property | Status |
|----------|--------|
| Exact current Tauri syntax verified | `signingIdentity`, `hardenedRuntime`, `entitlements` — all verified against tauri-cli 2.10.1 and Tauri 2 config reference |
| Exact current Apple tool syntax verified | `codesign`, `spctl`, `xcrun notarytool`, `xcrun stapler` — all verified via `--help` output on macOS |
| Team API key requirement | `APPLE_API_ISSUER` + `APPLE_API_KEY` + `APPLE_API_KEY_PATH` — documented per Tauri environment variables reference |
| No individual-key/notarytool mismatch | Plan specifies TEAM API key; no individual Apple ID auth for production |
| No secret values in plan | Only variable NAMES and path patterns appear; no actual key IDs, issuer UUIDs, or `.p8` contents |
| Human-only credential boundaries | Tasks 2, 3 have explicit STOP gates for missing credentials |
| Minimal entitlements | Four entitlements, all necessary for core functionality, no hardened-runtime exceptions |
| Nested binary signing | llama-helper and ffmpeg sidecars verified; Tauri signs them automatically |
| Hardened runtime | Already enabled in config; compatible with all entitlements |
| DMG failure accounted for | Task 7 explicitly investigates DMG generation failure |
| No Phase 5 leakage | All CI workflow changes explicitly deferred |
| Every acceptance item mapped to concrete verification | 19-item acceptance gate with specific commands |
| Interaction with updater signing | Phase 3 updater config preserved; no confusion between Apple signing and Tauri updater signing |

---

## Working Tree

- Branch: `main`
- Status: clean (only this plan file will be added)
- No production implementation changed
- No signing configuration modified
- No credentials committed
