import { describe, expect, test } from "bun:test";
import {
  parseActions,
  parseDecisions,
  summaryToMarkdown,
} from "../../../src/features/meeting-intelligence";

describe("parseActions", () => {
  test("parses a standard Action Items markdown table (Owner/Task/Due)", () => {
    const { items: actions, foundSection } = parseActions(`
## Action Items

| Owner | Task | Due |
| --- | --- | --- |
| Drew | Send proposal | Friday |
| Alex | Review pricing | Monday |
`);
    expect(foundSection).toBe(true);
    expect(actions).toEqual([
      { owner: "Drew", task: "Send proposal", due: "Friday" },
      { owner: "Alex", task: "Review pricing", due: "Monday" },
    ]);
  });

  test("parses a table with extra Reference columns", () => {
    const { items: actions } = parseActions(`
## Next Steps

| Owner | Task | Due | Reference |
| --- | --- | --- | --- |
| Drew | Draft email | Friday | https://example.com |
| | QA pass | Tue | ticket-42 |
`);
    expect(actions).toEqual([
      {
        owner: "Drew",
        task: "Draft email",
        due: "Friday",
        reference: "https://example.com",
      },
      { task: "QA pass", due: "Tue", reference: "ticket-42" },
    ]);
  });

  test("parses bulleted Action Items", () => {
    const { items: actions } = parseActions(`
## Action Items

- Drew: Send proposal by Friday
- Alex: Review pricing
- Finalize the deck
`);
    expect(actions).toEqual([
      { owner: "Drew", task: "Send proposal", due: "Friday" },
      { owner: "Alex", task: "Review pricing" },
      { task: "Finalize the deck" },
    ]);
  });

  test("does not find a section when Action Items is missing", () => {
    const { items: actions, foundSection } = parseActions(`
## Key Points

- First key point
`);
    expect(foundSection).toBe(false);
    expect(actions).toEqual([]);
  });

  test("finds an empty section with no items", () => {
    const { items: actions, foundSection } = parseActions(`
## Action Items
`);
    expect(foundSection).toBe(true);
    expect(actions).toEqual([]);
  });

  test("degrades gracefully on a malformed table (mismatched columns)", () => {
    const { items: actions } = parseActions(`
## Action Items

| Owner | Task | Due |
| --- | --- |
| Drew | Send | Friday | extra |
`);
    expect(actions).toEqual([
      {
        task: "Drew — Send — Friday — extra",
      },
    ]);
  });

  test("returns no items when the table headers are unsupported", () => {
    const { items: actions } = parseActions(`
## Action Items

| A | B | C |
| --- | --- | --- |
| x | y | z |
`);
    expect(actions).toEqual([]);
  });
});

describe("parseDecisions", () => {
  test("parses a Key Decisions table", () => {
    const { items: decisions, foundSection } = parseDecisions(`
## Key Decisions

| Decision | Rationale |
| --- | --- |
| Ship v2 in Q3 | Market timing |
| Hire a PM | Team growth |
`);
    expect(foundSection).toBe(true);
    expect(decisions).toEqual([
      { decision: "Ship v2 in Q3", rationale: "Market timing" },
      { decision: "Hire a PM", rationale: "Team growth" },
    ]);
  });

  test("parses a Decision/Rationale/Timestamp table", () => {
    const { items: decisions } = parseDecisions(`
## Decisions

| Decision | Rationale | Timestamp |
| --- | --- | --- |
| Use Postgres | Consistency | 10:15 |
`);
    expect(decisions).toEqual([
      { decision: "Use Postgres", rationale: "Consistency", timestamp: "10:15" },
    ]);
  });

  test("parses bulleted decisions", () => {
    const { items: decisions } = parseDecisions(`
## Decisions

- We chose option A over B
- Decided to move the release to Friday
`);
    expect(decisions).toEqual([
      { decision: "We chose option A over B" },
      { decision: "Decided to move the release to Friday" },
    ]);
  });

  test("does not find a section when Decisions is missing", () => {
    const { items: decisions, foundSection } = parseDecisions(`
## Summary

Some paragraph.
`);
    expect(foundSection).toBe(false);
    expect(decisions).toEqual([]);
  });

  test("degrades gracefully on malformed decision rows", () => {
    const { items: decisions } = parseDecisions(`
## Decisions

| Decision | Rationale |
| --- | --- |
| Ship it | Fast | with extra |
`);
    expect(decisions).toEqual([{ decision: "Ship it — Fast — with extra" }]);
  });
});

describe("parser safety", () => {
  test("actions parser does not read the decision section", () => {
    const { items: actions } = parseActions(`
## Key Decisions

| Decision | Rationale |
| --- | --- |
| Ship it | Fast |
`);
    expect(actions).toEqual([]);
  });

  test("decisions parser does not read the action section", () => {
    const { items: decisions } = parseDecisions(`
## Action Items

- Drew: Send proposal
`);
    expect(decisions).toEqual([]);
  });

  test("unknown sections are ignored", () => {
    const { items: actions } = parseActions(`
## Random Section

- something
`);
    const { items: decisions } = parseDecisions(`
## Random Section

- something
`);
    expect(actions).toEqual([]);
    expect(decisions).toEqual([]);
  });

  test("normal summary paragraphs are ignored", () => {
    const markdown = `
This is a plain paragraph.

Another paragraph here.

### Key Points
- First key point
`;
    expect(parseActions(markdown).items).toEqual([]);
    expect(parseDecisions(markdown).items).toEqual([]);
  });
});

describe("summaryToMarkdown", () => {
  test("passes through an existing markdown summary", () => {
    expect(summaryToMarkdown({ markdown: "## Action Items\n\n- x" } as any)).toBe(
      "## Action Items\n\n- x",
    );
  });

  test("converts a legacy sections summary to markdown", () => {
    const legacy = {
      MeetingName: "Team Sync",
      Action_Items: {
        title: "Action Items",
        blocks: [{ content: "Send proposal" }, { content: "Review pricing" }],
      },
      _section_order: ["Action_Items"],
    };
    expect(summaryToMarkdown(legacy as any)).toBe(
      "## Action Items\n\n- Send proposal\n- Review pricing",
    );
  });

  test("returns an empty string for empty or unknown summaries", () => {
    expect(summaryToMarkdown(null)).toBe("");
    expect(summaryToMarkdown(undefined)).toBe("");
    expect(summaryToMarkdown({} as any)).toBe("");
  });

  test("recovers markdown from a blocknote summary_json document", () => {
    const blocknote = {
      summary_json: [
        { id: "h1", type: "heading", props: { level: 2 }, content: ["Action Items"] },
        { id: "p1", type: "bulletListItem", content: [{ type: "text", text: "Send proposal" }] },
      ],
    };
    expect(summaryToMarkdown(blocknote as any)).toBe(
      "## Action Items\n\n- Send proposal",
    );
  });
});
