/**
 * Meeting domain types.
 *
 * MeetingRecord is the enriched shape consumed by the Home and Meetings
 * workspaces. Timestamps come from `api_get_meeting_metadata` (RFC3339
 * strings); the list endpoint (`api_get_meetings`) only exposes id + title,
 * so we enrich lightweight metadata per meeting rather than loading full
 * transcripts.
 */

export interface MeetingRecord {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  folderPath: string | null;
}

export type MeetingGroupLabel = 'Today' | 'Yesterday' | 'Earlier';

export interface MeetingGroup {
  label: MeetingGroupLabel;
  meetings: MeetingRecord[];
}
