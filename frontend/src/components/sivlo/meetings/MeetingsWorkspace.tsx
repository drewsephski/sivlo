'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { ConfirmationModal } from '@/components/ConfirmationModel/confirmation-modal';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import { useMeetings, groupMeetingsByDay } from '@/features/meetings';
import type { MeetingRecord } from '@/features/meetings';
import { MeetingGroup } from './MeetingGroup';
import { MeetingsEmptyState } from './MeetingsEmptyState';
import { Upload, RefreshCw } from 'lucide-react';

export function MeetingsWorkspace() {
  const router = useRouter();
  const { setCurrentMeeting } = useSidebar();
  const { openImportDialog } = useImportDialog();
  const { meetings, isLoading, error, refresh, renameMeeting, deleteMeeting } = useMeetings();

  const [renameTarget, setRenameTarget] = useState<MeetingRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MeetingRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const groups = groupMeetingsByDay(meetings);

  const openMeeting = (meeting: MeetingRecord) => {
    setCurrentMeeting({ id: meeting.id, title: meeting.title });
    router.push(`/meeting-details?id=${meeting.id}`);
  };

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
      Analytics.trackButtonClick('edit_meeting_title', 'meetings_page');
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-8 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Meetings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your meeting history, kept on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openImportDialog()}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-raised px-4 text-sm font-semibold text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Upload className="h-4 w-4" />
          Import audio
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading && meetings.length === 0 ? (
          <div className="space-y-6" role="status" aria-label="Loading meetings">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-subtle" />
                <div className="space-y-2 rounded-xl border border-border bg-surface-raised p-2">
                  {Array.from({ length: 3 }).map((_, row) => (
                    <div key={row} className="h-12 animate-pulse rounded-lg bg-surface-subtle" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-surface-raised px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load meetings.</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : meetings.length === 0 ? (
          <MeetingsEmptyState
            onStartRecording={() => {
              setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
              router.push('/');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
              }, 150);
            }}
            onImport={openImportDialog}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-8">
            {groups.map(group => (
              <MeetingGroup
                key={group.label}
                label={group.label}
                meetings={group.meetings}
                onOpen={openMeeting}
                onRename={startRename}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
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
            <label htmlFor="meeting-title" className="mb-2 block text-sm font-medium text-foreground">
              Meeting title
            </label>
            <Input
              id="meeting-title"
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
    </div>
  );
}
