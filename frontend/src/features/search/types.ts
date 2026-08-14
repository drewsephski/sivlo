/**
 * Search domain types.
 *
 * SearchResult is the UI-facing shape produced from the backend
 * TranscriptSearchResult (which uses serde camelCase field names).
 */

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  timestamp: string;
}
