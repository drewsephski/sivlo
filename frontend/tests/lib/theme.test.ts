import { describe, expect, test } from "bun:test";
import {
  isThemeMode,
  parseStoredTheme,
  resolveTheme,
  THEME_MODES,
} from "../../src/features/theme/theme";

describe("resolveTheme", () => {
  test("system + dark preference resolves to dark", () => {
    expect(resolveTheme("system", true)).toBe("dark");
  });

  test("system + light preference resolves to light", () => {
    expect(resolveTheme("system", false)).toBe("light");
  });

  test("explicit dark overrides system light", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  test("explicit light overrides system dark", () => {
    expect(resolveTheme("light", true)).toBe("light");
  });
});

describe("parseStoredTheme", () => {
  test("accepts every valid theme mode", () => {
    for (const mode of THEME_MODES) {
      expect(parseStoredTheme(mode)).toBe(mode);
    }
  });

  test("invalid stored theme falls back to system", () => {
    expect(parseStoredTheme("neon")).toBe("system");
    expect(parseStoredTheme("")).toBe("system");
    expect(parseStoredTheme(null)).toBe("system");
    expect(parseStoredTheme(undefined)).toBe("system");
    expect(parseStoredTheme(42)).toBe("system");
    expect(parseStoredTheme({})).toBe("system");
    expect(parseStoredTheme(["dark"])).toBe("system");
  });

  test("case-sensitive: uppercase is not a valid mode", () => {
    expect(parseStoredTheme("DARK")).toBe("system");
    expect(parseStoredTheme("Light")).toBe("system");
  });
});

describe("isThemeMode", () => {
  test("accepts valid modes", () => {
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isThemeMode("auto")).toBe(false);
    expect(isThemeMode(0)).toBe(false);
    expect(isThemeMode(true)).toBe(false);
  });
});
