'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { AskSivloScope } from './types';
import {
  subscribe,
  getSnapshot,
  clearChat,
  setScope,
  getMessages,
} from './askSivloStore';
import { sendAskSivloMessage, retryAskSivlo } from './actions';

function useAskSivloSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Thin React hook for Ask Sivlo.
 *
 * Subscribes to the module-level store and delegates all orchestration
 * to the actions layer. No duplicate async/backend logic here.
 */
export function useAskSivlo() {
  const snapshot = useAskSivloSnapshot();

  const sendMessage = useCallback(
    async (query: string, scope?: AskSivloScope) => {
      const targetScope = scope ?? snapshot.scope;
      await sendAskSivloMessage(query, targetScope);
    },
    [snapshot.scope],
  );

  const retry = useCallback(async () => {
    await retryAskSivlo();
  }, []);

  const handleClearChat = useCallback(() => {
    clearChat();
  }, []);

  const handleSetScope = useCallback(
    (scope: AskSivloScope) => {
      setScope(scope);
    },
    [],
  );

  return {
    messages: snapshot.messages,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    scope: snapshot.scope,
    retryRequest: snapshot.retryRequest,
    sendMessage,
    retry,
    clearChat: handleClearChat,
    setScope: handleSetScope,
  };
}
