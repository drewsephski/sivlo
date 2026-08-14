import { describe, expect, test } from "bun:test";
import { RecordingStatus } from "../../src/contexts/RecordingStateContext";
import {
  recordingWorkspaceState,
  formatElapsed,
  recordingStatusLabel,
} from "../../src/components/sivlo/recording/recording-view-state";

describe("recordingWorkspaceState", () => {
  test("active backend session always maps to recording", () => {
    expect(recordingWorkspaceState(RecordingStatus.IDLE, true)).toBe("recording");
    expect(recordingWorkspaceState(RecordingStatus.RECORDING, true)).toBe("recording");
    expect(recordingWorkspaceState(RecordingStatus.STARTING, true)).toBe("recording");
    expect(recordingWorkspaceState(RecordingStatus.ERROR, true)).toBe("recording");
    expect(recordingWorkspaceState(RecordingStatus.SAVING, true)).toBe("recording");
  });

  test("starting maps to starting before backend session is live", () => {
    expect(recordingWorkspaceState(RecordingStatus.STARTING, false)).toBe("starting");
  });

  test("recording maps to recording", () => {
    expect(recordingWorkspaceState(RecordingStatus.RECORDING, false)).toBe("recording");
  });

  test("stop lifecycle maps to stopping/processing/saving", () => {
    expect(recordingWorkspaceState(RecordingStatus.STOPPING, false)).toBe("stopping");
    expect(recordingWorkspaceState(RecordingStatus.PROCESSING_TRANSCRIPTS, false)).toBe("processing");
    expect(recordingWorkspaceState(RecordingStatus.SAVING, false)).toBe("saving");
  });

  test("error maps to error", () => {
    expect(recordingWorkspaceState(RecordingStatus.ERROR, false)).toBe("error");
  });

  test("idle/completed fall through to recording (defensive default)", () => {
    expect(recordingWorkspaceState(RecordingStatus.IDLE, false)).toBe("recording");
    expect(recordingWorkspaceState(RecordingStatus.COMPLETED, false)).toBe("recording");
  });
});

describe("formatElapsed", () => {
  test("zero and negative values clamp to 00:00", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(-5)).toBe("00:00");
  });

  test("under an hour formats MM:SS", () => {
    expect(formatElapsed(59)).toBe("00:59");
    expect(formatElapsed(60)).toBe("01:00");
    expect(formatElapsed(3599)).toBe("59:59");
  });

  test("an hour and beyond formats H:MM:SS", () => {
    expect(formatElapsed(3600)).toBe("1:00:00");
    expect(formatElapsed(3661)).toBe("1:01:01");
    expect(formatElapsed(36600)).toBe("10:10:00");
  });

  test("fractional seconds floor to whole seconds", () => {
    expect(formatElapsed(90.9)).toBe("01:30");
  });
});

describe("recordingStatusLabel", () => {
  test("recording reflects pause state", () => {
    expect(recordingStatusLabel("recording", false)).toBe("Recording");
    expect(recordingStatusLabel("recording", true)).toBe("Paused");
  });

  test("lifecycle labels are human readable", () => {
    expect(recordingStatusLabel("starting")).toBe("Starting recording");
    expect(recordingStatusLabel("stopping")).toBe("Stopping recording");
    expect(recordingStatusLabel("processing")).toBe("Finalizing transcription");
    expect(recordingStatusLabel("saving")).toBe("Saving meeting");
    expect(recordingStatusLabel("error")).toBe("Recording error");
  });
});
