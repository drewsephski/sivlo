# ARCHIVED — DO NOT USE

This directory is **archived legacy code** from the upstream Meetily project.

## Status: Unsupported

- The Python/FastAPI backend, Docker setup, and standalone whisper-server are **not used by Sivlo**.
- The old FastAPI service had unauthenticated, development-oriented CORS (`allow_origins=["*"]`).
- **Do not** run, deploy, or extend code in this directory for current development.

## Supported architecture

Sivlo is a self-contained Tauri desktop application:

- UI: `frontend/src` (Next.js + React)
- Backend: `frontend/src-tauri` (Rust — audio, transcription, SQLite, summaries)

See the [root README](../README.md) and [docs/BUILDING.md](../docs/BUILDING.md).
