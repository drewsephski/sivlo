<div align="center">
    <h1>
        <img src="frontend/public/brand/sivlo-logo.png" alt="Sivlo" width="200" style="border-radius: 10px;" />
        <br>
        Private meeting intelligence
    </h1>
    <p>
        <a href="https://github.com/drewsephski/sivlo/releases/latest"><img src="https://img.shields.io/badge/macOS%20Beta-v0.1.1-blue" alt="macOS Beta"></a>
        <a href="LICENSE.md"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
    </p>
    <p align="center">
        <strong>Turn conversations into working memory.</strong><br>
        Record, transcribe, and summarize meetings entirely on your device.
    </p>
</div>

---

## What is Sivlo?

**Sivlo** is a privacy-first AI meeting assistant for macOS. It captures microphone and system audio, transcribes speech in real time with on-device models, and generates summaries, actions, and decisions — with **no account required** and **no cloud by default**.

> **v0.1.0 is a public macOS beta** (Apple Silicon + Intel, macOS 13+). Windows and Linux builds are not part of this release.

### Privacy by default

| Data | Default behavior |
|------|------------------|
| Audio & recordings | Stored locally only |
| Transcripts & summaries | Processed on-device (Whisper / Parakeet) |
| Meeting content | Never sent to analytics |
| Cloud AI (Claude, Groq, etc.) | **Optional** — only when you configure a provider |

## Download

Get the latest notarized DMG from **[GitHub Releases](https://github.com/drewsephski/sivlo/releases/latest)**.

Or visit the [landing page](landing/index.html) for an overview.

## Features

- **Real-time transcription** — Whisper and Parakeet, GPU-accelerated (Metal on macOS)
- **Professional audio mixing** — Mic + system audio with RMS ducking
- **Meeting intelligence** — Summaries, actions, decisions, notes, full-text search
- **Flexible AI** — Local Ollama by default; optional cloud providers (Claude, Groq, OpenRouter, custom endpoints)
- **Secure credential storage** — API keys stored in macOS Keychain, not plaintext SQLite
- **Auto-updates** — Signed, notarized builds with in-app update checks
- **Opt-in analytics** — Off by default; no meeting content in telemetry

## System requirements

- **macOS 13+** (Ventura or later)
- Apple Silicon (M1+) or Intel Mac
- Microphone permission; screen recording permission for system audio capture
- ~2 GB disk space for transcription models (varies by model size)

## Development

```bash
cd frontend
pnpm install
./clean_run.sh          # macOS dev build
./clean_build.sh        # Production build
```

See [docs/BUILDING.md](docs/BUILDING.md) for detailed platform instructions.

### Run tests

```bash
cd frontend
bun test                # Frontend unit tests
pnpm lint
cd src-tauri && cargo test   # Rust unit tests
```

## Architecture

Sivlo is a self-contained [Tauri 2](https://tauri.app/) desktop app:

- **Frontend** — Next.js + React (`frontend/src`)
- **Backend** — Rust audio pipeline, transcription, SQLite storage (`frontend/src-tauri`)

See [docs/architecture.md](docs/architecture.md) for details.

> The `backend/` directory contains an **archived** Python/FastAPI implementation from upstream Meetily. It is not used by Sivlo and must not be deployed.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md). Please open issues for bugs and feature requests.

## Security

Report vulnerabilities per [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE.md](LICENSE.md).

## Acknowledgments

Sivlo is forked from [Meetily](https://github.com/Zackriya-Solutions/meeting-minutes) by Zackriya Solutions. Additional credits in the upstream project for Whisper.cpp, Screenpipe, and Parakeet integrations.
