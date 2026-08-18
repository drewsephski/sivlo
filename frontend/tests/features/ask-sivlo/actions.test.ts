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
  setLoading,
  setError,
} from "../../../src/features/ask-sivlo/askSivloStore";
import type {
  AskSivloMessage,
  AskSivloRequest,
  AskSivloResponse,
  AskSivloScope,
} from "../../../src/features/ask-sivlo/types";
import type { AskSivloBackendCall } from "../../../src/features/ask-sivlo/actions";

// Lazily import after module exists
let sendAskSivloMessage: (
  query: string,
  scope: AskSivloScope,
  backendCall?: AskSivloBackendCall,
) => Promise<void>;

let retryAskSivlo: (backendCall?: AskSivloBackendCall) => Promise<void>;

// Load the actions module dynamically so tests fail clearly if missing
try {
  const actions = require("../../../src/features/ask-sivlo/actions");
  sendAskSivloMessage = actions.sendAskSivloMessage;
  retryAskSivlo = actions.retryAskSivlo;
} catch {
  // Module doesn't exist yet — tests will fail with import error
}

function makeMessage(
  role: "user" | "assistant",
  content: string,
  extra?: Partial<AskSivloMessage>,
): AskSivloMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...extra,
  };
}

function makeResponse(overrides?: Partial<AskSivloResponse>): AskSivloResponse {
  return {
    answer: "Test answer",
    route: "meeting",
    citations: [],
    ...overrides,
  };
}

describe("sendAskSivloMessage", () => {
  beforeEach(() => {
    clearChat();
  });

  test("invokes backend with correct request", async () => {
    let capturedRequest: AskSivloRequest | undefined;
    const backendCall: AskSivloBackendCall = async (request) => {
      capturedRequest = request;
      return makeResponse();
    };

    addMessage(makeMessage("user", "prior question"));
    addMessage(makeMessage("assistant", "prior answer"));

    await sendAskSivloMessage("new question", { kind: "all" }, backendCall);

    expect(capturedRequest).toBeDefined();
    expect(capturedRequest!.query).toBe("new question");
    expect(capturedRequest!.history).toHaveLength(2);
    expect(capturedRequest!.history[0].content).toBe("prior question");
    expect(capturedRequest!.history[1].content).toBe("prior answer");
    expect(capturedRequest!.scope).toEqual({ kind: "all" });
  });

  test("adds user and assistant messages on success", async () => {
    const backendCall: AskSivloBackendCall = async () =>
      makeResponse({
        answer: "Here is the answer",
        route: "meeting",
        citations: [
          {
            sourceId: "S1",
            meetingId: "m1",
            meetingTitle: "Standup",
            sourceType: "transcript",
            excerpt: "test excerpt",
          },
        ],
      });

    await sendAskSivloMessage("question", { kind: "all" }, backendCall);

    const messages = getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("question");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Here is the answer");
    expect(messages[1].citations).toHaveLength(1);
    expect(messages[1].citations![0].sourceId).toBe("S1");
    expect(messages[1].route).toBe("meeting");
  });

  test("sets loading true then false on success", async () => {
    const loadStates: boolean[] = [];
    const originalSetLoading = setLoading;

    // Track loading states through the store
    const backendCall: AskSivloBackendCall = async () => {
      loadStates.push(getSnapshot().isLoading);
      return makeResponse();
    };

    await sendAskSivloMessage("question", { kind: "all" }, backendCall);

    expect(loadStates[0]).toBe(true); // loading was true during backend call
    expect(getSnapshot().isLoading).toBe(false); // loading false after
  });

  test("sets error on failure", async () => {
    const backendCall: AskSivloBackendCall = async () => {
      throw new Error("Something went wrong");
    };

    await sendAskSivloMessage("question", { kind: "all" }, backendCall);

    expect(getSnapshot().error).toBe("Something went wrong");
    expect(getSnapshot().isLoading).toBe(false);
  });

  test("stores retryRequest on failure with query and scope", async () => {
    const scope: AskSivloScope = { kind: "meeting", meetingId: "m1" };
    const backendCall: AskSivloBackendCall = async () => {
      throw new Error("fail");
    };

    await sendAskSivloMessage("retry me", scope, backendCall);

    expect(getSnapshot().retryRequest).toEqual({
      query: "retry me",
      scope,
    });
  });

  test("clears error before sending and successful send clears previous retryRequest", async () => {
    // Set initial error state and a retry from a prior failure
    setError("old error");
    setRetryRequest({ query: "old failed query", scope: { kind: "all" } });

    const backendCall: AskSivloBackendCall = async () => makeResponse();

    await sendAskSivloMessage("new question", { kind: "all" }, backendCall);

    // Error should be cleared
    expect(getSnapshot().error).toBeNull();
    // Successful current request MUST clear the prior retryRequest
    expect(getSnapshot().retryRequest).toBeNull();
  });
});

describe("deferred stale response protection", () => {
  beforeEach(() => {
    clearChat();
  });

  test("old response is ignored when generation advances", async () => {
    let resolveBackend: (v: AskSivloResponse) => void;
    const backendCall: AskSivloBackendCall = async () =>
      new Promise((resolve) => {
        resolveBackend = resolve;
      });

    const sendPromise = sendAskSivloMessage(
      "first",
      { kind: "all" },
      backendCall,
    );

    // Advance generation by clearing the chat
    clearChat();

    // Now resolve the old backend call
    resolveBackend!(makeResponse({ answer: "stale response" }));

    await sendPromise;

    // Stale response must NOT add assistant message
    expect(getMessages()).toHaveLength(0);
  });

  test("old failure does not install retryRequest", async () => {
    let rejectBackend: (e: Error) => void;
    const backendCall: AskSivloBackendCall = async () =>
      new Promise((_, reject) => {
        rejectBackend = reject;
      });

    const sendPromise = sendAskSivloMessage(
      "first",
      { kind: "all" },
      backendCall,
    );

    // Advance generation
    clearChat();

    // Now reject the old call
    rejectBackend!(new Error("stale failure"));

    await sendPromise;

    // Must NOT install retryRequest from stale failure
    expect(getSnapshot().retryRequest).toBeNull();
  });

  test("stale success does not clear existing retryRequest", async () => {
    // Pre-set a retryRequest representing a prior failure
    setRetryRequest({ query: "prior failed query", scope: { kind: "all" } });

    let resolveBackend: (v: AskSivloResponse) => void;
    const backendCall: AskSivloBackendCall = async () =>
      new Promise((resolve) => {
        resolveBackend = resolve;
      });

    const sendPromise = sendAskSivloMessage(
      "new query",
      { kind: "all" },
      backendCall,
    );

    // Advance generation without clearing retryRequest — makes the response stale
    clearMessages();

    // Stale success resolves
    resolveBackend!(makeResponse({ answer: "stale success" }));
    await sendPromise;

    // Stale assistant response must NOT be added
    expect(getMessages()).toHaveLength(0);
    // Existing retryRequest must remain untouched
    expect(getSnapshot().retryRequest).toEqual({
      query: "prior failed query",
      scope: { kind: "all" },
    });
  });
});

describe("retryAskSivlo", () => {
  beforeEach(() => {
    clearChat();
  });

  test("invokes backend again with same query and scope", async () => {
    const scope: AskSivloScope = { kind: "meeting", meetingId: "m1" };
    const calls: AskSivloRequest[] = [];

    const backendCall: AskSivloBackendCall = async (request) => {
      calls.push({ ...request, history: [...request.history] });
      if (calls.length === 1) throw new Error("first attempt failed");
      return makeResponse({ answer: "retry succeeded" });
    };

    await sendAskSivloMessage("my question", scope, backendCall);
    expect(calls).toHaveLength(1);

    await retryAskSivlo(backendCall);
    expect(calls).toHaveLength(2);
    expect(calls[1].query).toBe("my question");
    expect(calls[1].scope).toEqual(scope);
  });

  test("success clears retryRequest", async () => {
    const backendCall: AskSivloBackendCall = async () => {
      throw new Error("fail");
    };

    await sendAskSivloMessage("the query", { kind: "all" }, backendCall);
    expect(getSnapshot().retryRequest).not.toBeNull();

    const successCall: AskSivloBackendCall = async () => makeResponse();
    await retryAskSivlo(successCall);

    expect(getSnapshot().retryRequest).toBeNull();
    expect(getSnapshot().error).toBeNull();
  });

  test("uses current messages for history, not stale state", async () => {
    const calls: AskSivloRequest[] = [];
    let callCount = 0;

    const backendCall: AskSivloBackendCall = async (req) => {
      calls.push({ ...req, history: [...req.history] });
      callCount++;
      // Both sends fail — retryRequest persists from the latest failure
      throw new Error("fail");
    };

    // First message fails
    await sendAskSivloMessage("first message", { kind: "all" }, backendCall);

    // Second message also fails — overwrites retryRequest with latest failure
    await sendAskSivloMessage("second message", { kind: "all" }, backendCall);

    // Retry the second failed query — history should include first + second messages
    await retryAskSivlo(backendCall);

    expect(calls).toHaveLength(3);
    // Third call (retry) history should include all current store messages:
    // user "first message" + user "second message"
    const retryCall = calls[2];
    expect(retryCall.history).toHaveLength(2);
    expect(retryCall.history[0].role).toBe("user");
    expect(retryCall.history[0].content).toBe("first message");
    expect(retryCall.history[1].role).toBe("user");
    expect(retryCall.history[1].content).toBe("second message");
    expect(retryCall.query).toBe("second message");
  });

  test("does not append duplicate user message", async () => {
    const backendCall: AskSivloBackendCall = async () => {
      throw new Error("fail");
    };

    await sendAskSivloMessage("unique query", { kind: "all" }, backendCall);

    // User message should already be in the store from the failed send
    const msgsBeforeRetry = getMessages();
    const userMsgsBefore = msgsBeforeRetry.filter((m) => m.role === "user");
    expect(userMsgsBefore).toHaveLength(1);

    const successCall: AskSivloBackendCall = async () => makeResponse();
    await retryAskSivlo(successCall);

    // Retry must not add another user message
    const msgsAfterRetry = getMessages();
    const userMsgsAfter = msgsAfterRetry.filter((m) => m.role === "user");
    expect(userMsgsAfter).toHaveLength(1);
  });

  test("does nothing when retryRequest is null", async () => {
    let callCount = 0;
    const backendCall: AskSivloBackendCall = async () => {
      callCount++;
      return makeResponse();
    };

    await retryAskSivlo(backendCall);
    expect(callCount).toBe(0);
  });
});

describe("stale failure retry guard", () => {
  beforeEach(() => {
    clearChat();
  });

  test("stale failure does not install retry payload", async () => {
    let rejectBackend: (e: Error) => void;
    const backendCall: AskSivloBackendCall = async () =>
      new Promise((_, reject) => {
        rejectBackend = reject;
      });

    const sendPromise = sendAskSivloMessage(
      "stale q",
      { kind: "all" },
      backendCall,
    );

    // Advance generation (simulates new request or clearChat)
    clearChat();

    // Old call fails
    rejectBackend!(new Error("stale"));
    await sendPromise;

    // Retry must NOT have been installed
    expect(getSnapshot().retryRequest).toBeNull();
  });
});
