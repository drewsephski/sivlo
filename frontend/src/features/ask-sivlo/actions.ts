import type {
  AskSivloMessage,
  AskSivloRequest,
  AskSivloResponse,
  AskSivloScope,
} from "./types";
import { buildAskSivloHistory, validateQuery } from "./history";
import {
  addMessage,
  clearRetryRequest,
  getMessages,
  getRequestGeneration,
  getSnapshot,
  setRetryRequest,
  setLoading,
  setError,
} from "./askSivloStore";

export type AskSivloBackendCall = (
  request: AskSivloRequest,
) => Promise<AskSivloResponse>;

async function invokeAskSivlo(
  request: AskSivloRequest,
): Promise<AskSivloResponse> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AskSivloResponse>("api_ask_sivlo", {
    query: request.query,
    history: request.history,
    scope: request.scope,
  });
}

function toUserFriendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (lower.includes("model") || lower.includes("not configured") || lower.includes("missing")) {
    return "No AI model configured. Please configure an AI provider in Settings.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Request timed out. Please try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  return msg || "An unexpected error occurred.";
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeUserMessage(query: string): AskSivloMessage {
  return {
    id: makeId(),
    role: "user",
    content: query,
    timestamp: Date.now(),
  };
}

function makeAssistantMessage(
  response: AskSivloResponse,
): AskSivloMessage {
  return {
    id: makeId(),
    role: "assistant",
    content: response.answer,
    citations: response.citations,
    route: response.route,
    timestamp: Date.now(),
  };
}

/**
 * Send a user query to the Ask Sivlo backend.
 *
 * Orchestration:
 * 1. Validate query
 * 2. Capture prior messages (before appending user message)
 * 3. Build bounded history from priors
 * 4. Advance request generation for stale-response protection
 * 5. Append user message to store
 * 6. Clear stale error/retry state
 * 7. Set loading
 * 8. Call backend
 * 9. Check generation is still current before applying result
 *
 * @param query - The user's question
 * @param scope - Meeting or all-scope context
 * @param backendCall - Injectable backend call (defaults to Tauri invoke)
 */
export async function sendAskSivloMessage(
  query: string,
  scope: AskSivloScope,
  backendCall: AskSivloBackendCall = invokeAskSivlo,
): Promise<void> {
  const validation = validateQuery(query);
  if (!validation.valid) {
    setError(validation.error!);
    return;
  }

  // Capture prior messages BEFORE adding the current user message.
  // History must not include the current query.
  const priorMessages = getMessages();
  const history = buildAskSivloHistory(priorMessages);

  // Capture generation before the user message is appended.
  // If generation changes during the backend call, the response is stale.
  const generationBefore = getRequestGeneration();

  // Append user message to the store
  addMessage(makeUserMessage(query));

  // Clear error so any previous error is not shown during this request.
  // Do NOT clear retryRequest here — a prior failed query's retry state
  // must survive until the user retries or the conversation moves on.
  setError(null);
  setLoading(true);

  try {
    const response = await backendCall({ query, history, scope });

    // Generation guard: ignore if a newer request started or chat was cleared
    if (getRequestGeneration() !== generationBefore) return;

    addMessage(makeAssistantMessage(response));
    clearRetryRequest();
    setLoading(false);
  } catch (error) {
    // Generation guard: do not install retry from stale failure
    if (getRequestGeneration() !== generationBefore) return;

    setError(toUserFriendlyError(error));
    setLoading(false);
    // Overwrite any prior retryRequest with the latest failure
    setRetryRequest({ query, scope }, generationBefore);
  }
}

/**
 * Retry the last failed request.
 *
 * Reads the current conversation state from the store and re-sends
 * the failed query. History is rebuilt at retry time, not captured
 * from the original failed request.
 */
export async function retryAskSivlo(
  backendCall: AskSivloBackendCall = invokeAskSivlo,
): Promise<void> {
  const retry = getSnapshot().retryRequest;
  if (!retry) return;

  setError(null);

  const messages = getMessages();
  const history = buildAskSivloHistory(messages);

  setLoading(true);

  try {
    const response = await backendCall({
      query: retry.query,
      history,
      scope: retry.scope,
    });

    addMessage(makeAssistantMessage(response));
    clearRetryRequest();
    setLoading(false);
  } catch (error) {
    setError(toUserFriendlyError(error));
    setLoading(false);
  }
}
