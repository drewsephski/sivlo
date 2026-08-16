# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS landing site in a new `landing/` directory — a standalone marketing page separate from the Tauri app shell. No framework. Chosen by the user on 2026-08-16.

## Users

Primary: solo professionals, consultants, lawyers, founders, and small teams who attend many meetings (internal + client) and need dependable meeting records without shipping sensitive conversations to a cloud vendor. They are privacy-conscious, value data sovereignty, and already run on macOS.

## Product Purpose

Sivlo is a privacy-first AI meeting assistant for macOS. It records meetings, transcribes them in real time with on-device speech recognition, and generates summaries, actions, and decisions — entirely on the user's machine. Nothing leaves the device; meeting content (audio, transcripts, summaries, notes, titles) is never an analytics payload. Success on the landing page: a first-time visitor understands, in seconds, that Sivlo is a beautiful local meeting assistant that keeps every word on their device, and downloads the macOS beta.

## Positioning

The meaningful position: professional audio capture + real-time transcription + meeting intelligence, with total data sovereignty. No cloud round-trip, no vendor lock-in, no uploads. A competing product could not truthfully copy "every word stays on your device" while still delivering live transcription and summaries. v0.1.0 is a public beta, distributed only for macOS (Apple Silicon + Intel), macOS 13+, as direct-download notarized DMGs.

## Operating Context

The v0.1.0 product surface relevant to marketing:

- Records at 48kHz with professional audio mixing (RMS-based ducking so system audio never drowns the speaker), contrasted with VAD-filtered speech sent to transcription.
- Real-time on-device transcription via Whisper (whisper-rs), GPU-accelerated (Metal on macOS, CUDA/Vulkan elsewhere).
- Captures both microphone and system/meeting audio; on macOS system audio requires capture via ScreenCaptureKit / a virtual device.
- Post-meeting: AI summary, AI meeting title, actions & decisions extraction, persistent notes, and full-text search across meetings.
- Optional, opt-in-only, default-OFF analytics. Meeting content is never an analytics payload.
- The app also ingests audio files (betas) and recovers interrupted transcripts.

## Capabilities and Constraints

- Terminology used in the app and docs: "transcript", "summary", "actions / decisions", "notes", "search", "meeting intelligence".
- Brand identity: **Sivlo**, lowercase wordmark "sivlo", tagline "Turn conversations into working memory.", description "Private meeting intelligence that records, understands, and remembers — on your device."
- Distribution: direct-download DMGs, no App Store for v0.1.0. Two architectures (aarch64 / x86_64). Public download surface: GitHub releases of `drewsephski/sivlo-releases`.
- The source repository and release repository are separate; the site links to the release/download surface, never to private source.
- Undecided (not to be invented): pricing (Community can remain free; PRO exists upstream but is not confirmed for Sivlo), future platforms (Windows/Linux out of scope for v0.1.0), and the final website domain.

## Brand Commitments

User-specified design direction on 2026-08-16: **stunning, premium, minimal**. The page must read as high-end, spare, and confident — not noisy or template-like.

- Name "Sivlo", lowercase wordmark "sivlo".
- Tagline and description as above are binding copy.
- Blue is the incumbent app accent (`--primary: hsl(216 91% 58%)`); light theme predominates in the app.
- Existing logo/wordmark assets: `frontend/public/brand/sivlo-icon.png`, `sivlo-logo.png`, `sivlo-logo-master.png`.
- The page should showcase the real Sivlo application UI as product proof (existing screenshots under `docs/`), consistent with the user's choice to show real app screenshots.

## Evidence on Hand

- `frontend/src/config/brand.ts` — name, wordmark, tagline, description.
- `frontend/public/brand/sivlo-icon.png`, `sivlo-logo.png`, `sivlo-logo-master.png` — brand marks.
- `docs/superpowers/specs/2026-08-15-sivlo-release-prep-design.md` — v0.1.0 release plan: macOS-only beta, DMG distribution, direct download, release repo `drewsephski/sivlo-releases`, data-sovereignty/privacy principles, opt-in analytics.
- `docs/home.png`, `docs/pv2.0.png`, `docs/pv2.1.png`, `docs/summary.png`, `docs/transcription.png`, `docs/editor.png`, `docs/meetily_demo.gif`, plus others — incumbent app UI screenshots (some labelled Meetily-era; prefer current Sivlo-UI shots when available).
- `PRIVACY_POLICY.md` — existing privacy messaging and structure to align with.
- No invented testimonials, no fabricated customers, metrics, or pricing. Absence is stated; future work must not fabricate these.

## Product Principles

1. Privacy is the product, not a feature: "every word stays on your device" must be demonstrable and never undermined by copy that implies uploads.
2. Premium minimalism: the page persuades through restraint, precision, and confidence — the same restraint the product claims for itself.
3. Prove, don't claim: real product UI, real transcript/summary capability, and concrete privacy mechanics carry more weight than adjectives.
4. One clear action: download the macOS beta; the visitor is never asked to do more than one thing.
5. On-device, so honest: no cloud claims, no cross-platform claims, no invented social proof.

## Accessibility & Inclusion

No product-specific accessibility requirement was established. Standard inclusive-web baseline applies: semantic landmarks, keyboard-operable controls, visible focus, sufficient contrast, and `prefers-reduced-motion` support.