'use client';

/**
 * Shared meetings store.
 *
 * A tiny module-level store (no new dependencies) so the Home and Meetings
 * workspaces share one cache and stay in sync after mutations. Each consumer
 * subscribes via useSyncExternalStore; the cache is refreshed when a consumer
 * mounts and has not loaded yet, and explicitly after rename/delete.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { MeetingRecord } from './types';
import {
  deleteMeeting as deleteMeetingAction,
  fetchMeetingRecords,
  renameMeeting as renameMeetingAction,
} from './meeting-actions';

interface MeetingsSnapshot {
  meetings: MeetingRecord[];
  isLoading: boolean;
  error: string | null;
}

let cache: MeetingsSnapshot = { meetings: [], isLoading: false, error: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MeetingsSnapshot {
  return cache;
}

function getServerSnapshot(): MeetingsSnapshot {
  return cache;
}

export async function refreshMeetings(): Promise<void> {
  if (inflight) return inflight;

  if (cache.meetings.length === 0) {
    cache = { ...cache, isLoading: true };
    emit();
  }

  inflight = (async () => {
    try {
      const meetings = await fetchMeetingRecords();
      cache = { meetings, isLoading: false, error: null };
    } catch (error) {
      console.error('Failed to load meetings:', error);
      cache = {
        ...cache,
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      inflight = null;
      emit();
    }
  })();

  return inflight;
}

export function useMeetings() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    void refreshMeetings();
  }, []);

  const rename = useCallback(async (meetingId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Meeting title cannot be empty');

    await renameMeetingAction(meetingId, trimmed);
    cache = {
      ...cache,
      meetings: cache.meetings.map(meeting =>
        meeting.id === meetingId ? { ...meeting, title: trimmed } : meeting
      ),
    };
    emit();
  }, []);

  const remove = useCallback(async (meetingId: string) => {
    await deleteMeetingAction(meetingId);
    cache = {
      ...cache,
      meetings: cache.meetings.filter(meeting => meeting.id !== meetingId),
    };
    emit();
  }, []);

  const refresh = useCallback(() => refreshMeetings(), []);

  return { ...snapshot, refresh, renameMeeting: rename, deleteMeeting: remove };
}
