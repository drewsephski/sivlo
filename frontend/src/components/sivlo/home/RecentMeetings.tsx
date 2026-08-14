'use client';

import React from 'react';
import { useNavigation } from '@/hooks/useNavigation';
import { useMeetings, groupMeetingsByDay, formatMeetingTime } from '@/features/meetings';
import type { MeetingRecord } from '@/features/meetings';
import { RefreshCw, CalendarDays } from 'lucide-react';

interface RecentMeetingsProps {
  limit?: number;
}

function RecentMeetingRow({ meeting }: { meeting: MeetingRecord }) {
  const navigate = useNavigation(meeting.id, meeting.title);

  return (
    <button
      type="button"
      onClick={navigate}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{meeting.title}</span>
      {meeting.createdAt && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatMeetingTime(meeting.createdAt)}
        </span>
      )}
    </button>
  );
}

export function RecentMeetings({ limit = 8 }: RecentMeetingsProps) {
  const { meetings, isLoading, error, refresh } = useMeetings();

  const recent = meetings.slice(0, limit);
  const groups = groupMeetingsByDay(recent);

  if (isLoading && meetings.length === 0) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading meetings">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-lg bg-surface-subtle"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load meetings.</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center">
        <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No meetings yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a recording or import audio to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="divide-y divide-border">
        {groups.map(group => (
          <div key={group.label}>
            <div className="bg-surface-subtle px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </div>
            <div className="divide-y divide-border">
              {group.meetings.map(meeting => (
                <RecentMeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
