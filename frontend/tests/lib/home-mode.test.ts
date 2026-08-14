import { describe, expect, test } from "bun:test";
import { RecordingStatus } from "../../src/contexts/RecordingStateContext";
import { homeViewMode } from "../../src/components/sivlo/home/home-mode";

describe("homeViewMode", () => {
  test("idle maps to workspace", () => {
    expect(homeViewMode(RecordingStatus.IDLE, false)).toBe("workspace");
  });

  test("completed maps to workspace", () => {
    expect(homeViewMode(RecordingStatus.COMPLETED, false)).toBe("workspace");
  });

  test("error maps to workspace", () => {
    expect(homeViewMode(RecordingStatus.ERROR, false)).toBe("workspace");
  });

  test("active lifecycle statuses map to recording", () => {
    expect(homeViewMode(RecordingStatus.STARTING, false)).toBe("recording");
    expect(homeViewMode(RecordingStatus.RECORDING, false)).toBe("recording");
    expect(homeViewMode(RecordingStatus.STOPPING, false)).toBe("recording");
    expect(homeViewMode(RecordingStatus.PROCESSING_TRANSCRIPTS, false)).toBe("recording");
    expect(homeViewMode(RecordingStatus.SAVING, false)).toBe("recording");
  });

  test("isRecording overrides status to recording", () => {
    expect(homeViewMode(RecordingStatus.IDLE, true)).toBe("recording");
    expect(homeViewMode(RecordingStatus.ERROR, true)).toBe("recording");
  });
});
