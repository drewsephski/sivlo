import { describe, expect, test } from "bun:test";
import {
  formatMeetingDate,
  formatMeetingTime,
  getDayLabel,
  groupMeetingsByDay,
  parseMeetingTimestamp,
  sortMeetingsNewestFirst,
} from "../../src/features/meetings";
import type { MeetingRecord } from "../../src/features/meetings";

const NOW = new Date(2026, 7, 14, 12, 0, 0); // 2026-08-14 12:00 local

function record(id: string, title: string, createdAt: string | null): MeetingRecord {
  return { id, title, createdAt, updatedAt: createdAt, folderPath: null };
}

const TODAY = new Date(2026, 7, 14, 9, 30, 0).toISOString();
const YESTERDAY = new Date(2026, 7, 13, 15, 0, 0).toISOString();
const EARLIER = new Date(2026, 7, 1, 10, 0, 0).toISOString();

describe("parseMeetingTimestamp", () => {
  test("parses RFC3339 timestamps", () => {
    expect(parseMeetingTimestamp(TODAY)).toBe(Date.parse(TODAY));
  });

  test("returns null for missing or invalid values", () => {
    expect(parseMeetingTimestamp(null)).toBeNull();
    expect(parseMeetingTimestamp(undefined)).toBeNull();
    expect(parseMeetingTimestamp("")).toBeNull();
    expect(parseMeetingTimestamp("not-a-date")).toBeNull();
  });
});

describe("getDayLabel", () => {
  test("classifies today, yesterday, and earlier", () => {
    expect(getDayLabel(Date.parse(TODAY), NOW)).toBe("Today");
    expect(getDayLabel(Date.parse(YESTERDAY), NOW)).toBe("Yesterday");
    expect(getDayLabel(Date.parse(EARLIER), NOW)).toBe("Earlier");
  });

  test("treats unknown timestamps as Earlier", () => {
    expect(getDayLabel(null, NOW)).toBe("Earlier");
  });
});

describe("sortMeetingsNewestFirst", () => {
  test("sorts by createdAt descending", () => {
    const meetings = [
      record("a", "Old", YESTERDAY),
      record("b", "New", TODAY),
      record("c", "Earliest", EARLIER),
    ];
    expect(sortMeetingsNewestFirst(meetings).map(m => m.id)).toEqual(["b", "a", "c"]);
  });

  test("keeps unknown-timestamp meetings last", () => {
    const meetings = [
      record("a", "Old", YESTERDAY),
      record("b", "Unknown", null),
      record("c", "New", TODAY),
    ];
    expect(sortMeetingsNewestFirst(meetings).map(m => m.id)).toEqual(["c", "a", "b"]);
  });

  test("does not mutate the input array", () => {
    const meetings = [record("a", "Old", YESTERDAY), record("b", "New", TODAY)];
    const snapshot = [...meetings];
    sortMeetingsNewestFirst(meetings);
    expect(meetings).toEqual(snapshot);
  });

  test("breaks timestamp ties deterministically by title", () => {
    const meetings = [record("b", "Beta", TODAY), record("a", "Alpha", TODAY)];
    expect(sortMeetingsNewestFirst(meetings).map(m => m.id)).toEqual(["a", "b"]);
  });
});

describe("groupMeetingsByDay", () => {
  test("groups into Today / Yesterday / Earlier in order", () => {
    const meetings = [
      record("old", "Old", EARLIER),
      record("today", "Today", TODAY),
      record("yesterday", "Yesterday", YESTERDAY),
    ];

    const groups = groupMeetingsByDay(meetings, NOW);
    expect(groups.map(g => g.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0].meetings.map(m => m.id)).toEqual(["today"]);
    expect(groups[1].meetings.map(m => m.id)).toEqual(["yesterday"]);
    expect(groups[2].meetings.map(m => m.id)).toEqual(["old"]);
  });

  test("omits empty groups", () => {
    const groups = groupMeetingsByDay([record("old", "Old", EARLIER)], NOW);
    expect(groups.map(g => g.label)).toEqual(["Earlier"]);
  });

  test("returns empty array for no meetings", () => {
    expect(groupMeetingsByDay([], NOW)).toEqual([]);
  });

  test("groups multiple meetings within the same day", () => {
    const meetings = [
      record("m2", "Second", new Date(2026, 7, 14, 11, 0, 0).toISOString()),
      record("m1", "First", TODAY),
    ];
    const groups = groupMeetingsByDay(meetings, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].meetings.map(m => m.id)).toEqual(["m2", "m1"]);
  });

  test("handles unknown timestamps gracefully in Earlier", () => {
    const meetings = [record("unknown", "Unknown", null), record("today", "Today", TODAY)];
    const groups = groupMeetingsByDay(meetings, NOW);
    expect(groups.map(g => g.label)).toEqual(["Today", "Earlier"]);
    expect(groups[1].meetings.map(m => m.id)).toEqual(["unknown"]);
  });
});

describe("formatMeetingTime / formatMeetingDate", () => {
  test("formats a valid timestamp", () => {
    const value = new Date(2026, 7, 14, 9, 5, 0).toISOString();
    expect(formatMeetingTime(value)).toContain("9:05");
    expect(formatMeetingDate(value)).toContain("2026");
  });

  test("returns empty / fallback for unknown timestamps", () => {
    expect(formatMeetingTime(null)).toBe("");
    expect(formatMeetingTime("garbage")).toBe("");
    expect(formatMeetingDate(null)).toBe("Unknown date");
  });
});
