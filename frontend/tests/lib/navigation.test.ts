import { describe, expect, test } from "bun:test";
import {
  CONTEXT_SIDEBAR_COLLAPSED_WIDTH,
  CONTEXT_SIDEBAR_WIDTH,
  getActiveNavigationItem,
  NAV_RAIL_WIDTH,
} from "../../src/components/sivlo/app-shell/navigation";

describe("getActiveNavigationItem", () => {
  test('"/" maps to home', () => {
    expect(getActiveNavigationItem("/")).toBe("home");
  });

  test('"/meetings" maps to meetings', () => {
    expect(getActiveNavigationItem("/meetings")).toBe("meetings");
  });

  test('"/settings" maps to settings', () => {
    expect(getActiveNavigationItem("/settings")).toBe("settings");
  });

  test('"/meeting-details" maps to meetings', () => {
    expect(getActiveNavigationItem("/meeting-details")).toBe("meetings");
  });

  test('"/meeting-details" with query string maps to meetings', () => {
    expect(getActiveNavigationItem("/meeting-details?id=123")).toBe("meetings");
  });

  test('"/notes/abc" maps to meetings', () => {
    expect(getActiveNavigationItem("/notes/abc")).toBe("meetings");
  });

  test("unknown route falls back to no active item", () => {
    expect(getActiveNavigationItem("/unknown")).toBeNull();
    expect(getActiveNavigationItem("")).toBeNull();
    expect(getActiveNavigationItem(undefined as unknown as string)).toBeNull();
  });
});

describe("shell width constants", () => {
  test("navigation rail is a single deliberate width", () => {
    expect(NAV_RAIL_WIDTH).toBe(64);
  });

  test("context sidebar widths are centralized", () => {
    expect(CONTEXT_SIDEBAR_WIDTH).toBe(256);
    expect(CONTEXT_SIDEBAR_COLLAPSED_WIDTH).toBe(64);
  });
});
