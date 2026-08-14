import { describe, expect, test } from "bun:test";
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SearchRequestTracker,
  normalizeSearchResults,
  shouldRunSearch,
} from "../../src/features/search/search";
import { PALETTE_COMMANDS } from "../../src/components/sivlo/command-palette/commands";

describe("shouldRunSearch", () => {
  test("returns false for empty or whitespace-only queries", () => {
    expect(shouldRunSearch("")).toBe(false);
    expect(shouldRunSearch("   ")).toBe(false);
  });

  test("returns false below the minimum query length", () => {
    expect(shouldRunSearch("a")).toBe(false);
    expect(shouldRunSearch(" a ")).toBe(false);
  });

  test("returns true at or above the minimum query length", () => {
    expect(shouldRunSearch("ab")).toBe(true);
    expect(shouldRunSearch("  pricing  ")).toBe(true);
  });

  test("respects a custom minimum length", () => {
    expect(shouldRunSearch("four", 5)).toBe(false);
    expect(shouldRunSearch("notes", 5)).toBe(true);
  });

  test("exposes the configured thresholds", () => {
    expect(MIN_SEARCH_QUERY_LENGTH).toBe(2);
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});

describe("normalizeSearchResults", () => {
  test("maps backend results to the UI shape", () => {
    const results = normalizeSearchResults([
      { id: "m1", title: "Standup", matchContext: "we shipped it", timestamp: "14:30:05" },
    ]);
    expect(results).toEqual([
      { id: "m1", title: "Standup", snippet: "we shipped it", timestamp: "14:30:05" },
    ]);
  });

  test("returns an empty array for empty input", () => {
    expect(normalizeSearchResults([])).toEqual([]);
  });
});

describe("SearchRequestTracker", () => {
  test("marks the latest request as current", () => {
    const tracker = new SearchRequestTracker();
    const first = tracker.next();
    const second = tracker.next();
    expect(tracker.isLatest(first)).toBe(false);
    expect(tracker.isLatest(second)).toBe(true);
  });

  test("reset invalidates all in-flight requests", () => {
    const tracker = new SearchRequestTracker();
    const request = tracker.next();
    tracker.reset();
    expect(tracker.isLatest(request)).toBe(false);
  });
});

describe("command palette commands", () => {
  test("exposes the expected commands in order", () => {
    expect(PALETTE_COMMANDS.map(command => command.id)).toEqual([
      "start-recording",
      "import-audio",
      "home",
      "meetings",
      "search",
      "settings",
    ]);
  });

  test("every command has a label, a group, and keywords", () => {
    for (const command of PALETTE_COMMANDS) {
      expect(command.label.length).toBeGreaterThan(0);
      expect(["Actions", "Navigation"]).toContain(command.group);
      expect(command.keywords.length).toBeGreaterThan(0);
    }
  });
});
