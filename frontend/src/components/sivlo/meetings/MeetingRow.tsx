'use client';

import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatMeetingTime } from '@/features/meetings';
import type { MeetingRecord } from '@/features/meetings';

interface MeetingRowProps {
  meeting: MeetingRecord;
  onOpen: (meeting: MeetingRecord) => void;
  onRename: (meeting: MeetingRecord) => void;
  onDelete: (meeting: MeetingRecord) => void;
}

export function MeetingRow({ meeting, onOpen, onRename, onDelete }: MeetingRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-subtle">
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${meeting.title}`}
      >
        <span className="block truncate text-sm text-foreground">{meeting.title}</span>
        {meeting.createdAt && (
          <span className="block text-xs text-muted-foreground">
            {formatMeetingTime(meeting.createdAt)}
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-raised data-[state=open]:text-foreground"
          aria-label={`Actions for ${meeting.title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => onOpen(meeting)}>
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRename(meeting)}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(meeting)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
