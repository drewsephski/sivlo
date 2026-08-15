'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FolderOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmationModal } from '@/components/ConfirmationModel/confirmation-modal';
import { storageService } from '@/services/storageService';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { formatMeetingDate, formatMeetingTime } from '@/features/meetings';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';

interface MeetingHeaderProps {
  meetingId: string;
  title: string;
  createdAt: string;
  onRename: (title: string) => void | Promise<void>;
  onCopyTranscript: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
}

/**
 * Workspace header for a meeting: editable title, created date/time metadata,
 * and an overflow menu (copy transcript / open recording folder / delete).
 */
export function MeetingHeader({
  meetingId,
  title,
  createdAt,
  onRename,
  onCopyTranscript,
  onOpenFolder,
}: MeetingHeaderProps) {
  const router = useRouter();
  const { setMeetings, setCurrentMeeting, currentMeeting, meetings } = useSidebar();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };

  const commitEdit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === title) return;
    await onRename(next);
  };

  const cancelEdit = () => {
    setDraft(title);
    setEditing(false);
  };

  const handleDelete = async () => {
    try {
      await storageService.deleteMeeting(meetingId);
      // Reflect deletion in the sidebar list without a full refetch
      setMeetings(meetings.filter((m) => m.id !== meetingId));
      Analytics.trackMeetingDeleted(meetingId);
      toast.success('Meeting deleted successfully', {
        description: 'All associated data has been removed',
      });
      if (currentMeeting?.id === meetingId) {
        setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
      }
      router.push('/');
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error('Failed to delete meeting', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="w-full max-w-md rounded-md border border-input bg-surface px-2 py-1 text-lg font-semibold text-foreground outline-none ring-ring focus:ring-2"
            aria-label="Meeting title"
          />
        ) : (
          <button
            onClick={startEdit}
            className="group flex max-w-full items-center gap-2 text-left"
            title="Edit meeting title"
          >
            <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {createdAt ? `Created ${formatMeetingDate(createdAt)} at ${formatMeetingTime(createdAt)}` : 'Meeting'}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" title="Meeting actions" aria-label="Meeting actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void onCopyTranscript()}>
            <Copy className="h-4 w-4" />
            Copy transcript
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void onOpenFolder()}>
            <FolderOpen className="h-4 w-4" />
            Open recording folder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setShowDeleteConfirm(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete meeting
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDelete()}
        text={`Delete "${title}"? This permanently removes the meeting, its recording, transcript, summary, and notes.`}
      />
    </header>
  );
}
