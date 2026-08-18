import { describe, expect, test } from "bun:test";
import {
  ASK_SIVLO_EMPTY_STATE_COPY,
  ASK_SIVLO_CONFIGURE_AI_PATH,
} from "../../../src/features/ask-sivlo/uiConstants";

describe("ASK_SIVLO_EMPTY_STATE_COPY", () => {
  test("empty_state_copy_matches_general_chat_design", () => {
    expect(ASK_SIVLO_EMPTY_STATE_COPY).toBe(
      "Ask about your meetings, Sivlo, or anything else.",
    );
  });
});

describe("ASK_SIVLO_CONFIGURE_AI_PATH", () => {
  test("configure_ai_path_targets_summary_models", () => {
    expect(ASK_SIVLO_CONFIGURE_AI_PATH).toBe("/settings?tab=summaryModels");
  });
});
