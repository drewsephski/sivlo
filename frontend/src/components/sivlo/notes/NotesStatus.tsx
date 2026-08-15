'use client';

import { Check, CircleAlert, LoaderIcon } from 'lucide-react';
import type { NotesSaveStatus } from '@/features/notes';

interface NotesStatusProps {
  isDirty: boolean;
  saveStatus: NotesSaveStatus;
}

/**
 * Save-state indicator for the notes workspace: Saving… / Save failed /
 * Unsaved changes / Saved.
 */
export function NotesStatus({ isDirty, saveStatus }: NotesStatusProps) {
  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <LoaderIcon className="h-4 w-4 animate-spin" />
        Saving…
      </span>
    );
  }

  if (saveStatus === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-destructive">
        <CircleAlert className="h-4 w-4" />
        Save failed
      </span>
    );
  }

  if (isDirty) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-warning" />
        Unsaved changes
      </span>
    );
  }

  if (saveStatus === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Check className="h-4 w-4" />
        Saved
      </span>
    );
  }

  return null;
}
