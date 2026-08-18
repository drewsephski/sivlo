import type { AskSivloCitation } from "./types";

export type CitationSegment =
  | { type: "text"; text: string }
  | { type: "citation"; citationId: string };

const CITATION_MARKER_RE = /\[[Ss](\d+)\]/g;

export function parseCitationMarkers(content: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CITATION_MARKER_RE)) {
    const matchStart = match.index!;
    if (matchStart > lastIndex) {
      segments.push({ type: "text", text: content.slice(lastIndex, matchStart) });
    }
    segments.push({ type: "citation", citationId: `S${match[1]}` });
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", text: content.slice(lastIndex) });
  }

  return segments;
}

export function resolveCitation(
  citationId: string,
  citations: AskSivloCitation[],
): AskSivloCitation | undefined {
  return citations.find((c) => c.sourceId === citationId);
}
