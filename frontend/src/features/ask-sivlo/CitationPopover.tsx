"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigation } from "@/hooks/useNavigation";
import type { AskSivloCitation } from "./types";

const SOURCE_TYPE_LABELS: Record<AskSivloCitation["sourceType"], string> = {
  transcript: "Transcript",
  summary: "Summary",
  note: "Note",
  action_item: "Action Item",
  decision: "Decision",
};

const SOURCE_TYPE_COLORS: Record<AskSivloCitation["sourceType"], string> = {
  transcript: "bg-blue-100 text-blue-700",
  summary: "bg-green-100 text-green-700",
  note: "bg-yellow-100 text-yellow-700",
  action_item: "bg-orange-100 text-orange-700",
  decision: "bg-purple-100 text-purple-700",
};

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface CitationPopoverProps {
  citation: AskSivloCitation;
}

export function CitationPopover({ citation }: CitationPopoverProps) {
  const navigateToMeeting = useNavigation(
    citation.meetingId,
    citation.meetingTitle,
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer align-baseline"
          aria-label={`Citation ${citation.sourceId}`}
        >
          [{citation.sourceId}]
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="top" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_TYPE_COLORS[citation.sourceType]}`}
            >
              {SOURCE_TYPE_LABELS[citation.sourceType]}
            </span>
            <span className="text-xs text-muted-foreground">
              {citation.sourceId}
            </span>
          </div>

          <button
            type="button"
            className="text-left text-sm font-medium hover:underline cursor-pointer text-foreground"
            onClick={navigateToMeeting}
          >
            {citation.meetingTitle}
          </button>

          {citation.meetingDate && (
            <p className="text-xs text-muted-foreground">
              {citation.meetingDate}
            </p>
          )}

          {citation.excerpt && (
            <p className="text-xs text-muted-foreground italic line-clamp-3">
              &ldquo;{citation.excerpt}&rdquo;
            </p>
          )}

          {citation.timestampStart !== undefined && (
            <p className="text-xs text-muted-foreground">
              {formatTimestamp(citation.timestampStart)}
              {citation.timestampEnd !== undefined &&
                ` – ${formatTimestamp(citation.timestampEnd)}`}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
