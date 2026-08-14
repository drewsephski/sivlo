export const THEME_MODES = ['system', 'light', 'dark'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORE_FILE = 'preferences.json';

export const THEME_STORE_KEY = 'theme';

export function isThemeMode(value: unknown): value is ThemeMode {
  return (
    typeof value === 'string' &&
    (THEME_MODES as readonly string[]).includes(value)
  );
}

export function resolveTheme(
  requestedTheme: ThemeMode,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (requestedTheme === 'dark') return 'dark';
  if (requestedTheme === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function parseStoredTheme(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : 'system';
}
