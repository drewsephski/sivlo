# E2E Tests (scaffold)

End-to-end tests for Sivlo using Playwright. Full Tauri E2E requires the
[tauri-driver](https://tauri.app/develop/tests/webdriver/) setup, which is
planned for a future release.

## Current status

- **Unit/smoke tests** run via `bun test` in CI (see `.github/workflows/pr-ci.yml`)
- **E2E scaffold** below validates the exported Next.js build in a browser context

## Setup (when ready)

```bash
cd frontend
pnpm add -D @playwright/test
npx playwright install chromium
```

## Run

```bash
cd frontend
pnpm exec playwright test
```

## Planned coverage

1. Landing page loads and download link is present
2. App shell renders after Tauri webview launch (requires tauri-driver)
3. Record → stop → transcript appears (requires tauri-driver + audio mocks)
