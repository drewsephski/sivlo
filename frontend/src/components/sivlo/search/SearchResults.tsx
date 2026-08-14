'use client';

import React from 'react';
import { FileSearch, Loader2, RefreshCw } from 'lucide-react';
import type { SearchResult } from '@/features/search';
import { SearchResultRow } from './SearchResultRow';

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function SearchResults({ query, results, isLoading, error, onRetry }: SearchResultsProps) {
  if (isLoading && results.length === 0) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
        role="status"
        aria-label="Searching"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Searching…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-surface-raised px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Search failed</p>
        <p className="mt-1 text-sm text-muted-foreground">Couldn&apos;t search your meetings.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!isLoading && results.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-surface-raised px-6 py-16 text-center">
        <FileSearch className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-foreground">No results for &ldquo;{query}&rdquo;</p>
        <p className="mt-1 text-sm text-muted-foreground">Try a different phrase or a shorter query.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-2" role="list" aria-label="Search results">
      {results.map((result, index) => (
        <SearchResultRow key={`${result.id}-${index}`} result={result} />
      ))}
    </div>
  );
}
