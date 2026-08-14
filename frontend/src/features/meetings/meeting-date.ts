/**
 * Pure date helpers for meeting history.
 *
 * All functions are deterministic and side-effect free so they can be unit
 * tested. Timestamps are RFC3339 strings from `api_get_meeting_metadata`;
 * missing or invalid values degrade gracefully (treated as unknown, grouped
 * under "Earlier" and sorted last).
 */

import type { MeetingGroup, MeetingGroupLabel, MeetingRecord } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseMeetingTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function getDayLabel(timestampMs: number | null, now: Date): MeetingGroupLabel {
  if (timestampMs === null) return 'Earlier';

  const timestamp = new Date(timestampMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tsDayStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()).getTime();
  const daysAgo = Math.round((todayStart - tsDayStart) / DAY_MS);

  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return 'Earlier';
}

export function sortMeetingsNewestFirst(meetings: MeetingRecord[]): MeetingRecord[] {
  return [...meetings].sort((a, b) => {
    const aTime = parseMeetingTimestamp(a.createdAt);
    const bTime = parseMeetingTimestamp(b.createdAt);

    if (aTime === null && bTime === null) return a.title.localeCompare(b.title);
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    if (aTime !== bTime) return bTime - aTime;
    return a.title.localeCompare(b.title);
  });
}

export function groupMeetingsByDay(meetings: MeetingRecord[], now: Date = new Date()): MeetingGroup[] {
  const sorted = sortMeetingsNewestFirst(meetings);

  const byLabel = new Map<MeetingGroupLabel, MeetingRecord[]>();
  for (const meeting of sorted) {
    const label = getDayLabel(parseMeetingTimestamp(meeting.createdAt), now);
    const bucket = byLabel.get(label);
    if (bucket) {
      bucket.push(meeting);
    } else {
      byLabel.set(label, [meeting]);
    }
  }

  const order: MeetingGroupLabel[] = ['Today', 'Yesterday', 'Earlier'];
  return order
    .filter(label => byLabel.has(label))
    .map(label => ({ label, meetings: byLabel.get(label)! }));
}

export function formatMeetingTime(value: string | null | undefined): string {
  const ms = parseMeetingTimestamp(value);
  if (ms === null) return '';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatMeetingDate(value: string | null | undefined): string {
  const ms = parseMeetingTimestamp(value);
  if (ms === null) return 'Unknown date';
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
