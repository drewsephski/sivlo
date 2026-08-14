'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText } from 'lucide-react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import type { SearchResult } from '@/features/search';

interface SearchResultRowProps {
  result: SearchResult;
}

export function SearchResultRow({ result }: SearchResultRowProps) {
  const router = useRouter();
  const { setCurrentMeeting } = useSidebar();

  const openMeeting = () => {
    setCurrentMeeting({ id: result.id, title: result.title });
    router.push(`/meeting-details?id=${encodeURIComponent(result.id)}`);
  };

  return (
    <button
      type="button"
      onClick={openMeeting}
      className="block w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-foreground">{result.title}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.snippet}</p>
      {result.timestamp && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {result.timestamp}
        </div>
      )}
    </button>
  );
}
