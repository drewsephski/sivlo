'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Search } from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { sortMeetingsNewestFirst, useMeetings } from '@/features/meetings';
import { shouldRunSearch, useSearch } from '@/features/search';
import type { SearchResult } from '@/features/search';
import {
  PALETTE_COMMANDS,
  PALETTE_COMMAND_ICONS,
  type PaletteCommandId,
} from './commands';

const OPEN_SHORTCUT_KEY = 'k';
const MAX_PALETTE_RESULTS = 5;

export function CommandPalette() {
  const router = useRouter();
  const { setCurrentMeeting, handleRecordingToggle } = useSidebar();
  const { openImportDialog } = useImportDialog();
  const { meetings } = useMeetings();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, isLoading, error } = useSearch(query);

  const recentMeetings = useMemo(() => sortMeetingsNewestFirst(meetings).slice(0, 5), [meetings]);

  // Global ⌘K toggle, registered once. Toggling keeps it idempotent (no double-open).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === OPEN_SHORTCUT_KEY
      ) {
        event.preventDefault();
        setOpen(previous => !previous);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) setQuery('');
  }, []);

  const runCommand = useCallback(
    (id: PaletteCommandId) => {
      setOpen(false);
      switch (id) {
        case 'start-recording':
          handleRecordingToggle();
          break;
        case 'import-audio':
          openImportDialog();
          break;
        case 'home':
          router.push('/');
          break;
        case 'meetings':
          router.push('/meetings');
          break;
        case 'search':
          router.push('/search');
          break;
        case 'settings':
          router.push('/settings');
          break;
      }
    },
    [handleRecordingToggle, openImportDialog, router]
  );

  const openMeeting = useCallback(
    (meetingId: string, title: string) => {
      setCurrentMeeting({ id: meetingId, title });
      setOpen(false);
      router.push(`/meeting-details?id=${encodeURIComponent(meetingId)}`);
    },
    [router, setCurrentMeeting]
  );

  const openSearchPage = useCallback(() => {
    setOpen(false);
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }, [query, router]);

  const searching = shouldRunSearch(query);
  const noTranscriptMatches =
    searching && !isLoading && !error && results.length === 0;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <VisuallyHidden>
        <DialogTitle>Search and commands</DialogTitle>
        <DialogDescription>Search meetings and transcripts, or run a command.</DialogDescription>
      </VisuallyHidden>
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search meetings and transcripts, or run a command…"
        />
        <CommandList>
          {searching && (
            <CommandGroup heading="Transcripts">
              <CommandItem value="view-all-results" onSelect={openSearchPage}>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">
                  View all results for &ldquo;{query}&rdquo;
                </span>
              </CommandItem>

              {isLoading && (
                <CommandItem value="searching" disabled>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">Searching…</span>
                </CommandItem>
              )}

              {error && (
                <CommandItem value="search-failed" disabled>
                  <span className="text-muted-foreground">Search failed.</span>
                </CommandItem>
              )}

              {!isLoading &&
                !error &&
                results.slice(0, MAX_PALETTE_RESULTS).map((result, index) => (
                  <CommandItem
                    key={`${result.id}-${index}`}
                    value={`${result.title} ${result.snippet}`}
                    onSelect={() => {
                      const target = result as SearchResult;
                      openMeeting(target.id, target.title);
                    }}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{result.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{result.snippet}</span>
                  </CommandItem>
                ))}

              {noTranscriptMatches && (
                <CommandItem value="no-results" disabled>
                  <span className="text-muted-foreground">
                    No transcript matches for &ldquo;{query}&rdquo;
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          )}

          {!searching && (
            <CommandGroup heading="Recent meetings">
              {recentMeetings.length === 0 ? (
                <CommandItem value="no-recent-meetings" disabled>
                  <span className="text-muted-foreground">No meetings yet</span>
                </CommandItem>
              ) : (
                recentMeetings.map(meeting => (
                  <CommandItem
                    key={meeting.id}
                    value={`${meeting.title} recent`}
                    onSelect={() => openMeeting(meeting.id, meeting.title)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{meeting.title}</span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}

          <CommandGroup heading="Commands">
            {PALETTE_COMMANDS.map(command => {
              const Icon = PALETTE_COMMAND_ICONS[command.id];
              return (
                <CommandItem
                  key={command.id}
                  value={`${command.label} ${command.keywords.join(' ')}`}
                  onSelect={() => runCommand(command.id)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {command.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
