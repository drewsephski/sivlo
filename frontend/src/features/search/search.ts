/**
 * Search domain logic.
 *
 * Pure, testable helpers for deciding when to run a search, normalizing
 * backend results into the UI shape, and guarding against stale responses.
 * The only I/O boundary is `searchTranscripts`, which delegates to the
 * storage service (api_search_transcripts).
 */

import { storageService } from '@/services/storageService';
import type { TranscriptSearchResult } from '@/types';
import type { SearchResult } from './types';

export const MIN_SEARCH_QUERY_LENGTH = 2;

export const SEARCH_DEBOUNCE_MS = 200;

export function shouldRunSearch(query: string, minLength: number = MIN_SEARCH_QUERY_LENGTH): boolean {
  return query.trim().length >= minLength;
}

export function normalizeSearchResults(results: TranscriptSearchResult[]): SearchResult[] {
  return results.map(result => ({
    id: result.id,
    title: result.title,
    snippet: result.matchContext,
    timestamp: result.timestamp,
  }));
}

export async function searchTranscripts(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!shouldRunSearch(trimmed)) return [];
  const results = await storageService.searchTranscripts(trimmed);
  return normalizeSearchResults(results);
}

/**
 * Monotonic sequence guard so responses from an older query can never
 * overwrite results for a newer query.
 */
export class SearchRequestTracker {
  private latestId = 0;

  next(): number {
    this.latestId += 1;
    return this.latestId;
  }

  isLatest(id: number): boolean {
    return id === this.latestId;
  }

  reset(): void {
    this.latestId = 0;
  }
}
