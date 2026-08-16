import { describe, expect, test } from "bun:test";
import { isDefaultRecordingTitle } from "../../src/lib/meeting-titles";

describe("isDefaultRecordingTitle", () => {
  test("matches the frontend-generated recording title format", () => {
    expect(isDefaultRecordingTitle("Meeting 15_08_26_10_37_29")).toBe(true);
    expect(isDefaultRecordingTitle("Meeting 01_01_26_00_00_00")).toBe(true);
  });

  test("matches the backend default title format", () => {
    expect(isDefaultRecordingTitle("Meeting 2026-08-14_09-30-00")).toBe(true);
  });

  test("matches the 'New Meeting' fallback default title", () => {
    expect(isDefaultRecordingTitle("New Meeting")).toBe(true);
    expect(isDefaultRecordingTitle("  New Meeting  ")).toBe(true);
  });

  test("rejects user-customized titles", () => {
    expect(isDefaultRecordingTitle("Q3 Planning Sync")).toBe(false);
    expect(isDefaultRecordingTitle("Meeting with Alice")).toBe(false);
    expect(isDefaultRecordingTitle("My Meeting 15_08_26_10_37_29")).toBe(false);
    expect(isDefaultRecordingTitle("Meeting")).toBe(false);
    expect(isDefaultRecordingTitle("")).toBe(false);
  });

  test("ignores surrounding whitespace", () => {
    expect(isDefaultRecordingTitle("  Meeting 15_08_26_10_37_29  ")).toBe(true);
  });
});
