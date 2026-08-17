import { describe, expect, test, beforeEach } from "bun:test";
import {
  addMessage,
  clearChat,
  clearMessages,
  clearRetryRequest,
  getMessages,
  getRequestGeneration,
  getSnapshot,
  setRetryRequest,
  setScope,
  setLoading,
  subscribe,
} from "../../../src/features/ask-sivlo/askSivloStore";
import type { AskSivloMessage, AskSivloScope } from "../../../src/features/ask-sivlo/types";

function makeMessage(role: "user" | "assistant", content: string): AskSivloMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
  };
}

describe("askSivloStore", () => {
  beforeEach(() => {
    clearChat();
  });

  test("store starts empty", () => {
    expect(getMessages()).toEqual([]);
  });

  test("addMessage appends", () => {
    addMessage(makeMessage("user", "hello"));
    addMessage(makeMessage("assistant", "hi there"));
    expect(getMessages()).toHaveLength(2);
    expect(getMessages()[0].content).toBe("hello");
    expect(getMessages()[1].content).toBe("hi there");
  });

  test("clearMessages resets", () => {
    addMessage(makeMessage("user", "hello"));
    clearMessages();
    expect(getMessages()).toEqual([]);
  });

  test("clearMessages increments requestGeneration", () => {
    const genBefore = getRequestGeneration();
    clearMessages();
    expect(getRequestGeneration()).toBeGreaterThan(genBefore);
  });

  test("setLoading toggles", () => {
    expect(getSnapshot().isLoading).toBe(false);
    setLoading(true);
    expect(getSnapshot().isLoading).toBe(true);
    setLoading(false);
    expect(getSnapshot().isLoading).toBe(false);
  });

  test("store snapshot includes default scope", () => {
    expect(getSnapshot().scope).toEqual({ kind: "all" });
  });

  test("unsubscribe/resubscribe preserves state", () => {
    const captured: ReturnType<typeof getSnapshot>[] = [];
    const unsub = subscribe(() => {
      captured.push(getSnapshot());
    });
    addMessage(makeMessage("user", "test"));
    unsub();

    // State is preserved in the store after unsubscribe
    expect(getMessages()).toHaveLength(1);

    // Re-subscribe and verify state is visible
    const unsub2 = subscribe(() => {});
    expect(getMessages()).toHaveLength(1);
    unsub2();
  });

  test("clearChat resets scope to all", () => {
    setScope({ kind: "meeting", meetingId: "m1" });
    expect(getSnapshot().scope).toEqual({ kind: "meeting", meetingId: "m1" });
    clearChat();
    expect(getSnapshot().scope).toEqual({ kind: "all" });
  });

  test("failed request stores retry payload", () => {
    const payload = { query: "test query", scope: { kind: "all" } as AskSivloScope };
    setRetryRequest(payload);
    expect(getSnapshot().retryRequest).toEqual(payload);
  });

  test("retry payload cleared on success", () => {
    setRetryRequest({ query: "test", scope: { kind: "all" } });
    clearRetryRequest();
    expect(getSnapshot().retryRequest).toBeNull();
  });

  test("retry payload cleared on clearChat", () => {
    setRetryRequest({ query: "test", scope: { kind: "all" } });
    clearChat();
    expect(getSnapshot().retryRequest).toBeNull();
  });

  test("stale failure does not create retry payload", () => {
    const gen = getRequestGeneration();
    // Increment generation (simulates a new request starting)
    clearMessages();
    expect(getRequestGeneration()).toBeGreaterThan(gen);

    // Try to set retry at old generation — should not install
    setRetryRequest({ query: "stale", scope: { kind: "all" } }, gen);
    expect(getSnapshot().retryRequest).toBeNull();
  });

  test("clearChat increments generation", () => {
    const genBefore = getRequestGeneration();
    clearChat();
    expect(getRequestGeneration()).toBeGreaterThan(genBefore);
  });
});
