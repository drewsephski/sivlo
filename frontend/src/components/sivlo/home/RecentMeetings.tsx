'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { useNavigation } from '@/hooks/useNavigation';
import { useMeetings, groupMeetingsByDay, formatMeetingTime } from '@/features/meetings';
import type { MeetingRecord } from '@/features/meetings';
import { RefreshCw, CalendarDays, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { ConfirmationModal } from '@/components/ConfirmationModel/confirmation-modal';
import Analytics from '@/lib/analytics';

interface RecentMeetingsProps {
  limit?: number;
}

interface RecentMeetingRowProps {
  meeting: MeetingRecord;
  onRename: (meeting: MeetingRecord) => void;
  onDelete: (meeting: MeetingRecord) => void;
}

function RecentMeetingRow({ meeting, onRename, onDelete }: RecentMeetingRowProps) {
  const navigate = useNavigation(meeting.id, meeting.title);

  return (
    <div className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-surface-subtle">
      <button
        type="button"
        onClick={navigate}
        className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${meeting.title}`}
      >
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{meeting.title}</span>
        {meeting.createdAt && (
          <span className="shrink-0 text-xs text-muted-foreground">
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

export function RecentMeetings({ limit = 8 }: RecentMeetingsProps) {
  const { meetings, isLoading, error, refresh, renameMeeting, deleteMeeting } = useMeetings();

  const [renameTarget, setRenameTarget] = useState<MeetingRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MeetingRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const recent = meetings.slice(0, limit);
  const groups = groupMeetingsByDay(recent);

  const startRename = (meeting: MeetingRecord) => {
    setRenameTarget(meeting);
    setRenameValue(meeting.title);
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error('Meeting title cannot be empty');
      return;
    }

    setIsMutating(true);
    try {
      await renameMeeting(renameTarget.id, trimmed);
      Analytics.trackButtonClick('edit_meeting_title', 'home_page');
      toast.success('Meeting title updated successfully');
      setRenameTarget(null);
    } catch (err) {
      console.error('Failed to update meeting title:', err);
      toast.error('Failed to update meeting title', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsMutating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsMutating(true);
    try {
      await deleteMeeting(deleteTarget.id);
      Analytics.trackMeetingDeleted(deleteTarget.id);
      toast.success('Meeting deleted successfully', {
        description: 'All associated data has been removed',
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      toast.error('Failed to delete meeting', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsMutating(false);
    }
  };

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
          className="mt-2 inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
        <div className="divide-y divide-border">
          {groups.map(group => (
            <div key={group.label}>
              <div className="bg-surface-subtle px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
              <div className="divide-y divide-border">
                {group.meetings.map(meeting => (
                  <RecentMeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    onRename={startRename}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <VisuallyHidden>
            <DialogTitle>Rename meeting</DialogTitle>
          </VisuallyHidden>
          <div className="py-2">
            <h3 className="mb-1 text-lg font-semibold text-foreground">Rename meeting</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Give this meeting a more descriptive title.
            </p>
            <label htmlFor="home-meeting-title" className="mb-2 block text-sm font-medium text-foreground">
              Meeting title
            </label>
            <Input
              id="home-meeting-title"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmRename();
                if (e.key === 'Escape') setRenameTarget(null);
              }}
              placeholder="Enter meeting title"
              autoFocus
              disabled={isMutating}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmRename()}
              disabled={isMutating}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmationModal
        isOpen={deleteTarget !== null}
        text="Are you sure you want to delete this meeting? This action cannot be undone."
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
