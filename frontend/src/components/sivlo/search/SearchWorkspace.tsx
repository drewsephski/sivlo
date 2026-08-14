'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/features/search';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { SearchEmptyState } from './SearchEmptyState';

interface SearchWorkspaceProps {
  initialQuery?: string;
}

export function SearchWorkspace({ initialQuery = '' }: SearchWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const { results, isLoading, error, retry } = useSearch(query);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      const trimmed = value.trim();
      const next = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search';
      const current = window.location.pathname + window.location.search;
      if (next !== current) router.replace(next, { scroll: false });
    },
    [router]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Search</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Search meeting titles and transcripts across all recordings.
        </p>
        <div className="mt-4 max-w-2xl">
          <SearchInput value={query} onChange={handleQueryChange} autoFocus />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {query.trim() === '' ? (
          <SearchEmptyState />
        ) : (
          <SearchResults
            query={query}
            results={results}
            isLoading={isLoading}
            error={error}
            onRetry={retry}
          />
        )}
      </div>
    </div>
  );
}
