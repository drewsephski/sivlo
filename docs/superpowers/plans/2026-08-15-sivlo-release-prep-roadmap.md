# Sivlo v0.1.0 Release Preparation Roadmap

> Approved design spec: [2026-08-15-sivlo-release-prep-design.md](../specs/2026-08-15-sivlo-release-prep-design.md)
>
> This roadmap is the phase-by-phase master plan. Each phase has its own detailed implementation plan; only Phase 1 has a detailed plan written so far.

## Phases

| # | Phase | Scope | Repo vs External | Depends on | Acceptance gate |
|---|-------|-------|------------------|------------|-----------------|
| 1 | Production identity + clean storage | Bundle identifier `com.drewsepeczi.sivlo`, `mainBinaryName`, min macOS 13, Sivlo-owned storage paths (recordings, templates, model fallbacks, notifications settings), `SivloRecoveryDB` IndexedDB, remove automatic first-launch legacy import | Repo (no secrets) | — | Detailed plan `2026-08-15-sivlo-production-identity-storage.md` fully implemented: `cargo test` green, `pnpm build`/`pnpm lint` green, identity audit grep shows zero active Meetily storage/identity references |
| 2 | Privacy / network / analytics audit | Audit PostHog (Rust `analytics/` module + `frontend/src/lib/analytics.ts` + `posthog-rs`), all network calls, stored identifiers; ensure zero telemetry/events pre-consent; document a Sivlo privacy posture | Repo (no new secrets; analytics ships disabled in v0.1.0) | — | Audit document merged; no network/telemetry active before user consent; decision recorded for whether to re-enable for v0.1.0 |
| 3 | Tauri updater ownership + key configuration | Replace Meetily pubkey/endpoints with Sivlo updater keypair and Sivlo update feed; signing mandatory | **External/manual required:** generate Sivlo updater keypair, back it up offline, configure GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Repo: replace pubkey and endpoints in `tauri.conf.json` | — | New keypair backed up offline; config points to Sivlo feed; signature verification still mandatory on all artifacts |
| 4 | macOS Developer ID signing/notarization configuration | Developer ID cert + notarization for `tauri build`; hardened runtime + entitlements | **External/manual required:** Apple Developer Program account, Developer ID Application certificate, App Store Connect Team API key (`.p8`); GitHub secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_PRIVATE_KEY`. Repo: signing/notarization config | — | A locally/CI-signed, notarized DMG passes `spctl --assess` / Gatekeeper on a clean Mac |
| 5 | Private GitHub Actions architecture matrix | Single tag-triggered workflow with two macOS arch jobs (aarch64, x86_64): test → build → sign → notarize → updater artifact → private release | Repo; requires macOS runners for both arches on the private repo | 3, 4 | Both architecture jobs complete independently on a tag; artifacts stored on the private release |
| 6 | Public sivlo-releases publishing | Publish DMGs/archives/signatures + release notes to a public Sivlo releases repo | **External/manual required:** create public repo `drewsephski/sivlo-releases`, fine-grained PAT scoped to it, GitHub secret `SIVLO_RELEASES_PAT`. Repo: publish job | 5 | Dry-run publish lands on a draft/prerelease with all expected assets; repo contains no secrets |
| 7 | latest.json / update-feed generation | Generate Tauri-compatible static `latest.json`/update feed with both `darwin-aarch64` and `darwin-x86_64` entries; embedded signatures; version consistency check | Repo (hosted on public repo from 6) | 6 | Feed parses; both platforms present; signatures correspond to published artifacts |
| 8 | Release validation gates | Pre-build version consistency (tag ↔ `tauri.conf.json` ↔ `Cargo.toml` ↔ `package.json`); post-build artifact validation (arch, version, bundle id `com.drewsepeczi.sivlo`, code signature, notarization, Gatekeeper, updater archive + signature, `latest.json`); fail-closed | Repo | 7 | All validation steps pass and failures abort the release; no unvalidated artifact published |
| 9 | v0.0.9 → v0.1.0 updater dress rehearsal | Publish a v0.0.9 prerelease, then v0.1.0; install v0.0.9 on a real Mac, update and restart, verify data persistence and that no Meetily paths are touched | Repo + **manual:** physical Mac(s) | 8 | End-to-end updater path proven on real hardware; user data persists across the update |
| 10 | v0.1.0 public-beta smoke test | Apple Silicon: DMG → install → Gatekeeper → record → transcribe → summarize → title → actions/decisions → notes → search → relaunch → persistence; inspect icons/About/identity; no Meetily branding. Intel: CI-validated; runtime test documented if no hardware | **Manual:** physical Apple Silicon Mac (Intel runtime pending hardware) | 9 | Smoke test passes on Apple Silicon; Intel status documented |

## Dependencies

```
1 (identity/storage)
2 (privacy/analytics)   — parallelizable with 1
3 (updater keys)        — parallelizable with 1, 2, 4
4 (Apple signing)       — parallelizable with 1, 2, 3
        │
        ▼
5 (CI matrix)  ── requires 3 + 4 secrets
        │
        ▼
6 (public publishing) ── requires 5
        │
        ▼
7 (update feed) ── requires 6
        │
        ▼
8 (validation gates) ── requires 7
        │
        ▼
9 (dress rehearsal) ── requires 8 + hardware
        │
        ▼
10 (public-beta smoke) ── requires 9 + hardware
```

Nothing after Phase 1 should be implemented until Phase 1's acceptance gate has passed, because every later phase assumes the Sivlo identity and clean storage are already in place.

## External accounts, secrets, and hardware

| Item | Where needed | Owned by | Notes |
|------|--------------|----------|-------|
| Tauri updater keypair | Phase 3 | Developer (offline backup mandatory) | Loss = cannot sign future updates; rotation breaks installed clients |
| GitHub secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Phase 3 | Developer (private repo) | One pair for the whole project |
| Apple Developer Program account + Developer ID cert | Phase 4 | Developer | Requires paid enrollment |
| App Store Connect Team API key (`.p8`) | Phase 4 | Developer | Store in GitHub secrets, never in repo |
| GitHub secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_PRIVATE_KEY` | Phase 4 | Developer | |
| Public repo `drewsephski/sivlo-releases` | Phase 6 | Developer | Must be public; contains no secrets |
| GitHub secret `SIVLO_RELEASES_PAT` (fine-grained, scoped to that repo) | Phase 6 | Developer | Read/write to sivlo-releases only |
| Physical Apple Silicon Mac | Phases 9–10 | Developer | Needed for dress rehearsal + smoke test |
| Intel Mac (optional) | Phases 9–10 | Developer | x86_64 runtime test documented if unavailable |

## Repo work vs external/manual setup

- **Pure repo work:** Phases 1, 2, 5, 7, 8.
- **Repo + external/manual:** Phases 3, 4 (key/cert creation + secrets before config lands), 6 (repo + PAT before publish job), 9 (hardware), 10 (hardware).

## Irreversible / high-risk operations

1. **Updater private key generation (Phase 3).** If lost, Sivlo can never ship another signed update. Back up offline before first use; never commit the key.
2. **Bundle identifier switch (Phase 1).** Permanently splits the new app from the old Meetily storage directories. Intended; old data must remain untouched — never deleted, moved, or migrated.
3. **Removing automatic first-launch legacy import (Phase 1).** Old Homebrew/legacy data is no longer auto-copied into Sivlo. Intended; the data itself is untouched and remains importable through the preserved legacy-import UI.
4. **Public publishing (Phases 6, 9).** Released versions are immutable; a bad asset cannot be silently replaced at the same version.
5. **Apple certificate/`.p8` handling (Phase 4).** Never stored in the repository; only in GitHub secrets and a secured keychain.

## Preserved non-goals

- No automatic migration of any Meetily data into Sivlo storage.
- No re-enabling the old FastAPI backend or any cloud/network dependency for transcription/summarization.
- No new product features; no re-theming of the app UI.
- No "Meetily" brand rollover or partial rebranding of legacy user data.
- No changes to the archived Python backend under `backend/`.
- No analytics re-enablement without the Phase 2 privacy decision.

## Phase detail plans

- Phase 1: `2026-08-15-sivlo-production-identity-storage.md` (written; the only detailed plan so far).
- Phases 2–10: write a detailed plan per phase when that phase starts, following the same structure and review process used for Phase 1.

## Phase 2 privacy posture (recorded)

Decision recorded for the Phase 2 acceptance gate: **analytics ships disabled in v0.1.0** — the telemetry opt-in remains user-controlled (off by default) and no analytics is ever transmitted without it.

- No PostHog/analytics credentials are committed to the repository (`rg "phc_"` and `rg "us\.i\.posthog\.com"` in `frontend/src-tauri` return nothing).
- Analytics config is built only from `SIVLO_ANALYTICS_API_KEY` / `SIVLO_ANALYTICS_HOST` env vars; absent both, the inner PostHog client is never constructed and all track/identify commands are no-ops with no network I/O.
- Property payloads are deny-by-default: a Rust-side allowlist (`frontend/src-tauri/src/analytics/analytics.rs`) and a mirroring frontend guard (`frontend/src/features/analytics/guard.ts`) drop every key not in the allowlist, so meeting content (transcripts, titles, summaries, notes, prompts, responses, paths, device names) cannot be captured.
- Device identity comes from the OS plugin (`app_platform`, `app_os_version`, `app_arch`); the `meetily_user_id` fallback and `navigator.userAgent`-based detection were removed.
- Product networking (OpenAI/Anthropic/Groq/OpenRouter/Ollama, model downloads) is untouched; only telemetry was hardened.
- To re-enable analytics in a future release, the "No analytics re-enablement" non-goal above must be revisited and a new decision recorded.

