import { describe, expect, test } from "bun:test";
import {
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

  test('"/search" maps to search', () => {
    expect(getActiveNavigationItem("/search")).toBe("search");
  });

  test('"/search" with query string maps to search', () => {
    expect(getActiveNavigationItem("/search?q=notes")).toBe("search");
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
});
