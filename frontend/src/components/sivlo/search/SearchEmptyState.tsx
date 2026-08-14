'use client';

import React from 'react';
import { FileText, Search } from 'lucide-react';
import { useNavigation } from '@/hooks/useNavigation';
import { useMeetings } from '@/features/meetings';
import type { MeetingRecord } from '@/features/meetings';

function RecentMeetingRow({ meeting }: { meeting: MeetingRecord }) {
  const navigate = useNavigation(meeting.id, meeting.title);

  return (
    <button
      type="button"
      onClick={navigate}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate text-sm text-foreground">{meeting.title}</span>
    </button>
  );
}

export function SearchEmptyState() {
  const { meetings } = useMeetings();
  const recent = meetings.slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-border bg-surface-raised px-6 py-12 text-center">
        <Search className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-foreground">Search your meeting memory</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Find a conversation by title or something that was said. Searches run locally on this
          device.
        </p>
      </div>

      {recent.length > 0 && (
        <div className="mt-6">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent meetings
          </h2>
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
            {recent.map(meeting => (
              <RecentMeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
