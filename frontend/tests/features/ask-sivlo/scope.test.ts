import { describe, expect, test } from "bun:test";
import {
  createAllScope,
  createMeetingScope,
  isMeetingScope,
} from "../../../src/features/ask-sivlo/scope";

describe("scope helpers", () => {
  test("createAllScope", () => {
    expect(createAllScope()).toEqual({ kind: "all" });
  });

  test("createMeetingScope", () => {
    expect(createMeetingScope("x")).toEqual({ kind: "meeting", meetingId: "x" });
  });

  test("isMeetingScope", () => {
    expect(isMeetingScope({ kind: "meeting", meetingId: "m1" })).toBe(true);
    expect(isMeetingScope({ kind: "all" })).toBe(false);
  });
});
