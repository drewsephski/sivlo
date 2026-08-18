import { describe, expect, test } from "bun:test";
import {
  buildAskSivloHistory,
  stripCitationMarkers,
  validateQuery,
} from "../../../src/features/ask-sivlo/history";
import type { AskSivloMessage } from "../../../src/features/ask-sivlo/types";

function makeMsg(role: "user" | "assistant", content: string): AskSivloMessage {
  return { id: crypto.randomUUID(), role, content, timestamp: Date.now() };
}

describe("buildAskSivloHistory", () => {
  test("current query not duplicated", () => {
    const prior = [
      makeMsg("user", "hello"),
      makeMsg("assistant", "hi"),
      makeMsg("user", "what's up"),
    ];
    const history = buildAskSivloHistory(prior);
    // History should contain only prior messages, not the current query
    const userMessages = history.filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(2);
    expect(history).toHaveLength(3);
  });

  test("only prior turns included", () => {
    const prior = [makeMsg("user", "q1"), makeMsg("assistant", "a1")];
    const history = buildAskSivloHistory(prior);
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("q1");
    expect(history[1].content).toBe("a1");
  });

  test("newest messages retained under message limit", () => {
    const prior: AskSivloMessage[] = Array.from({ length: 15 }, (_, i) =>
      makeMsg("user", `msg ${i}`),
    );
    const history = buildAskSivloHistory(prior, 10);
    expect(history).toHaveLength(10);
    // Should keep the last 10 (messages 5..14)
    expect(history[0].content).toBe("msg 5");
    expect(history[9].content).toBe("msg 14");
  });

  test("newest messages retained under character limit", () => {
    const prior: AskSivloMessage[] = [
      makeMsg("user", "x".repeat(2000)),
      makeMsg("assistant", "y".repeat(2000)),
      makeMsg("user", "z".repeat(2000)),
    ];
    const history = buildAskSivloHistory(prior, 100, 4000);
    // Total chars: 6000, budget 4000 — oldest should be dropped
    const totalChars = history.reduce(
      (sum, m) => sum + Array.from(m.content).length,
      0,
    );
    expect(totalChars).toBeLessThanOrEqual(4000);
    // The oldest message ("x" * 2000) should be dropped
    expect(history[0].content).toBe("y".repeat(2000));
  });

  test("citation markers stripped", () => {
    const prior = [makeMsg("assistant", "[S1] hello [S2] world")];
    const history = buildAskSivloHistory(prior);
    expect(history[0].content).toBe("hello  world");
  });

  test("Unicode character counting safe", () => {
    const content = "héllo wörld 🎉";
    const charCount = Array.from(content).length;
    expect(charCount).toBe(13); // not byte length, not UTF-16 length
    const prior = [makeMsg("user", content)];
    const history = buildAskSivloHistory(prior);
    expect(history[0].content).toBe(content);
  });

  test("empty messages filtered", () => {
    const prior = [
      makeMsg("user", "[S1] [S2]"),
      makeMsg("assistant", "  "),
      makeMsg("user", "real message"),
    ];
    const history = buildAskSivloHistory(prior);
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe("real message");
  });

  test("returns most recent prior history in chronological order", () => {
    const prior: AskSivloMessage[] = [
      makeMsg("user", "a"),
      makeMsg("assistant", "b"),
      makeMsg("user", "c"),
      makeMsg("assistant", "d"),
      makeMsg("user", "e"),
    ];
    const history = buildAskSivloHistory(prior);
    expect(history).toHaveLength(5);
    expect(history.map((m) => m.content)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("stripCitationMarkers", () => {
  test("strips uppercase citation markers", () => {
    expect(stripCitationMarkers("[S1] hello [S23]")).toBe(" hello ");
  });

  test("strips lowercase citation markers", () => {
    expect(stripCitationMarkers("[s3] hello [s10]")).toBe(" hello ");
  });
});

describe("validateQuery", () => {
  test("2 characters is invalid", () => {
    const result = validateQuery("ab");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("3 characters is valid", () => {
    expect(validateQuery("abc").valid).toBe(true);
  });

  test("4000 Unicode characters is valid", () => {
    expect(validateQuery("é".repeat(4000)).valid).toBe(true);
  });

  test("4001 Unicode characters is invalid", () => {
    const result = validateQuery("é".repeat(4001));
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
