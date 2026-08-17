import { describe, expect, test } from "bun:test";
import {
  parseCitationMarkers,
  resolveCitation,
} from "../../../src/features/ask-sivlo/citations";
import type { AskSivloCitation } from "../../../src/features/ask-sivlo/types";

function makeCitation(sourceId: string): AskSivloCitation {
  return {
    sourceId,
    meetingId: "m1",
    meetingTitle: "Test Meeting",
    sourceType: "transcript",
    excerpt: "excerpt text",
  };
}

describe("parseCitationMarkers", () => {
  test("basic", () => {
    const segments = parseCitationMarkers("Hello [S1] world");
    expect(segments).toEqual([
      { type: "text", text: "Hello " },
      { type: "citation", citationId: "S1" },
      { type: "text", text: " world" },
    ]);
  });

  test("no citations", () => {
    const segments = parseCitationMarkers("Hello world");
    expect(segments).toEqual([{ type: "text", text: "Hello world" }]);
  });

  test("multiple", () => {
    const segments = parseCitationMarkers("[S1] and [S2]");
    expect(segments).toEqual([
      { type: "citation", citationId: "S1" },
      { type: "text", text: " and " },
      { type: "citation", citationId: "S2" },
    ]);
  });

  test("consecutive citations", () => {
    const segments = parseCitationMarkers("[S1][S2]");
    expect(segments).toEqual([
      { type: "citation", citationId: "S1" },
      { type: "citation", citationId: "S2" },
    ]);
  });

  test("marker at start", () => {
    const segments = parseCitationMarkers("[S3]hello");
    expect(segments).toEqual([
      { type: "citation", citationId: "S3" },
      { type: "text", text: "hello" },
    ]);
  });

  test("marker at end", () => {
    const segments = parseCitationMarkers("hello[S3]");
    expect(segments).toEqual([
      { type: "text", text: "hello" },
      { type: "citation", citationId: "S3" },
    ]);
  });

  test("empty string", () => {
    expect(parseCitationMarkers("")).toEqual([]);
  });

  test("malformed [S] stays text", () => {
    const segments = parseCitationMarkers("[S] hello");
    expect(segments).toEqual([{ type: "text", text: "[S] hello" }]);
  });

  test("malformed [Sabc] stays text", () => {
    const segments = parseCitationMarkers("[Sabc] hello");
    expect(segments).toEqual([{ type: "text", text: "[Sabc] hello" }]);
  });

  test("unclosed [S1 stays text", () => {
    const segments = parseCitationMarkers("[S1 hello");
    expect(segments).toEqual([{ type: "text", text: "[S1 hello" }]);
  });

  test("lowercase [s1] parsed and normalized to S1", () => {
    const segments = parseCitationMarkers("Hello [s1] world");
    expect(segments).toEqual([
      { type: "text", text: "Hello " },
      { type: "citation", citationId: "S1" },
      { type: "text", text: " world" },
    ]);
  });

  test("mixed case [s2] normalized", () => {
    const segments = parseCitationMarkers("[s2] and [S2]");
    expect(segments).toEqual([
      { type: "citation", citationId: "S2" },
      { type: "text", text: " and " },
      { type: "citation", citationId: "S2" },
    ]);
  });

  test("multi-digit source id", () => {
    const segments = parseCitationMarkers("[S12] hello [S999]");
    expect(segments).toEqual([
      { type: "citation", citationId: "S12" },
      { type: "text", text: " hello " },
      { type: "citation", citationId: "S999" },
    ]);
  });
});

describe("resolveCitation", () => {
  test("found", () => {
    const citations = [makeCitation("S1"), makeCitation("S2")];
    const result = resolveCitation("S1", citations);
    expect(result).toBeDefined();
    expect(result!.sourceId).toBe("S1");
  });

  test("not found", () => {
    const citations = [makeCitation("S1")];
    expect(resolveCitation("S99", citations)).toBeUndefined();
  });

  test("empty array returns undefined", () => {
    expect(resolveCitation("S1", [])).toBeUndefined();
  });
});
