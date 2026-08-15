import type { BlockNoteBlock, Section, Summary, SummaryDataResponse } from "@/types";
import type {
  DerivedAction,
  DerivedDecision,
  ParseResult,
} from "./types";

const ACTION_KEYWORDS = [
  "action items",
  "action item",
  "actions",
  "action",
  "next steps",
  "next step",
  "to-do",
  "todo",
  "todos",
  "tasks",
];

const DECISION_KEYWORDS = ["key decisions", "decisions", "decision"];

const OWNER_COLUMNS = new Set(["owner", "assignee", "assigned to", "who"]);
const TASK_COLUMNS = new Set([
  "task",
  "action",
  "action item",
  "description",
  "what",
  "item",
]);
const DUE_COLUMNS = new Set(["due", "due date", "deadline", "when"]);
const REFERENCE_COLUMNS = new Set(["reference", "ref", "notes", "link"]);

const DECISION_COLUMNS = new Set(["decision", "decided", "what was decided"]);
const RATIONALE_COLUMNS = new Set(["rationale", "reason", "why"]);
const TIMESTAMP_COLUMNS = new Set(["timestamp", "time", "date", "when"]);

const OWNER_PATTERN = /^([A-Z][A-Za-z .'-]{0,39}):\s+(.*)$/;
const DUE_CLAUSE_PATTERN = /^(.*?)\s+by\s+(.+)$/;
const SEPARATOR_CELL_PATTERN = /^:?-{3,}:?$/;
const LIST_ITEM_PATTERN = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

interface SectionConfig<T> {
  keywords: string[];
  columns: Record<string, keyof T>;
  buildRecord: (record: Record<string, string>) => T | null;
  rawFromCells: (cells: string[]) => T;
  listItem: (text: string) => T;
}

function normalizeHeading(text: string): string {
  return stripEmphasis(text.replace(/^#+\s*/, ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripEmphasis(text: string): string {
  return text.replace(/[*_`~]/g, "").trim();
}

function findSectionHeading(markdown: string, keywords: string[]): number {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#")) continue;
    const normalized = normalizeHeading(line);
    if (keywords.includes(normalized)) return i;
  }
  return -1;
}

function collectBody(markdown: string, headingIndex: number): string[] {
  const lines = markdown.split("\n");
  const body: string[] = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("#")) break;
    body.push(line);
  }
  return body;
}

function splitRow(line: string): string[] {
  const cells = line.split("|").map((cell) => cell.trim());
  if (line.trimStart().startsWith("|")) cells.shift();
  if (line.trimEnd().endsWith("|")) cells.pop();
  return cells;
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell));
}

function parseTable<T>(lines: string[], config: SectionConfig<T>): T[] {
  const headerCells = splitRow(lines[0]);
  const columnMap = headerCells.map(
    (cell) => config.columns[stripEmphasis(cell).toLowerCase().trim()] ?? null,
  );

  if (!columnMap.some(Boolean)) return [];

  let start = 1;
  if (lines[1] && isSeparatorRow(lines[1])) start = 2;

  const items: T[] = [];
  for (let i = start; i < lines.length && lines[i].startsWith("|"); i++) {
    const cells = splitRow(lines[i]);
    const item =
      cells.length === headerCells.length
        ? mapTableItem(cells, columnMap, config)
        : config.rawFromCells(cells);
    if (item) items.push(item);
  }
  return items;
}

function mapTableItem<T>(
  cells: string[],
  columnMap: (keyof T | null)[],
  config: SectionConfig<T>,
): T | null {
  const record: Record<string, string> = {};
  let hasValue = false;
  for (let k = 0; k < columnMap.length; k++) {
    const field = columnMap[k];
    const value = cells[k]?.trim() || undefined;
    if (field && value) {
      record[field as string] = value;
      hasValue = true;
    }
  }
  if (!hasValue) return null;
  return config.buildRecord(record);
}

function parseList<T>(lines: string[], config: SectionConfig<T>): T[] {
  const items: T[] = [];
  for (const line of lines) {
    const match = LIST_ITEM_PATTERN.exec(line);
    if (!match) continue;
    const item = config.listItem(match[1].trim());
    if (item) items.push(item);
  }
  return items;
}

function parseSection<T>(markdown: string, config: SectionConfig<T>): ParseResult<T> {
  const headingIndex = findSectionHeading(markdown, config.keywords);
  if (headingIndex === -1) return { items: [], foundSection: false };

  const body = collectBody(markdown, headingIndex)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (body.length === 0) return { items: [], foundSection: true };
  const items = body[0].startsWith("|")
    ? parseTable(body, config)
    : parseList(body, config);

  return { items, foundSection: true };
}

function actionRecord(record: Record<string, string>): DerivedAction {
  return {
    task: record.task,
    ...(record.owner ? { owner: record.owner } : {}),
    ...(record.due ? { due: record.due } : {}),
    ...(record.reference ? { reference: record.reference } : {}),
  };
}

const ACTION_CONFIG: SectionConfig<DerivedAction> = {
  keywords: ACTION_KEYWORDS,
  columns: {
    ...Object.fromEntries([...OWNER_COLUMNS].map((name) => [name, "owner" as const])),
    ...Object.fromEntries([...TASK_COLUMNS].map((name) => [name, "task" as const])),
    ...Object.fromEntries([...DUE_COLUMNS].map((name) => [name, "due" as const])),
    ...Object.fromEntries(
      [...REFERENCE_COLUMNS].map((name) => [name, "reference" as const]),
    ),
  },
  buildRecord: (record) =>
    record.task ? actionRecord(record) : null,
  rawFromCells: (cells) => ({ task: cells.join(" — ") }),
  listItem: (text) => {
    const ownerMatch = OWNER_PATTERN.exec(text);
    let owner: string | undefined;
    let rest = text;
    if (ownerMatch) {
      owner = ownerMatch[1];
      rest = ownerMatch[2];
    }
    const dueMatch = DUE_CLAUSE_PATTERN.exec(rest);
    if (dueMatch) {
      return {
        task: dueMatch[1].trim(),
        ...(owner ? { owner } : {}),
        due: dueMatch[2].trim(),
      };
    }
    return {
      task: rest.trim(),
      ...(owner ? { owner } : {}),
    };
  },
};

const DECISION_CONFIG: SectionConfig<DerivedDecision> = {
  keywords: DECISION_KEYWORDS,
  columns: {
    ...Object.fromEntries(
      [...DECISION_COLUMNS].map((name) => [name, "decision" as const]),
    ),
    ...Object.fromEntries(
      [...RATIONALE_COLUMNS].map((name) => [name, "rationale" as const]),
    ),
    ...Object.fromEntries(
      [...TIMESTAMP_COLUMNS].map((name) => [name, "timestamp" as const]),
    ),
  },
  buildRecord: (record) =>
    record.decision
      ? {
          decision: record.decision,
          ...(record.rationale ? { rationale: record.rationale } : {}),
          ...(record.timestamp ? { timestamp: record.timestamp } : {}),
        }
      : null,
  rawFromCells: (cells) => ({ decision: cells.join(" — ") }),
  listItem: (text) => ({ decision: text.trim() }),
};

export function parseActions(markdown: string | null | undefined): ParseResult<DerivedAction> {
  if (!markdown) return { items: [], foundSection: false };
  return parseSection(markdown, ACTION_CONFIG);
}

export function parseDecisions(markdown: string | null | undefined): ParseResult<DerivedDecision> {
  if (!markdown) return { items: [], foundSection: false };
  return parseSection(markdown, DECISION_CONFIG);
}

const SKIPPED_LEGACY_KEYS = new Set([
  "MeetingName",
  "MeetingDate",
  "_section_order",
  "markdown",
  "summary_json",
]);

function renderInline(content: BlockNoteBlock["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => (typeof item === "string" ? item : item?.text ?? ""))
    .join("")
    .trim();
}

function renderBlock(block: BlockNoteBlock): string {
  const inline = renderInline(block.content);
  switch (block.type) {
    case "heading": {
      const level = block.props?.level ?? 2;
      const clamped = Math.min(6, Math.max(1, Number(level) || 2));
      return `${"#".repeat(clamped)} ${inline}`;
    }
    case "bulletListItem":
      return `- ${inline}`;
    case "numberedListItem":
      return `1. ${inline}`;
    default:
      return inline;
  }
}

function blocknoteToMarkdown(blocks: BlockNoteBlock[]): string {
  const lines: string[] = [];
  let previousWasHeading = false;
  for (const block of blocks) {
    if (!block) continue;
    const rendered = renderBlock(block);
    if (rendered) {
      if (lines.length > 0 && (previousWasHeading || block.type === "heading")) {
        lines.push("");
      }
      lines.push(rendered);
    }
    previousWasHeading = block.type === "heading";
    if (block.children?.length) {
      const children = blocknoteToMarkdown(block.children);
      if (children) lines.push(children);
    }
  }
  return lines.join("\n");
}

function legacyToMarkdown(summary: SummaryDataResponse): string {
  const order = Array.isArray(summary._section_order)
    ? summary._section_order
    : Object.keys(summary).filter((key) => !SKIPPED_LEGACY_KEYS.has(key));

  const parts: string[] = [];
  for (const key of order) {
    const section = summary[key] as Section | undefined;
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;
    const title = typeof section.title === "string" && section.title.trim() ? section.title : key;
    if (!Array.isArray(section.blocks)) continue;
    const contents = section.blocks
      .map((block) => block?.content)
      .filter((content): content is string => typeof content === "string" && content.trim().length > 0);
    if (contents.length === 0) continue;
    parts.push(`## ${title}\n\n${contents.map((content) => `- ${content}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export function summaryToMarkdown(summary: Summary | SummaryDataResponse | null | undefined): string {
  if (!summary || typeof summary !== "object") return "";

  const data = summary as SummaryDataResponse;

  if (typeof data.markdown === "string" && data.markdown.trim()) return data.markdown;

  if (Array.isArray(data.summary_json) && data.summary_json.length > 0) {
    return blocknoteToMarkdown(data.summary_json);
  }

  return legacyToMarkdown(data);
}
