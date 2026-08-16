# Sivlo Production Identity + Clean Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert active production identity and new-user storage from Meetily-derived identity to Sivlo while intentionally leaving all existing Meetily-era user data untouched.

**Architecture:** Sivlo becomes a new macOS application identity using `com.drewsepeczi.sivlo`. Active production storage paths, recording directories, preferences, caches, and recovery storage should use Sivlo-owned names. Legacy Meetily references remain only where their explicit purpose is compatibility or detecting old installations; no automatic migration or deletion occurs.

**Tech Stack:** Tauri 2, Rust, Next.js/React, macOS application support directories, IndexedDB/browser storage where applicable.

## Global Constraints

- Product name: `Sivlo`
- Bundle identifier: `com.drewsepeczi.sivlo`
- First public version: `0.1.0`
- Minimum macOS version: `13`
- Existing Meetily data must not be deleted, moved, renamed, overwritten, or silently migrated.
- No Meetily-to-Sivlo migration in v0.1.0.
- Legacy-import code may retain Meetily paths when explicitly used to detect an old installation.
- Do not modify signing, notarization, updater, GitHub Actions, analytics, or release publishing in Phase 1.
- Do not add product features.
- Follow TDD where behavior is testable.
- Use small, reviewable commits.

---

## Repository Audit (identity reference classification)

Every match of `meetily`/`Meetily` in the active codebase, classified by what happens in Phase 1. This table is the source of truth for the audit task.

### ACTIVE_PRODUCTION_IDENTITY — change in Phase 1

| File | Line | Current | Change to |
|------|------|---------|-----------|
| `frontend/src-tauri/tauri.conf.json` | `identifier` | `com.meetily.ai` | `com.drewsepeczi.sivlo` |
| `frontend/src-tauri/tauri.conf.json` | `mainBinaryName` | absent | add `sivlo` |
| `frontend/src-tauri/tauri.conf.json` | `bundle.macOS.minimumSystemVersion` | absent | `13.0` |
| `frontend/src-tauri/src/console_utils/console_utils.rs` | 52, 90, 132 | `log stream --process meetily` | `--process sivlo` |

The Tauri `app_data_dir` derives from the bundle identifier, so changing the identifier moves the SQLite database, Tauri store files (`recording_preferences.json`, `analytics.json`), model directory, and any other Tauri-path-managed files from `~/Library/Application Support/com.meetily.ai/` to `~/Library/Application Support/com.drewsepeczi.sivlo/`. This is the primary storage split; the explicit path edits below handle the locations that bypass Tauri's identifier-derived paths.

### ACTIVE_NEW_STORAGE — change in Phase 1

| File | Line | Current | Change to |
|------|------|---------|-----------|
| `frontend/src-tauri/src/audio/recording_preferences.rs` | 46–75 | `meetily-recordings` (macOS `~/Movies`, Windows `~/Music`, Linux `~/Documents`) | `Sivlo-recordings` |
| `frontend/src-tauri/src/notifications/settings.rs` | 118 | `config_dir().join("meetily").join("notifications.json")` | `sivlo` |
| `frontend/src-tauri/src/summary/templates/loader.rs` | 27 | `data_dir().join("Meetily").join("templates")` | `Sivlo` |
| `frontend/src-tauri/src/whisper_engine/whisper_engine.rs` | 122 | `data_dir().join("Meetily").join("models")` (production fallback) | `Sivlo` |
| `frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs` | 142 | `data_dir().join("Meetily").join("models").join("parakeet")` (production fallback) | `Sivlo` |
| `frontend/src-tauri/src/summary/summary_engine/model_manager.rs` | 148 | `data_dir().join("Meetily").join("models").join("summary")` (production fallback) | `Sivlo` |
| `frontend/src/services/indexedDBService.ts` | 34 | `DB_NAME = 'MeetilyRecoveryDB'` | `'SivloRecoveryDB'` |

**Database filename decision:** `frontend/src-tauri/src/database/manager.rs` keeps the filenames `meeting_minutes.sqlite` (active) and `meeting_minutes.db` (legacy import contract). These are generic functional names, not Meetily branding; the identity-bearing path is the parent directory, which changes automatically with the bundle identifier. The `.db` filename is also the documented contract for the legacy import commands, so renaming it would break explicit import compatibility. Documented here; no change.

### LEGACY_COMPATIBILITY — preserve (explicit purpose)

| File | What | Why preserved |
|------|------|---------------|
| `frontend/src-tauri/src/database/commands.rs` | Commands `select_legacy_database_path`, `detect_legacy_database`, `check_default_legacy_database`, `check_homebrew_database`, `import_and_initialize_database` (registered in `lib.rs:726-730`) | Explicit legacy import path; the spec allows retaining Meetily paths used to detect/import old installations |
| `frontend/src/components/DatabaseImport/LegacyDatabaseImport.tsx` | "Welcome to Meetily!" / "previous Meetily installation" UI | Explicit import UI (currently orphaned from the app shell; preserved as-is) |
| `frontend/src/components/DatabaseImport/HomebrewDatabaseDetector.tsx` | `/usr/local/var/meetily/meeting_minutes.db` + `/opt/homebrew/var/meetily/...` paths, "Previous Meetily Installation Detected!" | Explicit legacy detection UI (currently orphaned; preserved as-is) |

**Behavior change (still LEGACY_COMPATIBILITY):** `frontend/src/contexts/OnboardingContext.tsx` lines 157–214 currently call `performAutoDetection()` on **first launch**, which automatically imports the Homebrew database and the default legacy database. This is an automatic transfer and violates the clean-start constraint. Task 5 removes the automatic path so first launch always calls `initialize_fresh_database()`; the legacy commands and import components above remain available for explicit use.

### INTERNAL_CRATE_NAME / INTERNAL_PACKAGE_NAME — leave unchanged

| File | Value | Why |
|------|-------|-----|
| `frontend/src-tauri/Cargo.toml` | package name `meetily`, lib name `app_lib` | Internal crate identifiers; not user-visible. Renaming is churn with no identity value. The built executable's name is set via `mainBinaryName` instead |
| `frontend/package.json` | name `meetily` | Internal package name; not user-visible |

### DOCUMENTATION — update comments where they describe active paths; leave branding text

| File | Change |
|------|--------|
| `frontend/src-tauri/src/summary/templates/mod.rs` | Doc comments (lines 34–36) referencing `~/Library/Application Support/Meetily/templates/` → Sivlo |
| `frontend/src-tauri/src/summary/templates/loader.rs` | Doc comments (lines 22–24) → Sivlo |
| `frontend/src-tauri/src/audio/recording_preferences.rs` | Doc comments (lines 46, 59, 72) → `Sivlo-recordings` |
| `frontend/build-gpu.sh`, `frontend/dev-gpu.sh`, `frontend/build.bat`, `frontend/dev-gpu.bat`, `frontend/build-gpu.bat`, `frontend/build.ps1`, `frontend/dev-gpu.ps1`, `frontend/build-gpu.ps1`, `frontend/build_backup.bat`, `frontend/API.md`, `frontend/README.md`, `CLAUDE.md` | Leave unchanged (cosmetic/branding text; updater `.tauri/meetily.key` path is Phase 3) |

### DEAD_CODE — leave unchanged

| File | What |
|------|------|
| `frontend/src-tauri/src/lib_old_complex.rs` | Not referenced by any `mod`; not compiled. Its `Meetily` window/notification titles are irrelevant |
| `frontend/src/components/Sidebar/index.tsx:733-735` | Commented-out `<span>Meetily</span>` block |

### OTHER / EXTERNAL — leave unchanged (documented)

| File | Line | What |
|------|------|------|
| `frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs` | 598 | `https://meetily.towardsgeneralintelligence.com/models/...` — external model download URL, owned by upstream hosting; revisit in the Phase 2 network audit |
| `frontend/src-tauri/src/audio/capture/core_audio.rs` | 139 | `meetily-audio-tap` — transient Core Audio aggregate device name; no user data |
| `frontend/src-tauri/src/audio/decoder.rs` | 294 | `.meetily_decode_` — transient temp-file prefix |
| `frontend/src/components/BluetoothPlaybackWarning.tsx` | 84 | Placeholder `github.com/your-org/meetily/...` help URL |

### PHASE2_SCOPE — no change in Phase 1

| File | Line | What |
|------|------|------|
| `frontend/src/lib/analytics.ts` | 185–188 | `meetily_user_id` sessionStorage key (analytics identity) — Phase 2 privacy/analytics audit |

## File Map

Single responsibility per file; no file is edited for more than one concern.

| File | Responsibility | Change |
|------|----------------|--------|
| `frontend/src-tauri/src/config.rs` | Centralized app identity + storage constants | Add `APP_IDENTIFIER`, `APP_MAIN_BINARY_NAME`, `RECORDINGS_DIR_NAME`, `STORAGE_DIR_NAME`, `NOTIFICATION_SETTINGS_DIR_NAME` constants + config identity test |
| `frontend/src-tauri/tauri.conf.json` | Production bundle identity | `identifier`, `mainBinaryName`, `bundle.macOS.minimumSystemVersion` |
| `frontend/src-tauri/src/console_utils/console_utils.rs` | macOS console/log helper | `--process meetily` → `--process sivlo` (3 occurrences) |
| `frontend/src-tauri/src/audio/recording_preferences.rs` | Default recordings folder | `meetily-recordings` → `Sivlo-recordings` (+ test) |
| `frontend/src-tauri/src/notifications/settings.rs` | Notification settings persistence | `config_dir().join("meetily")` → `sivlo` (+ test) |
| `frontend/src-tauri/src/summary/templates/loader.rs` | Custom templates dir | `data_dir().join("Meetily")` → `Sivlo` (+ test) |
| `frontend/src-tauri/src/summary/templates/mod.rs` | Module docs | Update path docs |
| `frontend/src-tauri/src/whisper_engine/whisper_engine.rs` | Whisper model dir (production fallback) | `.join("Meetily")` → `Sivlo` |
| `frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs` | Parakeet model dir (production fallback) | `.join("Meetily")` → `Sivlo` |
| `frontend/src-tauri/src/summary/summary_engine/model_manager.rs` | Summary model dir (production fallback) | `.join("Meetily")` → `Sivlo` |
| `frontend/src/services/indexedDBService.ts` | Recovery/IndexedDB storage | `DB_NAME = 'SivloRecoveryDB'` |
| `frontend/src/contexts/OnboardingContext.tsx` | First-launch database init | Remove auto legacy import; always `initialize_fresh_database()` |
| `frontend/src-tauri/src/database/commands.rs`, `frontend/src/components/DatabaseImport/*` | Legacy import (explicit) | No change (LEGACY_COMPATIBILITY) |

## Test Strategy

No frontend unit-test runner exists (`package.json` has no `test` script, no vitest/jest). Where behavior is unit-testable, use Rust `cargo test` tests (RED → GREEN). Where a value is only observable in configuration or browser storage, use exact verification commands rather than fake tests.

**Rust unit tests (RED → GREEN):**
1. **Production identity config** — new `#[cfg(test)]` module in `config.rs` reads `tauri.conf.json` (via `env!("CARGO_MANIFEST_DIR")`, so cwd-independent) and asserts `identifier == "com.drewsepeczi.sivlo"`, `productName == "Sivlo"`, `mainBinaryName == "sivlo"`, and `bundle.macOS.minimumSystemVersion == "13.0"`.
2. **Recordings folder** — test asserts the last path component of `get_default_recordings_folder()` equals `RECORDINGS_DIR_NAME` (currently fails on `meetily-recordings`).
3. **Notification settings path** — test asserts the settings path's parent directory equals `NOTIFICATION_SETTINGS_DIR_NAME` (currently `meetily`).
4. **Templates dir** — test asserts `get_custom_templates_dir()` resolves under `STORAGE_DIR_NAME/templates` (currently `Meetily`).
5. **Constants** — test asserts `RECORDINGS_DIR_NAME == "Sivlo-recordings"`, `STORAGE_DIR_NAME == "Sivlo"`, `NOTIFICATION_SETTINGS_DIR_NAME == "sivlo"`, `APP_IDENTIFIER == "com.drewsepeczi.sivlo"`.

**Frontend verification commands (no test runner):**
- `rg -n "SivloRecoveryDB" frontend/src/services/indexedDBService.ts` → 1 match.
- `rg -n "MeetilyRecoveryDB" frontend/` → 0 matches.
- `rg -n "performAutoDetection" frontend/src` → 0 matches.
- `rg -n "check_homebrew_database|check_default_legacy_database|import_and_initialize_database" frontend/src` → matches only in `DatabaseImport/` components and no longer in `OnboardingContext.tsx`.
- `rg -n "meetily-recordings|com\.meetily\.ai|MeetilyRecoveryDB" frontend/src frontend/src-tauri/src` → 0 active matches (allowlist documented matches only).
- `pnpm build` and `pnpm lint` in `frontend/` → pass.

**Regression:** `cargo test` in `frontend/src-tauri/` → all pass; `pnpm build` + `pnpm lint` → pass.

## Tasks

### Task 1 — Identity constants + RED tests

**Files:**
- Modify: `frontend/src-tauri/src/config.rs` — add identity/storage constants (top-level, alongside the existing model constants)
- Modify: `frontend/src-tauri/src/config.rs` — add a `#[cfg(test)]` module for the identity/config tests (follow the file's existing structure)

**Interfaces:**
- Consumes: `tauri.conf.json` (read-only), existing `config.rs`
- Produces: `APP_IDENTIFIER`, `APP_MAIN_BINARY_NAME`, `RECORDINGS_DIR_NAME`, `STORAGE_DIR_NAME`, `NOTIFICATION_SETTINGS_DIR_NAME` constants; RED tests for the config identity and constant values

**Steps:**
- [ ] Add the constants to `config.rs`:
  - `pub const APP_IDENTIFIER: &str = "com.drewsepeczi.sivlo";`
  - `pub const APP_MAIN_BINARY_NAME: &str = "sivlo";`
  - `pub const RECORDINGS_DIR_NAME: &str = "Sivlo-recordings";`
  - `pub const STORAGE_DIR_NAME: &str = "Sivlo";`
  - `pub const NOTIFICATION_SETTINGS_DIR_NAME: &str = "sivlo";`
- [ ] Write the RED config-identity test (see Test Strategy #1) reading `tauri.conf.json` via `env!("CARGO_MANIFEST_DIR")`.
- [ ] Write the RED constants test (Test Strategy #5).
- [ ] Run `cargo test` in `frontend/src-tauri/` and confirm the new tests fail (RED), with the cause being the current Meetily identity (not a compile error).
- [ ] Commit (message prefix `test(config):`).

### Task 2 — Tauri bundle identifier / macOS identity

**Files:**
- Modify: `frontend/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: Task 1 constants/tests
- Produces: GREEN config-identity test

**Steps:**
- [ ] Set `"identifier": "com.drewsepeczi.sivlo"`.
- [ ] Add `"mainBinaryName": "sivlo"` (top-level, sibling of `productName`; verified present in the local Tauri 2 schema `frontend/node_modules/@tauri-apps/cli/config.schema.json`).
- [ ] Under `bundle.macOS`, add `"minimumSystemVersion": "13.0"`.
- [ ] Do NOT change: `productName` (already `Sivlo`), `version` (deferred to release phase), `updater` endpoints/pubkey (Phase 3), `macOS.signingIdentity` (Phase 4), `targets` (Phase 5+), window/webview config.
- [ ] Run `cargo test` → the Task 1 config test now passes (GREEN) (this also proves the JSON parses, since the test reads it with `serde_json`).
- [ ] Optional compile smoke: `cargo build` in `frontend/src-tauri/` succeeds with the new config.
- [ ] Commit (message prefix `feat(config):`).

### Task 3 — Rust application/database/recording storage paths

**Files:**
- Modify: `frontend/src-tauri/src/audio/recording_preferences.rs` (`get_default_recordings_folder`, lines 43–78; comment lines 46/59/72)
- Modify: `frontend/src-tauri/src/notifications/settings.rs` (`ConsentManager::get_settings_path`, line 118)
- Modify: `frontend/src-tauri/src/summary/templates/loader.rs` (line 27 + doc lines 22–24)
- Modify: `frontend/src-tauri/src/summary/templates/mod.rs` (doc lines 34–36)
- Modify: `frontend/src-tauri/src/whisper_engine/whisper_engine.rs` (line 122)
- Modify: `frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs` (line 142)
- Modify: `frontend/src-tauri/src/summary/summary_engine/model_manager.rs` (line 148)
- No change (documented): `database/manager.rs` filenames (`meeting_minutes.sqlite`, `meeting_minutes.db`)

**Interfaces:**
- Consumes: `config.rs` constants from Task 1
- Produces: GREEN tests for recordings folder, notification settings path, templates dir

**Steps:**
- [ ] Write RED tests first (Test Strategy #2, #3, #4) and confirm they fail against the current `meetily`/`Meetily` values.
- [ ] `recording_preferences.rs`: replace `"meetily-recordings"` with `RECORDINGS_DIR_NAME` in all three platform branches; update the `// macOS:`/`// Windows:`/`// Linux/Others:` comments. Run the recordings test → GREEN.
- [ ] `notifications/settings.rs`: replace `path.push("meetily")` with `path.push(NOTIFICATION_SETTINGS_DIR_NAME)`. Run the settings test → GREEN.
- [ ] `templates/loader.rs`: replace `path.push("Meetily")` with `path.push(STORAGE_DIR_NAME)`; update doc lines 22–24 to `~/Library/Application Support/Sivlo/templates/`, `%APPDATA%\Sivlo\templates\`, `~/.config/Sivlo/templates/`. Run the templates test → GREEN.
- [ ] `templates/mod.rs`: update doc lines 34–36 to the Sivlo paths.
- [ ] `whisper_engine.rs:122`, `parakeet_engine.rs:142`, `model_manager.rs:148`: replace `.join("Meetily")` with `.join(STORAGE_DIR_NAME)` (production fallback branch; leave the `cfg!(debug_assertions)` dev branches untouched).
- [ ] Run the full `cargo test` suite in `frontend/src-tauri/` → all green.
- [ ] Run `rg -n "join\(\"Meetily\"\)|meetily-recordings|path.push\(\"meetily\"\)" frontend/src-tauri/src` → 0 matches (allowlisted files only).
- [ ] Commit (message prefix `feat(storage):`).

### Task 4 — Frontend IndexedDB/local persistence identity

**Files:**
- Modify: `frontend/src/services/indexedDBService.ts` (line 34)
- No change (Phase 2): `frontend/src/lib/analytics.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `SivloRecoveryDB` recovery store

**Steps:**
- [ ] Change `private readonly DB_NAME = 'MeetilyRecoveryDB'` → `'SivloRecoveryDB'`.
- [ ] Note in the commit body: the macOS WebKit website-data directory follows the bundle identifier, so the bundle change additionally isolates the IndexedDB origin storage; the DB rename guarantees a distinct store regardless.
- [ ] Verify: `rg -n "SivloRecoveryDB" frontend/src/services/indexedDBService.ts` → 1 match; `rg -n "MeetilyRecoveryDB" frontend/` → 0 matches.
- [ ] Run `pnpm build` and `pnpm lint` in `frontend/` → pass.
- [ ] Commit (message prefix `feat(storage):`).

### Task 5 — Preserve legacy Meetily import; remove automatic first-launch transfer

**Files:**
- Modify: `frontend/src/contexts/OnboardingContext.tsx`
- No change (LEGACY_COMPATIBILITY): `frontend/src-tauri/src/database/commands.rs`, `frontend/src/components/DatabaseImport/LegacyDatabaseImport.tsx`, `frontend/src/components/DatabaseImport/HomebrewDatabaseDetector.tsx`

**Interfaces:**
- Consumes: `check_first_launch`, `initialize_fresh_database` Tauri commands (already registered)
- Produces: clean-start behavior — first launch always initializes a fresh Sivlo database; no legacy path is probed or imported automatically

**Steps:**
- [ ] In `initializeDatabaseInBackground` (lines 157–174): replace the `await performAutoDetection();` call with `await invoke('initialize_fresh_database'); setDatabaseExists(true);` so first launch always initializes a fresh database.
- [ ] Delete the now-unused `performAutoDetection` function (lines 176–214) — its only purpose was automatic transfer; leaving it creates a latent auto-import hazard.
- [ ] Verify: `rg -n "performAutoDetection" frontend/src` → 0 matches; `rg -n "check_homebrew_database|check_default_legacy_database|import_and_initialize_database" frontend/src` → matches only in `DatabaseImport/` components, none in `OnboardingContext.tsx`.
- [ ] Confirm the legacy commands remain registered in `frontend/src-tauri/src/lib.rs:726-730` (no change) and the `DatabaseImport` components still reference them.
- [ ] Run `pnpm build` and `pnpm lint` in `frontend/` → pass.
- [ ] Commit (message prefix `fix(onboarding):`).

### Task 6 — Identity regression audit

**Files:**
- No production files changed

**Interfaces:**
- Consumes: the audit classification table above
- Produces: a verified allowlist of remaining Meetily references

**Steps:**
- [ ] Re-run the full pattern: `rg -n "meetily|Meetily|com\.meetily\.ai|meetily-recordings|meetily_user_id|MeetilyRecoveryDB" frontend/src frontend/src-tauri/src` and compare every match against the classification table.
- [ ] Confirm every remaining match is in exactly one allowed category: LEGACY_COMPATIBILITY, INTERNAL_CRATE_NAME, DOCUMENTATION, DEAD_CODE, OTHER/EXTERNAL, or PHASE2_SCOPE. Zero ACTIVE_PRODUCTION_IDENTITY or ACTIVE_NEW_STORAGE matches may remain.
- [ ] Run `cargo test` (frontend/src-tauri) and `pnpm build` + `pnpm lint` (frontend) → all green.
- [ ] Record the final allowlist in the commit body or a short `docs/` note under `docs/superpowers/plans/` (optional).
- [ ] Commit (message prefix `chore(audit):`) if any documentation was produced; otherwise no commit.

### Task 7 — Full Phase 1 verification (acceptance gate)

**Files:**
- No production files changed

**Interfaces:**
- Consumes: Tasks 1–6 results
- Produces: evidence the Phase 1 acceptance criteria hold

**Steps:**
- [ ] `cargo test` in `frontend/src-tauri/` → all tests pass.
- [ ] `pnpm build` and `pnpm lint` in `frontend/` → pass.
- [ ] Identity audit grep (Task 6 step 1) → zero active matches; allowlist only.
- [ ] `rg -n '"identifier"|"mainBinaryName"|"minimumSystemVersion"' frontend/src-tauri/tauri.conf.json` shows `com.drewsepeczi.sivlo`, `sivlo`, `13.0`.
- [ ] Optional built-bundle check (expensive; run if CI/disk allows): `pnpm tauri:build` in `frontend/`, then verify the produced app:
  - `plutil -extract CFBundleIdentifier raw Sivlo.app/Contents/Info.plist` → `com.drewsepeczi.sivlo`
  - `ls Sivlo.app/Contents/MacOS/` contains `sivlo`
  - `plutil -extract LSMinimumSystemVersion raw Sivlo.app/Contents/Info.plist` → `13.0`
- [ ] Manual clean-start smoke (must be documented as verified or blocked): with a fake legacy DB present at `~/Library/Application Support/com.meetily.ai/meeting_minutes.sqlite` and `/usr/local/var/meetily/meeting_minutes.db`, launch the app and confirm (a) a fresh database is created under `~/Library/Application Support/com.drewsepeczi.sivlo/`, (b) the old directories are byte-for-byte untouched, (c) no import/transfer log lines appear.
- [ ] No new production files were added outside the File Map; `git status` shows only the documented files.

## Phase 1 Acceptance Criteria (gate before Phase 2)

1. `cargo test` (frontend/src-tauri) fully green, including the new identity/config/path tests.
2. `pnpm build` + `pnpm lint` (frontend) fully green.
3. Identity audit: zero ACTIVE_PRODUCTION_IDENTITY / ACTIVE_NEW_STORAGE matches; every remaining `meetily`/`Meetily` reference is allowlisted (LEGACY_COMPATIBILITY, INTERNAL, DOCUMENTATION, DEAD_CODE, OTHER/EXTERNAL, PHASE2_SCOPE).
4. `tauri.conf.json` asserts `com.drewsepeczi.sivlo`, `mainBinaryName = sivlo`, `minimumSystemVersion = 13.0`.
5. First launch initializes a fresh Sivlo database and never probes/imports Meetily paths automatically; legacy import remains available through the preserved components/commands.
6. Old Meetily data directories are untouched (verified by the clean-start smoke or explicitly documented as pending hardware/CI).
7. Optional: built bundle's `CFBundleIdentifier`, binary name, and `LSMinimumSystemVersion` verified.

If any criterion fails, Phase 2 must not start; fix within Phase 1.

## Out of Phase 1 Scope (explicitly deferred)

- Version bump to `0.1.0` (release-cut phase; keep `0.4.0`).
- Tauri updater endpoints/pubkey replacement and `TAURI_SIGNING_PRIVATE_KEY` secrets (Phase 3).
- Apple signing/notarization config and `APPLE_*` secrets (Phase 4).
- GitHub Actions matrix, publishing, `latest.json`, validation gates (Phases 5–8).
- Analytics identity (`meetily_user_id`, PostHog config) and network/privacy audit (Phase 2).
- External model URL `meetily.towardsgeneralintelligence.com` (Phase 2 network audit).
- Build-script cosmetics and updater `.tauri/meetily.key` path (Phase 3).
- Renaming the internal crate (`Cargo.toml`/`package.json` names stay `meetily`).
