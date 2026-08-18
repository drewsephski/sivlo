# Sivlo Privacy Policy

*Last updated: August 18, 2026*

## Our commitment

Sivlo is built on the principle that your meeting data belongs to you. This policy explains how the Sivlo desktop app handles your information.

## Local-first by default

- **Audio recordings** are stored on your device and are never uploaded by Sivlo.
- **Transcription** runs locally using Whisper or Parakeet models on your machine.
- **Meeting transcripts, summaries, and notes** are stored in a local SQLite database on your device.
- **No account is required** to use Sivlo.

## Optional cloud AI providers

If you choose to configure a cloud AI provider (e.g., Claude, Groq, OpenRouter, OpenAI), transcript or summary text **may be sent to that provider** to generate results. This is entirely under your control:

- Cloud providers are never enabled by default.
- You provide and manage your own API keys.
- API keys are stored in your operating system's secure credential store (macOS Keychain), not in plaintext database files.

## Usage analytics (opt-in only)

Analytics are **disabled by default**. If you choose to enable them, Sivlo collects minimal, anonymized usage data:

**What may be collected (when opted in):**
- Feature usage patterns (which tools you use)
- Session duration and frequency
- App version, platform, and architecture
- Error categories (not meeting content)

**What is never collected:**
- Meeting audio, transcripts, summaries, or notes
- Meeting titles or participant names
- API keys or credentials
- File paths or personal identifiers beyond an anonymous device ID

Analytics use [PostHog](https://posthog.com/) and only activate when a build-time analytics key is present **and** you opt in via Settings.

## Data storage and deletion

- All meeting data is stored locally in your app data directory.
- You can delete individual meetings or uninstall the app to remove all local data.
- Analytics data (if opted in) is governed by PostHog's data retention policies.

## Children's privacy

Sivlo is not directed at children under 13. We do not knowingly collect information from children.

## Changes to this policy

We may update this policy as Sivlo evolves. Material changes will be reflected in the app and in this document with an updated date.

## Contact

For privacy questions: open an issue on [GitHub](https://github.com/drewsephski/sivlo/issues) or email the address listed in [SECURITY.md](SECURITY.md).

## Open source

Sivlo is open source (MIT). You can inspect exactly how data is handled in the [source code](https://github.com/drewsephski/sivlo).
