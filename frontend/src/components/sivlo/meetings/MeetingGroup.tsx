'use client';

import React from 'react';
import type { MeetingGroup as MeetingGroupType, MeetingRecord } from '@/features/meetings';
import { MeetingRow } from './MeetingRow';

interface MeetingGroupProps {
  label: string;
  meetings: MeetingRecord[];
  onOpen: (meeting: MeetingRecord) => void;
  onRename: (meeting: MeetingRecord) => void;
  onDelete: (meeting: MeetingRecord) => void;
}

export function MeetingGroup({ label, meetings, onOpen, onRename, onDelete }: MeetingGroupProps) {
  return (
    <section aria-label={label}>
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
        {meetings.map(meeting => (
          <MeetingRow
            key={meeting.id}
            meeting={meeting}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

export type { MeetingGroupType };
