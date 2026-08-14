'use client';

/**
 * useSearch
 *
 * Shared search hook for the /search workspace and the command palette.
 * - Empty or too-short queries run nothing and clear results immediately.
 * - Valid queries are debounced (SEARCH_DEBOUNCE_MS) before hitting the backend.
 * - A sequence tracker discards stale responses (newest query wins).
 * - Prior results are kept while a newer query loads (no jarring spinner swaps).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchTranscripts, shouldRunSearch, SEARCH_DEBOUNCE_MS, SearchRequestTracker } from './search';
import type { SearchResult } from './types';

export interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
}

export function useSearch(query: string): SearchState & { retry: () => void } {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: false, error: null });
  const trackerRef = useRef(new SearchRequestTracker());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef(query);
  const mountedRef = useRef(true);

  queryRef.current = query;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const runSearch = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!shouldRunSearch(trimmed)) return;

    const sequence = trackerRef.current.next();
    setState(previous => ({ ...previous, isLoading: true, error: null }));

    try {
      const results = await searchTranscripts(trimmed);
      if (!mountedRef.current || !trackerRef.current.isLatest(sequence)) return;
      setState({ results, isLoading: false, error: null });
    } catch (err) {
      console.error('Transcript search failed:', err);
      if (!mountedRef.current || !trackerRef.current.isLatest(sequence)) return;
      setState({ results: [], isLoading: false, error: 'Search failed' });
    }
  }, []);

  useEffect(() => {
    if (!shouldRunSearch(query)) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      trackerRef.current.reset();
      setState(previous =>
        previous.results.length === 0 && !previous.isLoading && !previous.error
          ? previous
          : { results: [], isLoading: false, error: null }
      );
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [query, runSearch]);

  const retry = useCallback(() => {
    if (shouldRunSearch(queryRef.current)) {
      void runSearch(queryRef.current);
    }
  }, [runSearch]);

  return { ...state, retry };
}
