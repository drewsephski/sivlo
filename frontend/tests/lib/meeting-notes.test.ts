import { describe, expect, test } from "bun:test";
import { notesToBlocks } from "../../src/features/notes/meeting-notes";

describe("notesToBlocks", () => {
  test("returns empty blocks when notes have never been saved (null)", () => {
    expect(notesToBlocks(null)).toEqual([]);
  });

  test("returns the blocks as-is for a valid BlockNote document", () => {
    const blocks = [
      { id: "b1", type: "paragraph", props: {}, content: ["hello"] },
    ];
    expect(notesToBlocks(blocks as any)).toEqual(blocks);
  });

  test("degrades to empty blocks for an invalid payload", () => {
    expect(notesToBlocks({ not: "an array" } as any)).toEqual([]);
    expect(notesToBlocks("garbage" as any)).toEqual([]);
    expect(notesToBlocks(undefined as any)).toEqual([]);
  });
});
