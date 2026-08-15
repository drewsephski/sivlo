/**
 * Meeting notes domain types.
 *
 * MeetingNotes mirrors the backend `MeetingNotesResponse` (snake_case wire
 * format). `notes_json` is the full-fidelity BlockNote document and is the
 * source of truth for the editor; `notes_markdown` is a portable export that
 * is saved alongside it.
 */

import type { MeetingNotes } from '@/types';

export type { MeetingNotes };

export type NotesSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
