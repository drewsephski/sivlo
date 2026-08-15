'use client';

import { MeetingNotesEditorSurface } from '@/components/sivlo/notes/MeetingNotesEditorSurface';

interface NotesViewProps {
  meetingId: string;
}

/**
 * Notes pane of the Meeting Intelligence workspace. Embeds the same editor
 * surface as the standalone /notes route.
 */
export function NotesView({ meetingId }: NotesViewProps) {
  return (
    <MeetingNotesEditorSurface
      meetingId={meetingId}
      header={
        <div className="px-4 pb-3 pt-4">
          <h2 className="text-sm font-medium text-foreground">Notes</h2>
          <p className="text-xs text-muted-foreground">
            Notes are saved locally and stay with this meeting.
          </p>
        </div>
      }
    />
  );
}
