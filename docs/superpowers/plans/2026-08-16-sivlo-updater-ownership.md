# Sivlo Updater Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inherited Meetily updater ownership with a Sivlo-specific updater trust chain and prepare the app to accept only Sivlo-authorized updates.

**Architecture:** Generate a new Tauri updater signing keypair for Sivlo, embed only the public key in production configuration, keep the private key outside the repository, replace inherited updater endpoints with Sivlo-owned release infrastructure, and verify updater artifacts/signatures locally without publishing a production release.

**Tech Stack:** Tauri 2 updater plugin (tauri-plugin-updater 2.3.0), Tauri updater signing (tauri-cli 2.10.1), Rust/Tauri configuration, GitHub Releases static updater metadata.

## Global Constraints

- Product: Sivlo
- Bundle ID: com.drewsepeczi.sivlo
- Updater private key must never be committed.
- Updater private key must have a secure offline backup.
- Only the updater public key may be committed.
- No inherited Meetily updater key may remain active.
- No inherited Meetily update endpoint may remain active.
- Public release repository target: drewsephski/sivlo-releases
- Automatic updates are included in v0.1.0.
- Updates require user approval; no silent updates.
- Do not implement Developer ID signing or notarization in Phase 3.
- Do not implement GitHub Actions publishing in Phase 3.
- Do not publish a production release in Phase 3.
- Do not bump app version in Phase 3 unless the approved roadmap explicitly requires it.
- Use small, reviewable commits.

---

## File Map

| File | Current role | Phase 3 action |
|------|-------------|----------------|
| `frontend/src-tauri/tauri.conf.json` | Contains inherited Meetily pubkey + endpoint; `createUpdaterArtifacts: true` | Replace pubkey, remove endpoint, adjust artifact config |
| `frontend/src-tauri/Cargo.toml` | Declares `tauri-plugin-updater = "2.3.0"` | No change (dependency already correct) |
| `frontend/package.json` | Declares `@tauri-apps/plugin-updater: ^2.3.0` | No change |
| `frontend/src/services/updateService.ts` | Update check/download/install service | No change (UI scope preserved) |
| `frontend/src/components/UpdateDialog.tsx` | Update dialog UI | No change |
| `frontend/src/components/UpdateCheckProvider.tsx` | Update check orchestration | No change |
| `frontend/src/components/UpdateNotification.tsx` | Toast notification for updates | No change |
| `frontend/src/hooks/useUpdateCheck.ts` | React hook for update checking | No change |
| `frontend/src-tauri/src/lib.rs:410` | Registers `tauri_plugin_updater` | No change |
| `frontend/src-tauri/src/tray.rs:210` | Tray menu "Check for Updates" dispatches event | No change |
| `frontend/src-tauri/.gitignore` | Cargo-generated ignores | No change |
| `.gitignore` | Repo-level ignores | Add `*.key` pattern if not already covered |

No new files are created in the repository beyond the plan itself. The updater private key lives outside the repository.

---

## Current Updater Audit

### Updater Configuration (`frontend/src-tauri/tauri.conf.json:115-122`)

```json
"plugins": {
    "updater": {
        "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVDQTYzMUQ3ODc5N0M4MkEKUldRcXlKZUgxekdtN09DRkVWSHNpZlJseEVOUmpNd1dDSTNaLzZ3MXJGTnY3WW1pdnlOYjBpbkIK",
        "endpoints": [
            "https://github.com/Zackriya-Solutions/meeting-minutes/releases/latest/download/latest.json"
        ]
    }
}
```

**Public key (base64-decoded header):** `trusted comment: minisign public key: ECA631D78797C82A` — this is Meetily's upstream minisign public key, **not** Sivlo's.

**Endpoint:** `https://github.com/Zackriya-Solutions/meeting-minutes/releases/latest/download/latest.json` — this is Meetily's upstream GitHub Releases endpoint.

**Classification: INHERITED_UPSTREAM — both must be replaced.**

### Updater Artifact Config (`frontend/src-tauri/tauri.conf.json:92`)

```json
"createUpdaterArtifacts": true
```

**Classification: ACTIVE_UPDATER_CONFIG**

This setting tells Tauri's bundler to produce `.app.tar.gz` + `.app.tar.gz.sig` updater artifacts alongside DMGs during `tauri build`. The current local-build error ("A public key has been found, but no private key") is caused by this: the config has a public key (Meetily's) but the matching private key is not available locally, so `tauri build` fails when it tries to sign updater artifacts.

### Root Cause of Local Build Error

**Exact cause:** `createUpdaterArtifacts: true` + a `pubkey` in config = Tauri CLI requires `TAURI_SIGNING_PRIVATE_KEY` env var (or `--signing-key` flag) during `tauri build`. Since the private key was never in this repository, local release builds fail. This is **correct behavior** — the fix is not to disable signing but to handle dev vs production builds differently.

### Updater Plugin Registration

- **Rust side:** `frontend/src-tauri/src/lib.rs:410` — `.plugin(tauri_plugin_updater::Builder::new().build())`
- **Capability:** `frontend/src-tauri/tauri.conf.json:67` — `"updater:default"` in main window permissions
- **Dependency:** `frontend/src-tauri/Cargo.toml:155` — `tauri-plugin-updater = "2.3.0"`
- **Frontend package:** `frontend/package.json:65` — `@tauri-apps/plugin-updater: ^2.3.0`

**Classification: ACTIVE_UPDATER_CONFIG — all correct, no changes needed.**

### Updater UI Surface

| File | Role | Classification |
|------|------|----------------|
| `frontend/src/services/updateService.ts` | Singleton service; calls `check()` from `@tauri-apps/plugin-updater` | UPDATER_UI |
| `frontend/src/components/UpdateDialog.tsx` | Download/install dialog with progress | UPDATER_UI |
| `frontend/src/components/UpdateCheckProvider.tsx` | Context provider; orchestrates check + notification + dialog | UPDATER_UI |
| `frontend/src/components/UpdateNotification.tsx` | Toast notification showing "Update Available" | UPDATER_UI |
| `frontend/src/hooks/useUpdateCheck.ts` | React hook wrapping the update service | UPDATER_UI |
| `frontend/src/components/About.tsx:27` | "Check for Updates" button in About screen | UPDATER_UI |
| `frontend/src-tauri/src/tray.rs:210` | Tray menu dispatches `check-updates-from-tray` event | UPDATER_COMMAND |

**All UI code is upstream-neutral** — it calls generic Tauri updater APIs and does not reference Meetily by name. No changes needed in Phase 3.

### Inherited Meetily References (Non-Updater)

These are **not** updater-related but noted for awareness. They are OUT OF SCOPE for Phase 3:

| File | Reference | Classification |
|------|-----------|----------------|
| `frontend/src-tauri/Cargo.toml:2` | `name = "meetily"` | INHERITED_UPSTREAM (crate name, not updater) |
| `frontend/src-tauri/Cargo.toml:7` | `repository = "https://github.com/Zackriya-Solutions/meeting-minutes"` | INHERITED_UPSTREAM |
| `frontend/src-tauri/build/ffmpeg.rs:129-144` | Meetily ffmpeg binary download URLs | INHERITED_UPSTREAM |
| `frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs:598` | Meetily model download URL | INHERITED_UPSTREAM |
| `frontend/src-tauri/src/lib_old_complex.rs:1472,1742` | "Meetily" window/notification titles | DEAD_CODE |
| `frontend/src/components/Sidebar/index.tsx:734` | "Meetily" branding in sidebar | INHERITED_UPSTREAM |
| `frontend/src/components/DatabaseImport/*` | Legacy import UI referencing Meetily | PRESERVED_LEGACY |
| `frontend/src/components/AnalyticsConsentSwitch.tsx:150` | Meetily privacy policy URL | INHERITED_UPSTREAM |
| `frontend/src/components/BluetoothPlaybackWarning.tsx:84` | Meetily URL | INHERITED_UPSTREAM |
| `frontend/src-tauri/src/audio/decoder.rs:294` | `.meetily_decode_` temp prefix | INHERITED_UPSTREAM |
| `frontend/src-tauri/src/audio/capture/core_audio.rs:139` | `meetily-audio-tap` string | INHERITED_UPSTREAM |

---

## Keypair Generation Procedure

### Tool

Installed Tauri CLI: `tauri-cli 2.10.1`

Key generation command:

```bash
cargo tauri signer generate -w /secure/path/to/sivlo-updater.key -p '<PASSWORD>' --ci
```

Flags:
- `-w <path>`: Write private key to file (otherwise prints to stdout)
- `-p <password>`: Encrypt the private key with a password
- `--ci`: Non-interactive mode (no prompts)

The command outputs:
1. The **private key** written to the specified file path
2. The **public key** printed to stdout (base64-encoded minisign public key)

### Expected Output

The public key output looks like:

```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IE ...
```

This base64 string is what goes into `tauri.conf.json` under `plugins.updater.pubkey`.

### Safety Requirements

1. Generate the key to a path **outside** the repository (e.g., `~/.sivlo-keys/sivlo-updater.key`)
2. Set file permissions to owner-only: `chmod 600 /secure/path/to/sivlo-updater.key`
3. **Never** echo/log the private key contents
4. **Never** commit the private key file
5. Verify `git status` after generation shows no new tracked files for the key
6. Store the password separately from the key file
7. Create a secure offline backup of both key file and password

### Post-Generation Verification

```bash
# Verify key is NOT in the repo
git status  # should show NO new files in the repo
find /path/to/repo -name "*.key" -o -name "*sivlo*private*" 2>/dev/null  # should return nothing

# Verify public key is valid base64
echo '<PUBLIC_KEY_BASE64>' | base64 -d | head -c 20  # should show readable header
```

---

## Private Key Storage Policy

### Storage Location

The private key file lives at a developer-controlled secure location **outside** the repository:

```
~/.sivlo-keys/sivlo-updater.key
```

The key password is stored in the developer's password manager (not in any file alongside the key).

### GitHub Actions Secrets (Future Phase 5)

When CI is configured later:
- `TAURI_SIGNING_PRIVATE_KEY`: The private key file contents (base64 or raw)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: The password used during key generation

These are set in GitHub repository secrets for the **private source repository**, never the public release repository.

### Repository Exclusion Verification

After key generation, run:

```bash
# Verify no key material exists anywhere in the repo
find /path/to/repo -type f \( -name "*.key" -o -name "*.pem" -o -name "*signing*" -o -name "*private*" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/target/*" 2>/dev/null
# Expected: empty output (no matches)

# Also verify .gitignore coverage
grep -n '\.key' /path/to/repo/.gitignore 2>/dev/null
# Expected: '*.pem' exists at line 31; add '*.key' if not present
```

The root `.gitignore` already has `*.pem` (line 31). A `*.key` pattern should be added for belt-and-suspenders safety, though the key will live outside the repo entirely.

### Key Rotation / Loss Policy

Once v0.1.0 ships trusting this public key:

- **Losing the private key** means future updates signed by a replacement key cannot be authenticated by installed clients without an application update path. The installed app only trusts one public key.
- **Do not regenerate** the key casually after shipping v0.1.0.
- **Do not rotate** before defining a migration strategy (which would require shipping a new app version that trusts both old and new keys).
- **Never overwrite** release binaries with different signatures for the same version.
- If the key is compromised, ship a new version immediately with a new key and a hard cutoff for the old update channel.

No complex rotation implementation is planned for Phase 3.

---

## Updater Endpoint Configuration

### Current State

The endpoint points to Meetily's upstream GitHub Releases:

```
https://github.com/Zackriya-Solutions/meeting-minutes/releases/latest/download/latest.json
```

### Target State

The production endpoint will eventually be:

```
https://github.com/drewsephski/sivlo-releases/releases/latest/download/latest.json
```

### Phase 3 Decision

The `drewsephski/sivlo-releases` public repository does not exist yet (created in Phase 6). The `latest.json` file does not exist yet (generated in Phase 7).

**Phase 3 approach:**

1. **Remove** the inherited Meetily endpoint
2. **Do not** add the final Sivlo endpoint yet (it would 404)
3. Set **no endpoints** in the updater config — the updater plugin degrades gracefully: it simply finds no update

This is **safer** than leaving a Meetily endpoint as a temporary fallback. The app functions normally; it just does not check for updates until the endpoint is configured in Phase 7.

**Alternative considered:** Setting the Sivlo endpoint early even though it 404s. Rejected because a 404 on every app launch is noisy in logs and could confuse debugging. An empty endpoint list means "update checking disabled" cleanly.

The endpoint will be added in Phase 7 when `latest.json` generation is ready.

---

## Artifact Signing Configuration

### Current Problem

`createUpdaterArtifacts: true` in `tauri.conf.json` means every `tauri build` attempt requires `TAURI_SIGNING_PRIVATE_KEY`. This breaks local release builds without the key.

### Solution: `--config` Override

Tauri 2 supports a `--config` flag on `tauri build` that merges JSON via RFC 7396 (JSON Merge Patch). The approach:

1. **Base config** (`tauri.conf.json`): Set `createUpdaterArtifacts: false`
2. **CI release builds**: Pass `--config '{"bundle":{"createUpdaterArtifacts":true}}'` to `tauri build`
3. **Local dev** (`pnpm run tauri:dev`): No signing needed; dev mode does not produce updater artifacts
4. **Local test builds** (`pnpm run tauri:build`): Without the override, no updater artifacts are produced — build succeeds without signing keys

This cleanly separates:
- **Development/local:** No signing secrets required
- **Production CI:** Signing secrets provided via environment, artifact creation enabled via config override

### Why Not Environment-Specific Config Files

Tauri supports platform overlays (`tauri.macos.conf.json`, etc.) but not environment overlays (`tauri.release.conf.json`). Using `--config` is the documented Tauri 2 mechanism for build-flavor overrides and is the simplest approach.

---

## Task Decomposition

### Task 1 — Updater Ownership Audit (Documentation Only)

**Files:** This plan document only.

**Steps:**
- [x] Read `tauri.conf.json` updater section
- [x] Decode/identify the current public key as Meetily's
- [x] Identify the endpoint as Meetily's GitHub Releases
- [x] Verify `createUpdaterArtifacts: true` is active
- [x] Trace the local-build error root cause
- [x] Audit all updater-related frontend and Rust code
- [x] Classify every surface (see audit table above)
- [x] Confirm no Sivlo-specific updater configuration exists yet

**Verification:**
- All updater surfaces classified
- Inherited Meetily pubkey and endpoint identified
- No private key exists in the repository

**Commit:** `docs: plan Sivlo updater ownership`

---

### Task 2 — Safe Sivlo Updater Keypair Generation

**Files:** No repository files changed. Key generated outside repository.

**Steps:**
- [ ] Create secure directory: `mkdir -p ~/.sivlo-keys && chmod 700 ~/.sivlo-keys`
- [ ] Generate keypair:
  ```bash
  cd /path/to/repo/frontend
  cargo tauri signer generate \
    -w ~/.sivlo-keys/sivlo-updater.key \
    -p '<CHOSEN_PASSWORD>' \
    --ci
  ```
- [ ] Capture the public key from stdout (base64 string)
- [ ] Set key file permissions: `chmod 600 ~/.sivlo-keys/sivlo-updater.key`
- [ ] Verify key file exists: `ls -la ~/.sivlo-keys/sivlo-updater.key`
- [ ] Verify no repo changes: `git status` — should show no new/modified tracked files
- [ ] Verify key not in repo: `find /path/to/repo -name "sivlo-updater.key" 2>/dev/null` — empty
- [ ] Verify key not in shell history: `history | grep -i 'signer generate'` — note: history will contain the command but NOT the key contents (key was written to file via `-w` flag, not printed)
- [ ] Record public key value for Task 3
- [ ] Document offline backup responsibility (separate secure storage of both key file and password)

**Verification:**
- `~/.sivlo-keys/sivlo-updater.key` exists with mode `600`
- Public key is valid base64 starting with `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6`
- `git status` shows no new files in the repository
- No private key material appears in any repository file

**Commit:** None (no repository changes)

---

### Task 3 — Public Key + Updater Ownership Configuration

**Files:** `frontend/src-tauri/tauri.conf.json`

**Steps:**
- [ ] Replace the `plugins.updater.pubkey` value with the new Sivlo public key from Task 2
- [ ] Remove the `plugins.updater.endpoints` array entirely (no production endpoint exists yet)
- [ ] Set `bundle.createUpdaterArtifacts` to `false` (CI override will re-enable)
- [ ] Add `"*.key"` to root `.gitignore` if not already present

**Expected diff in `tauri.conf.json`:**

```diff
     "bundle": {
         "active": true,
         ...
-        "createUpdaterArtifacts": true,
+        "createUpdaterArtifacts": false,
         ...
     },
     "plugins": {
         "updater": {
-            "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVDQTYzMUQ3ODc5N0M4MkEKUldRcXlKZUgxekdtN09DRkVWSHNpZlJseEVOUmpNd1dDSTNaLzZ3MXJGTnY3WW1pdnlOYjBpbkIK",
-            "endpoints": [
-                "https://github.com/Zackriya-Solutions/meeting-minutes/releases/latest/download/latest.json"
-            ]
+            "pubkey": "<NEW_SIVLO_PUBLIC_KEY>",
+            "endpoints": []
         }
     }
```

**Verification:**
- `cat frontend/src-tauri/tauri.conf.json | python3 -m json.tool` — valid JSON
- `grep -c 'Zackriya\|meeting-minutes' frontend/src-tauri/tauri.conf.json` — returns `0`
- `grep -c 'ECA631D78797C82A' frontend/src-tauri/tauri.conf.json` — returns `0` (old Meetily key gone)
- New public key is present and syntactically valid base64
- `createUpdaterArtifacts` is `false`
- `git diff -- frontend/src-tauri/tauri.conf.json` shows the expected changes

**Commit:** `chore(updater): replace Meetily updater config with Sivlo public key`

---

### Task 4 — Local Dev vs Release Artifact Signing Separation

**Files:** `frontend/src-tauri/tauri.conf.json` (already changed in Task 3), build scripts documentation.

**Steps:**
- [ ] Verify `tauri dev` works without signing secrets:
  ```bash
  cd frontend && pnpm run tauri:dev
  ```
  Expected: app launches, updater plugin loads, no signing errors.

- [ ] Verify `tauri build` works without signing secrets (since `createUpdaterArtifacts: false`):
  ```bash
  cd frontend && unset TAURI_SIGNING_PRIVATE_KEY && pnpm run tauri:build
  ```
  Expected: build completes, no `.sig` files produced, no signing errors.

- [ ] Verify CI override produces updater artifacts when key is supplied:
  ```bash
  cd frontend
  export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.sivlo-keys/sivlo-updater.key)
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<CHOSEN_PASSWORD>'
  pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":true}}'
  ```
  Expected: build completes, `.sig` files are produced alongside `.app.tar.gz` files.

- [ ] Unset secrets after test:
  ```bash
  unset TAURI_SIGNING_PRIVATE_KEY
  unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  ```

- [ ] Verify no secret leakage in build output or artifacts:
  ```bash
  grep -r 'TAURI_SIGNING_PRIVATE_KEY' /path/to/repo/frontend/target/ 2>/dev/null | head -5
  # Expected: no matches (or only binary matches of env var NAME, not value)
  ```

**Verification:**
- `pnpm run tauri:dev` launches without errors
- `pnpm run tauri:build` succeeds without signing secrets
- CI-style build with `--config` override succeeds and produces `.sig` files
- No private key material in build artifacts

**Commit:** None (verification only; no new files)

---

### Task 5 — Local Signing / Verification Dress Rehearsal

**Files:** No repository files changed. Local test only.

**Steps:**
- [ ] Set signing environment:
  ```bash
  export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.sivlo-keys/sivlo-updater.key)
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<CHOSEN_PASSWORD>'
  ```

- [ ] Build with updater artifacts:
  ```bash
  cd /path/to/repo/frontend
  pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":true}}'
  ```

- [ ] Locate the generated updater artifacts:
  ```bash
  find frontend/target/release/bundle -name "*.app.tar.gz" -o -name "*.app.tar.gz.sig" 2>/dev/null
  ```

- [ ] Verify `.sig` file exists and is non-empty:
  ```bash
  ls -la <path-to>.sig
  ```

- [ ] Verify the signature against the embedded public key using the Tauri CLI:
  ```bash
  cargo tauri signer sign \
    -k "$TAURI_SIGNING_PRIVATE_KEY" \
    -p "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" \
    <path-to>.app.tar.gz
  # This should produce a .sig file (or confirm existing one is valid)
  ```

- [ ] Compare the generated signature file content with the existing `.sig`:
  ```bash
  diff <(cat <existing>.sig) <(cat <new>.sig)
  # Should match if same key and same artifact
  ```

- [ ] Unset secrets:
  ```bash
  unset TAURI_SIGNING_PRIVATE_KEY
  unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  ```

- [ ] Clean up test build artifacts:
  ```bash
  rm -f frontend/target/release/bundle/**/*.sig
  rm -f frontend/target/release/bundle/**/*.app.tar.gz
  ```

- [ ] Verify no private key remains in the repo:
  ```bash
  find /path/to/repo -type f -name "*.key" -not -path "*/.git/*" 2>/dev/null
  # Expected: empty
  ```

**Verification:**
- `.sig` file generated successfully
- Signature is valid for the artifact
- Private key not committed or left in build artifacts
- Environment secrets unset

**Commit:** None (verification only)

---

### Task 6 — Static Updater Security Audit + Documentation

**Files:** This plan document (appendix below) or a separate audit note if preferred.

**Steps:**
- [ ] Verify updater plugin loads without errors in `tauri dev`
- [ ] Verify the embedded public key is parsed by the updater plugin (check Rust logs for any pubkey parsing errors)
- [ ] Verify `updateService.ts` `check()` call handles empty endpoints gracefully (no crash, silent failure)
- [ ] Verify the `UpdateDialog` and `UpdateCheckProvider` handle update-check errors without crashing the app
- [ ] Verify the tray "Check for Updates" menu item works without errors
- [ ] Confirm the CSP `connect-src` in `tauri.conf.json` does not need updating (updater uses its own HTTP client, not the webview CSP)
- [ ] Confirm no Meetily-branded updater UI exists (all UI is generic Tauri updater API)
- [ ] Document the updater trust chain in a code comment or README section:
  - App trusts one public key (Sivlo's)
  - Updates must be signed with the corresponding private key
  - Endpoints will point to `drewsephski/sivlo-releases` (Phase 7)
  - No Meetily infrastructure is referenced

**Verification:**
- App launches and updater plugin initializes without errors
- Update check gracefully handles empty endpoint list
- No Meetily references in updater config or UI
- Trust chain documented

**Commit:** `docs(updater): document Sivlo updater trust chain`

---

### Task 7 — Full Phase 3 Verification

**Files:** No repository files changed. Full verification pass.

**Steps:**

**A. Inherited Meetily updater removal:**
- [ ] `grep -n 'Zackriya\|meeting-minutes' frontend/src-tauri/tauri.conf.json` — returns `0` matches
- [ ] `grep -n 'ECA631D78797C82A' frontend/src-tauri/tauri.conf.json` — returns `0` matches
- [ ] `grep -n 'releases/latest/download/latest.json' frontend/src-tauri/tauri.conf.json` — returns `0` matches

**B. Sivlo public key committed:**
- [ ] `grep -c 'pubkey' frontend/src-tauri/tauri.conf.json` — returns `1`
- [ ] Public key value is valid base64: `echo '<PUBKEY>' | base64 -d | head -c 30`

**C. Updater private key absent from repo:**
- [ ] `find /path/to/repo -type f -name "*.key" -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/target/*" 2>/dev/null` — empty
- [ ] `git ls-files | grep -i 'key\|private\|signing'` — no matches

**D. Config validity:**
- [ ] `cat frontend/src-tauri/tauri.conf.json | python3 -m json.tool > /dev/null` — exits 0

**E. Local dev works without signing secrets:**
- [ ] `unset TAURI_SIGNING_PRIVATE_KEY && pnpm run tauri:dev` — app launches

**F. Production-style build succeeds with signing:**
- [ ] Build with `--config` override produces `.sig` files
- [ ] Signature validates against the embedded public key

**G. App tests remain green:**
- [ ] `cd frontend && pnpm test` — passes (if tests exist)
- [ ] `cd frontend && pnpm build` — succeeds
- [ ] `cd frontend && pnpm lint` — passes (if configured)
- [ ] `cd frontend/src-tauri && cargo check` — succeeds
- [ ] `cd frontend/src-tauri && cargo test` — passes (if tests exist)

**H. Git hygiene:**
- [ ] `git status` — clean (only the plan + config + gitignore changes committed)
- [ ] `git diff --check` — no whitespace errors
- [ ] `git log --oneline -5` — shows the Phase 3 commits

**I. No scope leakage:**
- [ ] No Apple signing/notarization config changes
- [ ] No GitHub Actions workflow changes
- [ ] No version bumps
- [ ] No new release repository created
- [ ] No `latest.json` generated
- [ ] No update UI changes

---

## Phase 3 Acceptance Gate

All of the following must be true before Phase 4 begins:

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | New Sivlo updater keypair created | `~/.sivlo-keys/sivlo-updater.key` exists |
| 2 | Private key stored outside repository | File path is `~/.sivlo-keys/`, not under repo root |
| 3 | Secure offline backup responsibility documented | Plan or commit message records backup duty |
| 4 | Only public key committed | `git ls-files | grep -i key` shows no private key |
| 5 | Inherited Meetily updater pubkey removed | `grep 'ECA631D78797C82A' tauri.conf.json` returns nothing |
| 6 | Inherited Meetily updater endpoint removed | `grep 'Zackriya' tauri.conf.json` returns nothing |
| 7 | Tauri config valid JSON | `python3 -m json.tool tauri.conf.json` exits 0 |
| 8 | `tauri dev` works without private key | App launches, updater plugin initializes |
| 9 | `tauri build` works without signing secrets | Build succeeds with `createUpdaterArtifacts: false` |
| 10 | Updater artifacts generated when key supplied | `.sig` files produced with `--config` override |
| 11 | Signature generated | `.sig` file non-empty |
| 12 | Signature validates with new public key | `cargo tauri signer` confirms match |
| 13 | Private key absent from git | `git ls-files` shows no key file |
| 14 | `cargo check` green | Exits 0 |
| 15 | `cargo test` green | Passes |
| 16 | `pnpm build` green | Exits 0 |
| 17 | `git diff --check` clean | No whitespace errors |

No Apple signing/notarization is required yet.

---

## Phase 4+ Non-Goals (Mentioned for Dependency Awareness)

Phase 3 **does not** implement:
- Developer ID certificate import
- Temporary keychain setup
- Apple notarization API configuration
- App Store Connect API key
- GitHub Actions workflow
- Intel CI build job
- Public GitHub release creation
- PAT for release publishing
- `latest.json` generation pipeline
- Release tag creation
- v0.1.0 version bump or publication
- Update UI redesign

Phase 3 **enables** these future phases:
- Phase 5 (CI matrix): uses `TAURI_SIGNING_PRIVATE_KEY` from GitHub secrets + `--config` override
- Phase 7 (update feed): the public key is already embedded; endpoints will be added
- Phase 9 (dress rehearsal): the full signing chain is proven in Phase 3 Task 5

---

## Self-Review Checklist

| Property | Status |
|----------|--------|
| Source spec coverage (Phase 3 scope from design spec §11, roadmap Phase 3 row) | Covered |
| No TODO/TBD placeholders | Verified — all tasks have concrete steps |
| No private key material in plan | Verified — only command patterns, no key values |
| Exact Tauri CLI syntax verified against installed tauri-cli 2.10.1 | Verified via `--help` output |
| No Meetily updater fallback left in design | Verified — endpoint list emptied, not replaced with Meetily |
| Local dev does not require signing secrets | Verified — `createUpdaterArtifacts: false` in base config |
| Release path still enforces updater signatures | Verified — CI `--config` override enables signing |
| No Apple signing scope leakage | Verified — no notarization, cert, or keychain steps |
| Every security property has a concrete verification step | Verified — each task has verification commands |
