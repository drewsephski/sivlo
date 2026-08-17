import { describe, expect, test } from "bun:test";
import { shouldSubmitAskSivloKey } from "../../../src/features/ask-sivlo/composer";

describe("shouldSubmitAskSivloKey", () => {
  test("Enter submits", () => {
    expect(shouldSubmitAskSivloKey("Enter", false, false)).toBe(true);
  });

  test("Shift+Enter does not submit", () => {
    expect(shouldSubmitAskSivloKey("Enter", true, false)).toBe(false);
  });

  test("IME composing Enter does not submit", () => {
    expect(shouldSubmitAskSivloKey("Enter", false, true)).toBe(false);
  });

  test("other keys do not submit", () => {
    expect(shouldSubmitAskSivloKey("a", false, false)).toBe(false);
  });
});
