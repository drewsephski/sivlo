import type { AskSivloScope } from "./types";

export function createAllScope(): AskSivloScope {
  return { kind: "all" };
}

export function createMeetingScope(meetingId: string): AskSivloScope {
  return { kind: "meeting", meetingId };
}

export function isMeetingScope(scope: AskSivloScope): boolean {
  return scope.kind === "meeting";
}
