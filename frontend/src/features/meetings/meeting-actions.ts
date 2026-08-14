/**
 * Meeting data actions.
 *
 * Thin orchestration over the storage service. The meeting list endpoint only
 * returns id + title, so we enrich each meeting with lightweight metadata
 * (timestamps, folder path) in parallel. We intentionally do NOT fetch full
 * transcripts per meeting.
 */

import { storageService } from '@/services/storageService';
import type { MeetingRecord } from './types';

export async function fetchMeetingRecords(): Promise<MeetingRecord[]> {
  const meetings = await storageService.getMeetings();

  const enriched = await Promise.all(
    meetings.map(async meeting => {
      try {
        const meta = await storageService.getMeetingMetadata(meeting.id);
        return {
          id: meta.id,
          title: meta.title || meeting.title || 'Untitled meeting',
          createdAt: meta.created_at ?? null,
          updatedAt: meta.updated_at ?? null,
          folderPath: meta.folder_path ?? null,
        } satisfies MeetingRecord;
      } catch (error) {
        console.warn(`Failed to load metadata for meeting ${meeting.id}:`, error);
        return {
          id: meeting.id,
          title: meeting.title || 'Untitled meeting',
          createdAt: null,
          updatedAt: null,
          folderPath: null,
        } satisfies MeetingRecord;
      }
    })
  );

  return enriched;
}

export async function renameMeeting(meetingId: string, title: string): Promise<void> {
  await storageService.renameMeeting(meetingId, title);
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  await storageService.deleteMeeting(meetingId);
}
