import type { AskSivloMessage, AskSivloScope } from "./types";

export interface AskSivloSnapshot {
  messages: AskSivloMessage[];
  isLoading: boolean;
  error: string | null;
  scope: AskSivloScope;
  retryRequest: { query: string; scope: AskSivloScope } | null;
}

let snapshot: AskSivloSnapshot = {
  messages: [],
  isLoading: false,
  error: null,
  scope: { kind: "all" },
  retryRequest: null,
};

let requestGeneration = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AskSivloSnapshot {
  return snapshot;
}

export function getMessages(): AskSivloMessage[] {
  return snapshot.messages;
}

export function getRequestGeneration(): number {
  return requestGeneration;
}

export function addMessage(message: AskSivloMessage): void {
  snapshot = { ...snapshot, messages: [...snapshot.messages, message] };
  emit();
}

export function clearMessages(): void {
  requestGeneration++;
  snapshot = { ...snapshot, messages: [] };
  emit();
}

export function setLoading(loading: boolean): void {
  if (snapshot.isLoading === loading) return;
  snapshot = { ...snapshot, isLoading: loading };
  emit();
}

export function setError(error: string | null): void {
  if (snapshot.error === error) return;
  snapshot = { ...snapshot, error };
  emit();
}

export function setScope(scope: AskSivloScope): void {
  if (snapshot.scope.kind === scope.kind && snapshot.scope.meetingId === scope.meetingId) return;
  snapshot = { ...snapshot, scope };
  emit();
}

export function setRetryRequest(
  payload: { query: string; scope: AskSivloScope },
  expectedGeneration?: number,
): void {
  if (expectedGeneration !== undefined && expectedGeneration !== requestGeneration) {
    return; // stale generation — do not install
  }
  snapshot = { ...snapshot, retryRequest: payload };
  emit();
}

export function clearRetryRequest(): void {
  if (snapshot.retryRequest === null) return;
  snapshot = { ...snapshot, retryRequest: null };
  emit();
}

export function clearChat(): void {
  requestGeneration++;
  snapshot = {
    messages: [],
    isLoading: false,
    error: null,
    scope: { kind: "all" },
    retryRequest: null,
  };
  emit();
}
