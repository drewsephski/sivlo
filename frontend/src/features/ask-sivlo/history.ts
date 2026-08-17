import type { AskSivloMessage, AskSivloHistoryMessage } from "./types";

const CITATION_RE = /\[[Ss]\d+\]/g;
const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_MAX_CHARS = 4000;
const MIN_QUERY_CHARS = 3;
const MAX_QUERY_CHARS = 4000;

export function stripCitationMarkers(content: string): string {
  return content.replace(CITATION_RE, "");
}

export function buildAskSivloHistory(
  messages: AskSivloMessage[],
  maxMessages: number = DEFAULT_MAX_MESSAGES,
  maxChars: number = DEFAULT_MAX_CHARS,
): AskSivloHistoryMessage[] {
  // Strip citations and filter empty content
  const cleaned: AskSivloHistoryMessage[] = [];
  for (const msg of messages) {
    const stripped = stripCitationMarkers(msg.content).trim();
    if (stripped.length > 0) {
      cleaned.push({ role: msg.role, content: stripped });
    }
  }

  // Take newest messages within message limit
  const recent = cleaned.slice(-maxMessages);

  // Enforce character budget, keeping newest first
  let totalChars = 0;
  const result: AskSivloHistoryMessage[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const msgChars = Array.from(recent[i].content).length;
    if (totalChars + msgChars > maxChars) break;
    totalChars += msgChars;
    result.push(recent[i]);
  }

  result.reverse();
  return result;
}

export function validateQuery(
  query: string,
): { valid: boolean; error?: string } {
  const charCount = Array.from(query.trim()).length;
  if (charCount < MIN_QUERY_CHARS) {
    return { valid: false, error: "Query must be at least 3 characters" };
  }
  if (charCount > MAX_QUERY_CHARS) {
    return { valid: false, error: "Query must be at most 4000 characters" };
  }
  return { valid: true };
}
