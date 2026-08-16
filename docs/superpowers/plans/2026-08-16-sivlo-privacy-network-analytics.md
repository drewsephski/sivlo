# Sivlo Privacy, Network + Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: **Code review**. This task DOES involve external network/API/services changes and data-privacy decisions. Have the plan reviewed by a second agent. Do not start until reviewed.

## Goal

> **Critical instruction:** You are planning ONLY. Do NOT implement the phase you are planning. The task you are working on right now is to WRITE THE PLAN. Do not edit any production code, and do not create any files besides this plan file (unless this plan file itself is the task).

- [ ] [Phase 2] Prepare Sivlo for release as a privacy-first app by:
  - [ ] Auditing the full Sivlo network surface and confirming no unexpected external communication.
  - [ ] Neutralizing all inherited upstream (Meetily/PostHog) analytics-telemetry connections and confirmed no active upstream analytics.
  - [ ] Verifying zero telemetry/data egress without explicit user consent, and analytics ships disabled in v0.1.0.
  - [ ] Enforcing data minimization on any analytics payload (meeting content structurally excluded).
  - [ ] Confirming all product networking (AI providers, model downloads) still functions.
  - [ ] Documenting the Sivlo privacy posture and network inventory.
- [ ] Phase 2 production-safety gate: `bun tests green`, `pnpm build green`, `cargo test green`, `cargo check green`.

## Architecture

The consent source of truth stays in the frontend: `frontend/src/components/AnalyticsProvider.tsx` reads the `analytics.json` store key `analyticsOptedIn` (default `false`) and is the ONLY mount-time path that may call `Analytics.init()`. `AnalyticsConsentSwitch` is the ONLY user-facing toggle. Rust holds zero consent state and never auto-initializes analytics (`lib.rs` `.setup` does not call `init_analytics`).

The Phase 2 change makes Rust incapable of self-enabling even when asked: `init_analytics` builds its `AnalyticsConfig` from a keyless default (optionally overridable via env vars), never from committed credentials. Because `AnalyticsClient::new` only constructs the inner `posthog_rs::Client` when `config.enabled && !config.api_key.is_empty()` (`analytics.rs:86-91`), a stock Sivlo build yields `client: None`, and every `track_event`/`identify` becomes a no-op (`analytics.rs:129-131`). Zero data egress is therefore guaranteed at the network layer, independent of the frontend gate.

```
Consent (frontend)                 Rust (Phase 2)
analytics.json                     init_analytics
  analyticsOptedIn  ── opt-in ──►   build config from env (SIVLO_*), else disabled
  (default false)                      │  api_key = "" / enabled = false
                                      ▼
                              AnalyticsClient::new → inner client None
                                      │
                              track_event/identify → Ok(()) no-op, no HTTP
```

Defense in depth: the frontend `Analytics` class keeps gating every `track*`/session call on its `initialized` flag, AND now routes all property maps through a pure guard module (`frontend/src/features/analytics/guard.ts`) that applies the same allowlist before `invoke`, mirroring the Rust-side authoritative allowlist.

## Tech Stack

- **Rust (Tauri 2.x core)** — `frontend/src-tauri/src/analytics/` (`commands.rs`, `analytics.rs`), `posthog-rs = "0.3.7"` (`Cargo.toml:70`), `reqwest`, `tokio`, `cargo test`, `cargo check`.
- **TypeScript / Next.js 14 (React 18)** — `frontend/src/lib/analytics.ts`, `frontend/src/components/AnalyticsProvider.tsx`, `@tauri-apps/plugin-os` (already a dependency), `@tauri-apps/api`, `bun test` (runner already in use: 12 test files, 98 tests green).
- **Local persistence** — `@tauri-apps/plugin-store` (`analytics.json`: `analyticsOptedIn`, `user_id`, `is_first_launch`, `last_daily_tracked`).
- **No new dependencies. No new network infrastructure.**

## Global Constraints

- **Planning only.** This phase's deliverable is this plan plus the isolated Phase 2 code changes it describes. Do not touch updater endpoints, code signing, CI, release workflow, or DB schema — those are Phase 3+ concerns and are classified here but NOT implemented.
- **Keep the frontend as the single consent source of truth** (`analytics.json` → `analyticsOptedIn`); Rust must never persist or auto-enable consent.
- **Zero telemetry before explicit opt-in**, and **zero telemetry even after opt-in** unless a Sivlo-owned config exists (none ships in v0.1.0 — "analytics entirely disabled for v0.1.0" is a valid, passing state).
- **No committed analytics credentials** anywhere in `frontend/src-tauri/`. The inherited upstream PostHog project key must be removed.
- **Data minimization:** analytics payloads may only contain non-content operational metadata. Meeting audio, transcripts, titles, summaries, notes, custom prompts, AI responses, and file paths are structurally excluded (allowlist, deny-by-default — not a denylist).
- **Product networking must keep working:** user-configured AI providers (OpenAI/Groq/Anthropic/OpenRouter/Ollama/custom) and model downloads (HuggingFace, parakeet fallback) are core features and are NOT privacy-gated. Do not break the CSP `connect-src` in `tauri.conf.json`.
- Follow existing repo conventions: Rust unit tests inline (`#[cfg(test)]`) mirroring `summary_engine/models.rs` and `config.rs` test style; frontend tests in `frontend/tests/` using `bun:test`; no new comments in code beyond existing style; no new docs files unless required.
- Commit message for this phase's plan: `docs: plan Sivlo privacy and analytics hardening` (plan-only commit).

## Network + Telemetry Inventory

Classifications: **ANALYTICS_TELEMETRY** (must be neutralized) | **PRODUCT_AI_NETWORK** (keep) | **MODEL_DOWNLOAD** (keep) | **UPDATER_NETWORK** (defer to Phase 3) | **EXTERNAL_LINK** (keep, document) | **LOCAL_ONLY** (keep) | **LEGACY_UPSTREAM** (dead, document) | **CRASH_REPORTING** (none) | **OTHER_NETWORK** (build-time only).

| # | Surface | Location | Classification | Destination / endpoint | Trigger | Payload | Consent | Phase 2 action |
|---|---------|----------|----------------|------------------------|---------|---------|---------|----------------|
| 1 | `init_analytics` hardcoded upstream config | `frontend/src-tauri/src/analytics/commands.rs:10-23` | ANALYTICS_TELEMETRY | `https://us.i.posthog.com`, key `phc_Aa9PqeCkDkVbtbRsYjtmHANBfcscjCVupxZwrtL5vZ77` (inherited Meetily project) | opt-in toggle → `Analytics.init()` → `invoke('init_analytics')` | config only | frontend `analyticsOptedIn === true` | **REMOVE** committed key/host; build config from env (`SIVLO_ANALYTICS_API_KEY`/`SIVLO_ANALYTICS_HOST`), default disabled → inner client `None` |
| 2 | posthog-rs client + sanitizer | `analytics/analytics.rs` (`AnalyticsClient::new` :86, `track_event` :128, `identify` :101, `sanitize_analytics_properties` :25, `SENSITIVE_ANALYTICS_KEYS` :9) | ANALYTICS_TELEMETRY | `us.i.posthog.com` (default host) | track/identify/session methods | event properties (currently denylist-filtered) | client gate + frontend `initialized` | Replace denylist with allowlist; keep default-disabled |
| 3 | `posthog-rs` dependency | `frontend/src-tauri/Cargo.toml:70` | ANALYTICS_TELEMETRY | n/a | compile | n/a | n/a | Keep crate compiled but runtime-disabled (minimal diff). Optional later phase: remove crate + commands + frontend wrapper |
| 4 | Frontend analytics wrapper | `frontend/src/lib/analytics.ts` (init/track* at :150+, `getPersistentUserId` :165-193, `getOSVersion` :255-259) | ANALYTICS_TELEMETRY | Tauri `invoke` only (no direct fetch) | track*/identify/init | `os_version` embeds FULL user agent (:259); `meetily_user_id` sessionStorage fallback (:185,:188); anonymous `user_id` persisted post-opt-in (:171-177) | `initialized` flag | Remove `meetily_user_id`; compute device info via `@tauri-apps/plugin-os` (no UA); route properties through guard allowlist |
| 5 | Consent gate (single source of truth) | `frontend/src/components/AnalyticsProvider.tsx` | ANALYTICS_TELEMETRY | n/a | mount | n/a | reads `analyticsOptedIn` (default `false`), migration key `analyticsDefaultOffMigrationV1` | **KEEP** as source of truth; call guard resolver |
| 6 | Consent toggle UI + transparency modal | `frontend/src/components/AnalyticsConsentSwitch.tsx` (+ `AnalyticsDataModal.tsx`, rendered in `About.tsx`/`PreferenceSettings.tsx`) | EXTERNAL_LINK | browser via `invoke('open_external_url', ...)` :150 → `github.com/Zackriya-Solutions/meeting-minutes/.../PRIVACY_POLICY.md` | user click | n/a | n/a | KEEP; document (link targets upstream Meetily repo privacy policy — content decision for a later phase) |
| 7 | OpenAI model list | `frontend/src-tauri/src/openai.rs` `get_openai_models` | PRODUCT_AI_NETWORK | `https://api.openai.com/v1/models` | user-configured provider + key | model list | user action | KEEP |
| 8 | Groq completions | `frontend/src-tauri/src/summary/llm_client.rs` | PRODUCT_AI_NETWORK | `https://api.groq.com/openai/v1/chat/completions` | user-initiated summary generation | transcript + prompt → user-chosen provider | user action | KEEP |
| 9 | OpenRouter completions | `frontend/src-tauri/src/summary/llm_client.rs` | PRODUCT_AI_NETWORK | `https://openrouter.ai/api/v1/chat/completions` | user-initiated summary generation | transcript + prompt | user action | KEEP |
| 10 | Anthropic completions | `frontend/src-tauri/src/summary/llm_client.rs` | PRODUCT_AI_NETWORK | `https://api.anthropic.com/v1/messages` | user-initiated summary generation | transcript + prompt | user action | KEEP |
| 11 | Ollama models + completions | `frontend/src-tauri/src/ollama/ollama.rs` `get_ollama_models`; `summary/llm_client.rs` | PRODUCT_AI_NETWORK (local default) | user-configured endpoint (default `http://localhost:11434`) | model list + summary | transcript + prompt (local) | user action | KEEP |
| 12 | Custom OpenAI-compatible test | `frontend/src-tauri/src/api/api.rs` `api_test_custom_openai_connection` (:1411) | PRODUCT_AI_NETWORK | user-configured endpoint | connection test | provider URL + user-entered key | user action | KEEP |
| 13 | Whisper model downloads | `frontend/src-tauri/src/whisper_engine/whisper_engine.rs` (model URL catalog) | MODEL_DOWNLOAD | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/...` | user-initiated download | model files | user action | KEEP |
| 14 | Parakeet model downloads | `frontend/src-tauri/src/parakeet_engine/parakeet_engine.rs:598` | MODEL_DOWNLOAD | HuggingFace + `https://meetily.towardsgeneralintelligence.com/models/parakeet-tdt-0.6b-v3-onnx` (Meetily-hosted fallback) | user-initiated download | model files | user action | KEEP; document Meetily-hosted URL (re-host under Sivlo is a later-phase candidate, NOT done here) |
| 15 | Summary-engine GGUF downloads | `frontend/src-tauri/src/summary/summary_engine/models.rs:172-211` | MODEL_DOWNLOAD | `https://huggingface.co/...` GGUF URLs | user-initiated built-in model download | model files | user action | KEEP |
| 16 | App updater | `frontend/src-tauri/tauri.conf.json:115-121` (plugins.updater pubkey + endpoints) | UPDATER_NETWORK | `https://github.com/Zackriya-Solutions/meeting-minutes/releases/latest/download/latest.json` | user-initiated check/update (`frontend/src/services/updateService.ts`) | update metadata | user action | **DEFER to Phase 3** (classify only; NOT modified in Phase 2) |
| 17 | ollama.com/download links | multiple UI locations (e.g. PreferenceSettings, model dialogs) | EXTERNAL_LINK | browser | user click | n/a | n/a | KEEP (document) |
| 18 | Bluetooth notice placeholder link | `frontend/src/components/BluetoothPlaybackWarning.tsx:84` | EXTERNAL_LINK | browser → `github.com/your-org/meetily/.../BLUETOOTH_PLAYBACK_NOTICE.md` (broken placeholder) | user click | n/a | n/a | KEEP (document; broken placeholder noted for later) |
| 19 | Local meeting search/persistence | `frontend/src-tauri/src/api/api.rs` `api_get_meetings`/`api_search_transcripts` | LOCAL_ONLY | local DB / filesystem | Tauri commands | meeting metadata | local | KEEP |
| 20 | Legacy localhost FastAPI paths | `frontend/src-tauri/src/api/api.rs` `api_get_profile`/`api_save_profile`/`api_update_profile` via `make_api_request` (:249), `test_backend_connection` | LEGACY_UPSTREAM (dead) | `http://localhost:5167` (archived FastAPI; removed from docs) | none — no frontend caller exists | (would be profile data) | none | KEEP dormant (localhost-only, unreachable in practice); document; optional later cleanup |
| 21 | Dead archive file | `frontend/src-tauri/src/lib_old_complex.rs:1819` | DEAD CODE | contains `us.i.posthog.com` string | none — file is not compiled (not declared in `lib.rs`) | n/a | n/a | Document as dead code; confirm via `lib.rs` module list |
| 22 | Build-time ffmpeg download | `frontend/src-tauri/build/ffmpeg.rs` | OTHER_NETWORK (build-time only) | `github.com/Zackriya-Solutions/ffmpeg-binaries` | build script (dev/release build) | binaries | n/a (build-time) | Document; not a shipped-runtime network surface |
| 23 | Rust analytics auto-init at startup | `frontend/src-tauri/src/lib.rs` `.setup` (:418) | n/a | none | none | n/a | n/a | Confirm ABSENT (analytics is not auto-initialized); keep it that way |
| 24 | Rust→frontend analytics events (`app.emit`) | none found | n/a | n/a | n/a | n/a | n/a | Confirm NONE |
| 25 | Crash reporting (Sentry/telemetry SDK) | none found | CRASH_REPORTING | n/a | n/a | n/a | n/a | Confirm ABSENT |

**Summary of Phase 2 network posture:** after this phase the only external egress routes are (a) user-configured AI providers, (b) user-initiated model downloads, (c) the deferred updater, and (d) user-clicked external links in the OS browser. No analytics, no crash reporting, no product telemetry.

## Consent Model

- **Single source of truth:** `analytics.json` store key `analyticsOptedIn`, default `false`, persisted across launches. Migration key `analyticsDefaultOffMigrationV1` already forces default-off for pre-existing installs.
- **Writers:** only `AnalyticsConsentSwitch` (user toggle) may flip consent; only `AnalyticsProvider` may read it at mount to decide whether to call `init()`.
- **Rust:** holds no consent state; never auto-initializes analytics; cannot self-enable because a stock build has no key/host config.
- **Zero events before consent:** every frontend `track*`/session/identify call checks `initialized`, which is set only by `init()`, which is called only when `analyticsOptedIn === true`. Independently, the Rust client is a no-op with no inner PostHog client.
- **Consent revocation:** toggling OFF calls `invoke('disable_analytics')` → `ANALYTICS_CLIENT` set to `None` → all future events no-op, even if the frontend flag were somehow stale. No queued/offline flushing exists (posthog-rs only captures live).

## v0.1.0 Default: Analytics Disabled

Analytics ships **entirely disabled** in v0.1.0:

- No Sivlo-owned PostHog project or API key exists or is committed.
- The inherited upstream Meetily key is removed from the codebase.
- A stock build's `init_analytics` produces a disabled config (`enabled: false`, empty key) → no inner client → no HTTP ever.
- Enabling the in-app toggle therefore produces **zero network activity** — the UI can remain (it documents the privacy posture and is the future hook), but it drives no telemetry in v0.1.0.
- A future Sivlo-owned analytics backend could be wired via build-time env (`SIVLO_ANALYTICS_API_KEY`/`SIVLO_ANALYTICS_HOST`) without code changes; Phase 2 ships none.

**"Analytics entirely disabled for v0.1.0" is explicitly a valid, passing state** for this phase's acceptance gate.

## Data Minimization: Allowlist

Replace the denylist `SENSITIVE_ANALYTICS_KEYS` (`analytics.rs:9-23`) with an **allowlist (deny-by-default)** constant, e.g. `ALLOWED_ANALYTICS_PROPERTY_KEYS`, applied in `sanitize_analytics_properties` (`retain` only keys in the allowlist). Only non-content operational metadata is permitted:

- Identity/session: `meeting_id`, `session_id`, `session_duration`, `timestamp`, `app_version`, `is_first_launch`, `is_daily_active`
- Device (from `@tauri-apps/plugin-os`, never the UA string): `app_platform`, `app_os_version`, `app_arch`
- Operational: `feature`, `feature_name`, `beta_feature_name`, `setting_type`, `new_value` (documented constraint: callers pass only non-content config values such as `${provider}_${model}`), `model_provider`, `model_name`, `error_message`, `success`, `count`, `duration_seconds`, `viewed_at`

Structural guarantees:

- Any key NOT in the allowlist is dropped — so content keys (`title`, `transcript`, `summary`, `notes`, `prompt`, `response`, `content`, `text`, `audio`, `file_path`, `folder_path`, `meeting_name`, …) **cannot be transmitted**, regardless of caller mistakes.
- Dedicated tracker methods (`track_meeting_started` :239, `track_recording_started` :247, `track_settings_changed` :276, `track_model_changed` :341, etc.) build fixed property sets using only allowlisted keys — each is audited in Task 3.
- The frontend guard module mirrors the allowlist before `invoke` (defense in depth) and is bun-testable pure logic.
- Remove `meetily_user_id` sessionStorage fallback (`analytics.ts:185,188`). The post-opt-in anonymous install id (`user_id` in `analytics.json`) is kept; it is created only after opt-in.
- `os_version`/platform/arch no longer embed `navigator.userAgent` (`analytics.ts:255-259`); use `os.platform()`, `os.version()`, `os.arch()` from `@tauri-apps/plugin-os` (already a dependency).

## Product AI Networking Preserved

The following are core product features and must remain fully functional (no consent gating, no removal):

- OpenAI `/v1/models` + chat completions; Groq; OpenRouter; Anthropic (`summary/llm_client.rs`, `openai.rs`).
- Ollama local/remote endpoint (`ollama/ollama.rs`, `llm_client.rs`).
- Custom OpenAI-compatible endpoint test (`api.rs:1411`).
- Model downloads: Whisper (HuggingFace), Parakeet (HuggingFace + Meetily-hosted fallback), summary GGUF models (HuggingFace).
- CSP `connect-src` in `tauri.conf.json` is NOT changed by this phase.

Privacy note recorded in the posture doc: when a user configures a cloud provider, the transcript is sent ONLY to that user-chosen provider and ONLY during a user-initiated summary generation. This is not telemetry.

## Protected Data

The following never appear in analytics payloads — enforced structurally by the allowlist and verified by tests:

- Meeting audio / recording content and file paths
- Transcript text/segments
- Meeting titles
- Summary text and regenerated summaries
- Notes (BlockNote content)
- Custom AI prompts and AI responses
- Folder/file paths, device name, full user agent string

## Test Strategy (RED → GREEN)

Follow the repo's proven approach: Rust `#[cfg(test)]` unit tests (style per `summary_engine/models.rs`, `config.rs`) + `bun test` for pure frontend logic + exact static verification commands. The changes introduce small pure functions (`build_analytics_config_from_env`, allowlist sanitizer, frontend guard module) so behavior is honestly unit-testable.

| Proof | RED state (today) | Change | GREEN state (after) | Command |
|-------|-------------------|--------|---------------------|---------|
| R1 no committed upstream key | `rg -n "phc_" frontend/src-tauri` MATCHES (key at commands.rs:12) | Remove key/host from commands.rs | no matches | `rg -n "phc_" frontend/src-tauri` → exit 1 |
| R2 init is disabled by default | No such fn; `init_analytics` self-enables with key | Extract `build_analytics_config_from_env()`; use in `init_analytics` | new Rust test: empty env → `api_key == ""`, `enabled == false`; `AnalyticsClient::new(cfg).is_disabled()` (no inner client) | `cargo test` in `frontend/src-tauri` |
| R3 track/identify are network no-ops when disabled | `AnalyticsClient::new(default)` already yields `client: None` (would pass — lock it); but current `init_analytics` produces an ENABLED client (system-level RED) | Neutralize init (R2); test the full path yields a no-op client | Rust test: `track_event`/`identify` on disabled client returns `Ok(())`, no HTTP (no inner client) | `cargo test` |
| R4 allowlist (deny-by-default) drops content | denylist passes unknown keys through — test inserting `transcript`, `title`, `summary`, `notes`, `prompt`, `response`, `content`, `meeting_content`, `audio_path`, `file_path` + allowlisted `meeting_id` → only `meeting_id` survives FAILS today | Allowlist in `sanitize_analytics_properties` | test passes: only allowlisted keys survive | `cargo test` |
| R5 no `meetily_user_id` | `rg -n "meetily_user_id" frontend/src` MATCHES (:185,:188) | Remove sessionStorage fallback | no matches | `rg -n "meetily_user_id" frontend/src` → exit 1 |
| R6 no full-UA `os_version` | `navigator.userAgent` used in `analytics.ts` (:244,:259) | Device info via `@tauri-apps/plugin-os` | no `navigator.userAgent` in `frontend/src/lib/analytics.ts` | `rg -n "navigator.userAgent" frontend/src/lib/analytics.ts` → exit 1 |
| R7 consent default OFF + resolver | `analyticsOptedIn` already defaults false (lock it) | Add pure `resolveAnalyticsConsent()` in guard module; use in AnalyticsProvider | bun tests: `resolveAnalyticsConsent(undefined)===false`, `(false)===false`, `(null)===false`, `(true)===true` | `bun test` in `frontend` |
| R8 product network intact | endpoints present (already) | No changes to AI/model/download paths | existing cargo tests (e.g. `summary_engine/models.rs` URL tests, `ollama` endpoint tests) green; endpoint greps still match | `cargo test`; `rg` proofs |
| R9 full gates | — | — | all commands pass | `bun test`, `pnpm build`, `pnpm lint`, `cargo test`, `cargo check` |

Existing test baseline (must stay green): `bun test` — 98 tests / 12 files; `cargo test` in `frontend/src-tauri`.

## Manual Runtime Verification

1. Fresh launch with consent OFF → open DevTools Network tab + watch Rust logs → **zero** requests to `us.i.posthog.com` or any analytics host.
2. About → toggle analytics ON → still **zero** analytics egress (no configured key/endpoint in stock build); `is_analytics_enabled` returns `false`.
3. Toggle OFF → restart → consent stays OFF (default); no `init_analytics` call.
4. Configure a provider and generate a summary → traffic goes to that provider ONLY (visible in network monitor), never to PostHog.
5. Download a model (whisper/parakeet/summary) → request goes to HuggingFace (or the Meetily fallback for parakeet) only.
6. Confirm `lib.rs` `.setup` performs no analytics initialization at startup.

## File Map

**Create (only new files):**
- `frontend/src/features/analytics/guard.ts` — pure helpers: `resolveAnalyticsConsent()`, `sanitizeAnalyticsProperties()` (allowlist mirror). No Tauri imports; fully bun-testable.
- `frontend/tests/lib/analytics-guard.test.ts` — bun tests for the guard (R7 + allowlist mirror).

**Modify:**
- `frontend/src-tauri/src/analytics/commands.rs` — remove hardcoded key/host; add `build_analytics_config_from_env()`; `init_analytics` uses it (R1, R2).
- `frontend/src-tauri/src/analytics/analytics.rs` — replace denylist with allowlist constant + logic; add `#[cfg(test)]` tests (R3, R4). Keep `AnalyticsConfig::default()` (already disabled).
- `frontend/src/lib/analytics.ts` — remove `meetily_user_id` sessionStorage fallback (R5); replace UA-based `getPlatform`/`getOSVersion` with `@tauri-apps/plugin-os` (R6); route properties through `sanitizeAnalyticsProperties` from guard module.
- `frontend/src/components/AnalyticsProvider.tsx` — resolve consent via `resolveAnalyticsConsent()` (R7). Behavior unchanged.

**Do NOT modify:** `Cargo.toml` deps, `tauri.conf.json` (incl. updater + CSP), `lib.rs` `.setup`, `openai.rs`, `ollama/`, `summary/` (incl. `llm_client.rs`, `summary_engine/models.rs`), `whisper_engine/`, `parakeet_engine/`, `api/api.rs`, `lib_old_complex.rs`, `AnalyticsConsentSwitch.tsx`, `AnalyticsDataModal.tsx`.

**Docs (only this plan + a short posture note):**
- `docs/superpowers/plans/2026-08-16-sivlo-privacy-network-analytics.md` — this plan.
- Append a concise "Phase 2 privacy posture" section to `docs/superpowers/plans/2026-08-15-sivlo-release-prep-roadmap.md` (docs-only change; captures the inventory summary + the "analytics disabled in v0.1.0" posture).

## Task List

- [ ] **Task 1 — Freeze the inventory + baseline.** Run and record the RED-state proofs (R1/R5/R6 greps; R4 test) and capture baseline `bun test` (98) / `cargo test` pass. Save exact command output for the acceptance-gate comparison.
- [ ] **Task 2 — Neutralize inherited upstream analytics identity.** Remove the `phc_...` key + `https://us.i.posthog.com` host from `analytics/commands.rs:12-13`. Add `build_analytics_config_from_env()` reading `SIVLO_ANALYTICS_API_KEY` / `SIVLO_ANALYTICS_HOST` with a default of empty key / empty host / `enabled: false`. Wire it into `init_analytics`. Add Rust tests (R1, R2).
- [ ] **Task 3 — Rust allowlist sanitizer.** Replace `SENSITIVE_ANALYTICS_KEYS` + `sanitize_analytics_properties` with `ALLOWED_ANALYTICS_PROPERTY_KEYS` (deny-by-default). Audit every dedicated tracker method (`track_meeting_started` :239, `track_recording_started` :247, `track_recording_stopped` :259, `track_meeting_deleted` :267, `track_settings_changed` :276, `track_app_started` :284, `track_feature_used` :292, summary methods :303-330, `track_model_changed` :341, `track_custom_prompt_used` :349) to confirm they use only allowlisted keys; adjust any that add content keys (they currently use fixed property sets — expected clean). Add no-op-client tests (R3) + allowlist tests (R4).
- [ ] **Task 4 — Frontend guard + identifier/device cleanup.** Create `frontend/src/features/analytics/guard.ts` (`resolveAnalyticsConsent`, `sanitizeAnalyticsProperties`). Update `frontend/src/lib/analytics.ts`: drop `meetily_user_id` fallback (R5), replace UA-based device info with `@tauri-apps/plugin-os` (R6), route properties through guard sanitizer, use `resolveAnalyticsConsent` in `AnalyticsProvider.tsx` (R7). Add `frontend/tests/lib/analytics-guard.test.ts`. Run `bun test` (R7) + `pnpm build`/`pnpm lint`.
- [ ] **Task 5 — Full verification + static release audit + posture docs.** Run all gate commands (R9). Run the full static release audit (below). Append the privacy-posture note to the roadmap. Re-run the RED-proof commands and record GREEN outputs.
- [ ] **Task 6 — Self-review + peer code review.** Perform the Self-Review section below; have a second agent review (the plan's required sub-skill). Resolve findings before merging.

## Static Release Audit

Exact commands to run at verification and in any future release pipeline (Phase 3 will wire these into CI):

```bash
# 1. No committed analytics credentials anywhere in the Rust core
rg -n "phc_" frontend/src-tauri; test $? -eq 1
# 2. No upstream-named user identity key in the frontend
rg -n "meetily_user_id" frontend/src; test $? -eq 1
# 3. No full user-agent string in analytics device info
rg -n "navigator.userAgent" frontend/src/lib/analytics.ts; test $? -eq 1
# 4. No analytics auto-init at startup
rg -n "init_analytics" frontend/src-tauri/src/lib.rs; test $? -eq 1
# 5. Allowlisted product-network endpoints still present (must MATCH):
rg -n "api.openai.com|api.groq.com|api.anthropic.com|openrouter.ai|huggingface.co|api.ollama.ai|localhost" frontend/src-tauri/src | head -40
# 6. No unexpected outbound hosts in the shipped app (expected set below)
```

Expected/harmless outbound hosts that MAY appear in scans (documented, product/updater/build surfaces): `api.openai.com`, `api.groq.com`, `api.anthropic.com`, `openrouter.ai`, `huggingface.co`, `meetily.towardsgeneralintelligence.com` (parakeet model fallback), `github.com/Zackriya-Solutions/...` (updater + ffmpeg build binaries), `api.ollama.ai` + localhost (config/legacy/CSP), `ollama.com` (external link).

## Phase 2 Acceptance Gate

- [ ] `rg -n "phc_" frontend/src-tauri` → no matches (inherited upstream analytics key removed)
- [ ] `rg -n "meetily_user_id" frontend/src` → no matches (upstream-named identifier removed)
- [ ] `init_analytics` produces a disabled client in a stock build; `track_event`/`identify` are verified no-ops (R2/R3 tests green)
- [ ] Analytics payload allowlist (deny-by-default) enforced Rust + frontend; content keys structurally excluded (R4 + guard tests green)
- [ ] Device info no longer embeds the full user agent (R6 green)
- [ ] Consent default OFF, persisted, migration key applied; frontend remains the single source of truth (R7 green)
- [ ] Zero telemetry/data egress without explicit consent, and **analytics entirely disabled for v0.1.0** — explicitly a valid passing state
- [ ] Product AI networking intact (existing tests green; endpoint greps match; CSP unchanged)
- [ ] `bun tests green`, `pnpm build green`, `cargo test green`, `cargo check green` (R9)
- [ ] Manual runtime verification checklist passed
- [ ] Dead/legacy surfaces documented (lib_old_complex.rs, localhost:5167 legacy, updater deferred to Phase 3)
- [ ] Plan self-reviewed and peer code-reviewed

## Self-Review

- [ ] Plan covers every Phase 2 requirement from `2026-08-15-sivlo-release-prep-design.md` and the roadmap row (audit network surface, neutralize inherited analytics, zero telemetry pre-consent, analytics disabled in v0.1.0, document privacy posture).
- [ ] Every file, function, symbol, and line number referenced is exact and verified against the current tree (`commands.rs:10-23`, `analytics.rs:9-23/25-28/86-91/101/128/239-349`, `analytics.ts:150-259`, `Cargo.toml:70`, `lib.rs` `.setup:418`, `parakeet_engine.rs:598`, `api.rs:249/1286/1411`, `tauri.conf.json:115-121`).
- [ ] No placeholders, no unimplementable "pray it works" steps — every behavior is testable or has an exact verification command.
- [ ] No Phase 3+ work leaks in (updater re-pointing, signing, CI, release, DB migration all classified/deferred, not implemented).
- [ ] Product AI networking is preserved and explicitly not privacy-gated.
- [ ] Truly zero telemetry when disabled: no committed key, no auto-init, no-op client, frontend gate — four independent guarantees, each verified.
- [ ] Meeting content structurally excluded from analytics payloads (allowlist + audited tracker methods + tests).
- [ ] Plan is committed as `docs: plan Sivlo privacy and analytics hardening` (plan-only commit; working tree otherwise clean).

## Report Format

After completing this phase, return this report:

- **Plan path** — `docs/superpowers/plans/2026-08-16-sivlo-privacy-network-analytics.md`
- **Network inventory findings** — summary of the classified surfaces (e.g., ANALYTICS_TELEMETRY x4, PRODUCT_AI_NETWORK x6, MODEL_DOWNLOAD x3, UPDATER_NETWORK x1, EXTERNAL_LINK x4, LOCAL_ONLY x1, LEGACY_UPSTREAM x1, DEAD CODE x1, OTHER (build-time) x1, none for crash reporting)
- **Active inherited telemetry** — the one real path: `init_analytics` (commands.rs:12-14) hardcoded upstream Meetily PostHog key `phc_Aa9PqeCkDkVbtbRsYjtmHANBfcscjCVupxZwrtL5vZ77` + `https://us.i.posthog.com` + `enabled: true`, invoked only after frontend opt-in; plus the `meetily_user_id` sessionStorage key and full-UA `os_version` in `analytics.ts`
- **Consent model** — single frontend source of truth `analytics.json` → `analyticsOptedIn` (default false); Rust holds no consent and cannot self-enable
- **Protected data** — audio, transcripts, titles, summaries, notes, prompts, responses, file paths structurally excluded from analytics via allowlist
- **Product network preserved** — OpenAI/Groq/Anthropic/OpenRouter/Ollama/custom completions + HuggingFace/parakeet model downloads unchanged; CSP untouched
- **Task list** — Task 1..6 (inventory baseline, neutralize upstream identity, Rust allowlist, frontend guard + identifier/device cleanup, full verification + static audit + docs, self-review + peer review)
- **Phase 2 acceptance gate** — all 12 gate items incl. `bun tests green`, `pnpm build green`, `cargo test green`, `cargo check green`, and the explicit "analytics entirely disabled for v0.1.0" valid-passing-state item
- **Self-review** — all checklist items resolved
- **Working tree** — clean before/after; only the plan file (+ roadmap posture note, if added) committed
- **Commit SHA** — of `docs: plan Sivlo privacy and analytics hardening`
