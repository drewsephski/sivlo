import { parseStoredTheme, THEME_STORE_FILE, THEME_STORE_KEY, type ThemeMode } from './theme';

export async function loadThemePreference(): Promise<ThemeMode> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(THEME_STORE_FILE);
    const stored = await store.get(THEME_STORE_KEY);
    return parseStoredTheme(stored);
  } catch {
    return 'system';
  }
}

export async function saveThemePreference(theme: ThemeMode): Promise<void> {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    const store = await Store.load(THEME_STORE_FILE);
    await store.set(THEME_STORE_KEY, theme);
    await store.save();
  } catch {
    // Persistence is best-effort. Never crash the app over a storage failure.
  }
}
