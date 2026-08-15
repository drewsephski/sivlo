/**
 * Meeting notes data actions.
 *
 * Thin orchestration over the storage service, following the
 * features/meetings pattern. Notes are fully independent of meeting
 * summaries.
 */

import type { Block } from '@blocknote/core';
import { storageService } from '@/services/storageService';
import type { BlockNoteBlock } from '@/types';
import type { MeetingNotes } from './types';

export async function fetchMeetingNotes(meetingId: string): Promise<MeetingNotes | null> {
  return storageService.getMeetingNotes(meetingId);
}

export async function saveMeetingNotes(
  meetingId: string,
  notesMarkdown: string,
  notesJson: BlockNoteBlock[],
): Promise<MeetingNotes> {
  return storageService.saveMeetingNotes(meetingId, notesMarkdown, notesJson);
}

/**
 * Convert the persisted notes JSON into editor blocks.
 *
 * `notes_json` is the full-fidelity BlockNote document. When notes have never
 * been saved the backend returns null and the editor starts empty; an invalid
 * payload degrades to an empty document instead of crashing.
 */
export function notesToBlocks(notesJson: MeetingNotes['notes_json'] | null | undefined): Block[] {
  return Array.isArray(notesJson) ? (notesJson as unknown as Block[]) : [];
}
