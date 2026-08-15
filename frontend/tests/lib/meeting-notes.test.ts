import { describe, expect, test } from "bun:test";
import { notesToBlocks } from "../../src/features/notes/meeting-notes";

describe("notesToBlocks", () => {
  test("returns a valid empty BlockNote document when notes have never been saved (null)", () => {
    const blocks = notesToBlocks(null);
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]).toMatchObject({ type: "paragraph", content: [] });
  });

  test("returns the blocks as-is for a valid BlockNote document", () => {
    const blocks = [
      { id: "b1", type: "paragraph", props: {}, content: ["hello"] },
    ];
    expect(notesToBlocks(blocks as any)).toEqual(blocks);
  });

  test("degrades to a valid empty BlockNote document for an empty or invalid payload", () => {
    for (const payload of [
      [] as any,
      { not: "an array" },
      "garbage",
      undefined,
    ]) {
      const blocks = notesToBlocks(payload);
      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0]).toMatchObject({ type: "paragraph", content: [] });
    }
  });
});
