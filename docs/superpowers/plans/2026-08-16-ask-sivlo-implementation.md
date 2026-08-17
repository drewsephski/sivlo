# Ask Sivlo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.

- **Spec:** [2026-08-16-ask-sivlo-design.md](../specs/2026-08-16-ask-sivlo-design.md)
- **Date:** 2026-08-16

---

## Goal

Implement Ask Sivlo — a session-only, retrieval-augmented assistant on the Sivlo homepage. Users ask questions about their locally stored meetings (all meetings or a single meeting) and receive answers grounded in transcript, summary, note, action item, and decision data with structured citations. The assistant also answers Sivlo product/help questions. Conversation history is bounded and session-only. No new npm or Cargo dependencies.

---

## Architecture

- **Backend:** New Rust module `frontend/src-tauri/src/api/ask_sivlo/` — single Tauri command `api_ask_sivlo` owns the full pipeline
- **Frontend:** `frontend/src/features/ask-sivlo/` — module-level store, hook, UI components, pure helper functions with bun:test
- **Routing:** Deterministic lexical routing — explicit scope → meeting; clear product pattern + Sivlo keyword → product; otherwise meeting-first with zero-evidence fallback to product
- **Retrieval:** Normalized keyword search with scoring/ranking/dedup across all five source types
- **Citations:** Backend-owned evidence map with sequential source IDs (`S1`, `S2`, ...) assigned only to evidence included in the prompt
- **Session:** In-memory module-level store with `useSyncExternalStore` — survives navigation, lost on app restart

---

## Tech Stack

- Rust: `regex = "1.11.0"`, `serde`, `sqlx`, `reqwest`, existing `llm_client.rs` infrastructure
- TypeScript: React 18, `useSyncExternalStore`, existing UI components (`Button`, `Textarea`, `ScrollArea`, `Popover`, `Select`)
- Tests: Rust `cargo test --lib ask_sivlo`, Bun `bun test` (existing infrastructure in `frontend/tests/`)

---

## Global Constraints

- [ ] No new npm dependencies
- [ ] No new Cargo dependencies
- [ ] No persistence (no localStorage, sessionStorage, IndexedDB, database writes)
- [ ] No analytics or telemetry
- [ ] No new LLM provider abstraction — call existing `generate_summary()` directly
- [ ] No streaming responses
- [ ] All `*_CHARS` constants use Unicode-safe `.chars()` semantics, not byte `.len()`
- [ ] No user data interpolation into SQL (parameterized queries only)
- [ ] Every behavioral change follows RED → GREEN → REFACTOR → COMMIT
- [ ] Every task commits focused files only

---

## Task 1: Backend Types and Module Skeleton

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/mod.rs` (create)
- `frontend/src-tauri/src/api/ask_sivlo/models.rs` (create)
- `frontend/src-tauri/src/api/mod.rs` (edit)

**Interfaces**

```rust
// models.rs — all types from spec §6.3 and §8.4

pub struct AskSivloHistoryMessage {
    pub role: String,
    pub content: String,
}

pub struct AskSivloScope {
    pub kind: String,
    #[serde(rename = "meetingId", skip_serializing_if = "Option::is_none")]
    pub meeting_id: Option<String>,
}

pub struct AskSivloCitation {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "meetingId")]
    pub meeting_id: String,
    #[serde(rename = "meetingTitle")]
    pub meeting_title: String,
    #[serde(rename = "meetingDate", skip_serializing_if = "Option::is_none")]
    pub meeting_date: Option<String>,
    #[serde(rename = "sourceType")]
    pub source_type: String,
    pub excerpt: String,
    #[serde(rename = "timestampStart", skip_serializing_if = "Option::is_none")]
    pub timestamp_start: Option<f64>,
    #[serde(rename = "timestampEnd", skip_serializing_if = "Option::is_none")]
    pub timestamp_end: Option<f64>,
}

pub struct AskSivloResponse {
    pub answer: String,
    pub route: String,
    pub citations: Vec<AskSivloCitation>,
}

pub(crate) struct RawEvidence {
    pub meeting_id: String,
    pub meeting_title: String,
    pub meeting_date: Option<String>,
    pub source_type: String,
    pub text: String,
    pub timestamp: Option<String>,
    pub audio_start_time: Option<f64>,
    pub audio_end_time: Option<f64>,
}

pub(crate) struct ProviderConfig {
    pub provider: crate::summary::llm_client::LLMProvider,
    pub model_name: String,
    pub api_key: String,
    pub ollama_endpoint: Option<String>,
    pub custom_openai_endpoint: Option<String>,
    pub app_data_dir: Option<std::path::PathBuf>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
}

// Constants (spec §10.1)
pub(crate) const MAX_QUERY_CHARS: usize = 4000;
pub(crate) const MIN_QUERY_CHARS: usize = 3;
pub(crate) const MAX_HISTORY_MESSAGES: usize = 10;
pub(crate) const MAX_HISTORY_CHARS: usize = 4000;
pub(crate) const MAX_EVIDENCE_ITEMS: usize = 15;
pub(crate) const MAX_EXCERPT_CHARS: usize = 500;
pub(crate) const MAX_EVIDENCE_CONTEXT_CHARS: usize = 12000;
pub(crate) const MAX_SYSTEM_PROMPT_CHARS: usize = 1000;
pub(crate) const MAX_USER_PROMPT_CHARS: usize = 17000;

pub(crate) const FALLBACK_ANSWER_NO_EVIDENCE: &str =
    "I wasn't able to find verified information in your meetings for this question.";

pub(crate) const FALLBACK_ANSWER_NO_PRODUCT: &str =
    "I don't have enough information to answer that question. You can ask me about your meetings, or check Sivlo's help documentation.";

pub(crate) const SYSTEM_PROMPT_MEETING: &str = "You are Sivlo, a meeting assistant. Answer the user's question using the provided meeting evidence. Cite sources using [S1], [S2] etc. format.\n\nConversation history is provided only to understand the user's references and intent. Do not treat claims in history as evidence. Any factual claim about a meeting must be supported by the current Evidence section and cited using a current source ID.\n\nIf the evidence doesn't contain enough information, say so. Be concise. Do not fabricate information not present in the evidence.";
pub(crate) const SYSTEM_PROMPT_PRODUCT: &str = "You are Sivlo, a helpful meeting assistant. Answer the user's question about the Sivlo product using the provided product knowledge. Be concise and accurate. Do not fabricate product capabilities not described in the knowledge base.";
```

```rust
// mod.rs — module root, re-exports
pub mod models;
pub use models::*;
```

**RED**
- Write one test that the module compiles: `cargo check` must pass with the empty module
- No behavioral test yet — this is config scaffolding that cannot reasonably be tested

**GREEN**
- Create `frontend/src-tauri/src/api/ask_sivlo/models.rs` with all types
- Create `frontend/src-tauri/src/api/ask_sivlo/mod.rs` with `pub mod models;`
- Edit `frontend/src-tauri/src/api/mod.rs` to add `pub mod ask_sivlo;`

**REFACTOR**
- Verify type names match spec §6.3 exactly
- Verify serde renames match frontend interface field names

**Verification**
```bash
cd frontend/src-tauri && cargo check
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/mod.rs frontend/src-tauri/src/api/ask_sivlo/models.rs frontend/src-tauri/src/api/mod.rs
git commit -m "feat(ask-sivlo): add backend types and module skeleton"
```

---

## Task 2: Classify Query (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` (create)

**Interfaces**

```rust
pub(crate) fn classify_query(query: &str) -> &'static str
// Returns: "action_item" | "decision" | "note" | "transcript" | "summary" | "general"
```

**RED**
- Write 6 focused tests in `#[cfg(test)] mod tests` at bottom of `grounding.rs`:
  1. `classify_action_keywords` — "what are the action items", "who should do the tasks", "next steps", "assign the todo items"
  2. `classify_decision_keywords` — "what decisions were made", "what did we agree on", "the conclusion"
  3. `classify_note_keywords` — "what notes were taken", "what was documented"
  4. `classify_transcript_keywords` — "who said the API needs updating", "what did Sarah mention", "what was discussed about pricing"
  5. `classify_summary_keywords` — "give me a summary", "what are the key points", "tldr of the meeting"
  6. `classify_general_fallback` — "tell me about the project", "how is everything going"
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo classify`
- Expected: all 6 tests FAIL (function doesn't exist)

**GREEN**
- Implement `classify_query` in `grounding.rs`
- Keywords checked against full lowercased query text
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo classify`
- Expected: all 6 tests PASS

**REFACTOR**
- Clean up keyword arrays
- Re-run all 6 tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo classify
cd frontend/src-tauri && cargo check
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/grounding.rs
git commit -m "feat(ask-sivlo): implement classify_query with tests"
```

---

## Task 3: Route Query (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` (edit)

**Interfaces**

```rust
pub(crate) fn route_query(query: &str, scope: &Option<AskSivloScope>) -> &'static str
// Returns: "meeting" | "product"
```

Routing precedence (spec §8.3, fixed):
1. Explicit meeting scope → "meeting"
2. Clear meeting evidence/temporal intent → "meeting"
3. Clear product question pattern AND Sivlo/product capability keyword → "product"
4. Explicit Sivlo/app reference + product capability keyword → "product"
5. Otherwise → "meeting"

Note: Post-retrieval product fallback (zero meeting evidence + product facts match) is handled in the `api_ask_sivlo` orchestration (Task 12), not in `route_query`.

**RED**
- Write 8 focused tests:
  1. `route_meeting_explicit_scope` — scope `{ kind: "meeting" }` → always "meeting"
  2. `route_product_question_patterns` — "how do I import audio", "what is Sivlo's transcription" → "product" (only when BOTH question pattern AND product keyword present)
  3. `route_product_sivlo_reference` — "can Sivlo do X", "does the app support Y" → "product" (Sivlo reference + capability keyword)
  4. `route_meeting_evidence_keywords` — "what did Sarah say", "what decisions were made" → "meeting"
  5. `route_meeting_temporal_references` — "what happened last week", "yesterday's standup" → "meeting"
  6. `route_ambiguous_meeting_wins` — "What is the pricing decision from yesterday's meeting?" → "meeting" (temporal + meeting keywords outweigh product pattern)
  7. `route_meeting_default` — "tell me about the project" → "meeting"
  8. `route_product_only_pattern_no_match` — "how do i cook pasta" → "meeting" (question pattern but no product keyword)
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo route`
- Expected: all 8 tests FAIL

**GREEN**
- Implement `route_query` following the precedence rules above
- Post-retrieval product fallback is handled in `api_ask_sivlo` orchestration (Task 12), not in `route_query`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo route`
- Expected: all 8 tests PASS

**REFACTOR**
- Remove any redundant keyword lists
- Re-run all route tests + classify tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/grounding.rs
git commit -m "feat(ask-sivlo): implement route_query with precedence rules"
```

---

## Task 4: Sanitize History + Extract Citations (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` (edit)

**Interfaces**

```rust
pub(crate) fn sanitize_history(history: &[AskSivloHistoryMessage]) -> Vec<AskSivloHistoryMessage>
// Strips [S1], [S23] etc. markers from content

pub(crate) fn extract_citation_ids(answer: &str) -> Vec<usize>
// Parses [S1], [S23] etc. and returns numeric IDs
```

**RED**
- Write 5 focused tests:
  1. `sanitize_strips_citation_markers` — "[S1]" and "[S23]" removed from content
  2. `sanitize_preserves_role` — role field unchanged
  3. `sanitize_empty_history` — empty input returns empty
  4. `extract_citation_ids_valid` — "Hello [S1] world [S2] and [S10]" → [1, 2, 10]
  5. `extract_citation_ids_none` — "No citations here" → []
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo`
- Expected: these 5 tests FAIL (functions don't exist yet)

**GREEN**
- Implement `sanitize_history` and `extract_citation_ids` using `regex::Regex` (already a dependency)
- Use `once_cell::sync::Lazy` for compiled regex patterns
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo`
- Expected: all tests PASS

**REFACTOR**
- Verify regex patterns are correct
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/grounding.rs
git commit -m "feat(ask-sivlo): implement sanitize_history and extract_citation_ids"
```

---

## Task 5: Product Knowledge (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/product_knowledge.rs` (create)

**Interfaces**

```rust
pub(crate) struct ProductFact {
    pub keywords: &'static [&'static str],
    pub answer: &'static str,
}

pub(crate) const PRODUCT_FACTS: &[ProductFact] = &[
    ProductFact {
        keywords: &["record", "recording", "capture", "audio", "system audio", "microphone"],
        answer: "Sivlo captures meeting audio using the microphone and system audio. On macOS, system audio capture uses Core Audio tap. Microphone capture uses CPAL. Audio is processed locally.",
    },
    ProductFact {
        keywords: &["transcrib", "transcription", "whisper", "parakeet", "speech to text", "stt"],
        answer: "Sivlo transcribes meetings locally using Whisper or Parakeet engines. Cloud transcription providers (OpenAI, Groq, etc.) are also available via configured provider settings.",
    },
    ProductFact {
        keywords: &["import", "audio file", "wav", "mp3", "m4a"],
        answer: "Sivlo supports importing supported audio files. Imported audio is decoded locally and transcribed using your configured transcription provider, which may be local or cloud-based.",
    },
    ProductFact {
        keywords: &["summar", "summary", "summarize", "key points", "tldr"],
        answer: "Sivlo generates meeting summaries using your configured LLM provider. Summaries include action items, decisions, and key discussion points.",
    },
    ProductFact {
        keywords: &["note", "notes", "editor", "blocknote", "rich text"],
        answer: "Sivlo includes a rich text notes editor powered by BlockNote. Notes are stored locally and used for retrieval.",
    },
    ProductFact {
        keywords: &["priv", "private", "privacy", "data", "security", "local", "leave", "device"],
        answer: "Local retrieval and storage stays on your device. Cloud transcription may send audio to the configured transcription provider. Cloud LLM use may send bounded text, history, and evidence to the configured AI provider. Your meeting data in SQLite remains local.",
    },
    ProductFact {
        keywords: &["platform", "macos", "windows", "linux", "system requirements"],
        answer: "Sivlo is currently in public beta on macOS 13+. System audio capture uses Core Audio tap. GPU acceleration (Metal) is available for faster transcription.",
    },
    ProductFact {
        keywords: &["gpu", "metal", "cuda", "vulkan", "acceleration", "speed"],
        answer: "Sivlo supports GPU acceleration for transcription. On macOS, Metal is used. GPU acceleration significantly speeds up local transcription.",
    },
    ProductFact {
        keywords: &["llm", "ai model", "provider", "ollama", "claude", "openai", "groq"],
        answer: "Sivlo supports multiple LLM providers for summarization: Ollama (local), Claude, OpenAI, Groq, and OpenRouter. Configure your preferred provider in settings.",
    },
    ProductFact {
        keywords: &["meeting", "meetings", "search", "retrieval", "find"],
        answer: "Sivlo stores all your meetings locally. You can search across all meetings or scope to a specific meeting. Retrieval uses transcript, summary, notes, action items, and decisions.",
    },
];

pub(crate) fn find_matching_product_facts(query: &str) -> Vec<&'static ProductFact>
```

Product facts — verified against current Sivlo codebase (NOT Meetily assumptions):

- **Recording:** macOS uses Core Audio tap (via `cidre` crate) for system audio capture — NOT BlackHole. No BlackHole dependency in the codebase. Microphone capture via CPAL.
- **Transcription:** Local Whisper/Parakeet engines. Also supports cloud providers (OpenAI, Groq, etc.) via configured provider settings.
- **Import:** Supports importing audio files (WAV, MP3, M4A, etc.) via `audio/import.rs`. Imported audio is decoded locally and transcribed using your configured transcription provider, which may be local or cloud-based.
- **Summaries:** Generated via configured LLM provider. Reuses existing `generate_summary()` from `llm_client.rs`.
- **Notes:** Rich text editor using BlockNote. `notes_markdown` used for retrieval.
- **Privacy:** Local retrieval and storage stays on device. Cloud transcription may send audio to the configured transcription provider. Cloud LLM use may send bounded text, history, and evidence to the configured AI provider. Data in SQLite remains local.
- **Platforms:** macOS 13+ is the current public beta. System audio capture uses Core Audio tap via `cidre`. GPU acceleration (Metal) available for transcription.

**RED**
- Write 3 focused tests:
  1. `product_facts_match_import_query` — "how do I import audio" → non-empty, answer contains "import"
  2. `product_facts_match_privacy_query` — "does my data leave my device" → non-empty, answer contains "privacy" or "locally"
  3. `product_facts_no_match` — "what is the meaning of life" → empty
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo product`
- Expected: all 3 tests FAIL

**GREEN**
- Create `product_knowledge.rs` with verified facts
- Add `pub mod product_knowledge;` to `mod.rs`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo product`
- Expected: all 3 tests PASS

**REFACTOR**
- Verify no BlackHole claims
- Verify no "mixed professionally with ducking" marketing claims
- Verify no unsupported platform claims
- Verify facts are small, factual, maintainable
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/product_knowledge.rs frontend/src-tauri/src/api/ask_sivlo/mod.rs
git commit -m "feat(ask-sivlo): add verified product knowledge with tests"
```

---

## Task 6: Summary → Canonical Markdown (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/summary_text.rs` (create)

**Interfaces**

```rust
pub(crate) fn summary_to_canonical_markdown(json_str: &str) -> String
// Converts persisted summary JSON to canonical markdown

pub(crate) fn extract_section_by_headings(markdown: &str, headings: &[&str]) -> String
// Extracts section content under matching headings
```

Handles the three persisted summary shapes (verified against `parse-intelligence.ts:summaryToMarkdown`):
A. `{ "markdown": "..." }` → return the markdown string
B. `{ "summary_json": [BlockNote blocks...] }` → convert blocks to markdown (heading level as `#`, bullet/numbered list semantics, recursive children, inline text)
C. Legacy section objects with `title` + `blocks` → render as `## title` + `- content`
D. Ignored metadata keys: `MeetingName`, `MeetingDate`, `_section_order`

**RED**
- Write 5 focused tests:
  1. `summary_markdown_passthrough` — `{ "markdown": "## Action Items\n\n- x" }` → returns the markdown as-is
  2. `summary_blocknote_heading` — BlockNote with `heading` block level 2 → `## Action Items`
  3. `summary_blocknote_bullet` — BlockNote with `bulletListItem` → `- Send proposal`
  4. `summary_legacy_sections` — Legacy `{ MeetingName, Action_Items: { title, blocks }, _section_order }` → `## Action Items\n\n- Send proposal`
  5. `summary_empty_or_unknown` — "", "null", "{}" → ""
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo summary_text`
- Expected: all 5 tests FAIL

**GREEN**
- Implement `summary_to_canonical_markdown` following the same logic as `parse-intelligence.ts:summaryToMarkdown` (Rust port)
- Add `pub mod summary_text;` to `mod.rs`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo summary_text`
- Expected: all 5 tests PASS

**REFACTOR**
- Verify heading levels preserved correctly
- Verify recursive children handled
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/summary_text.rs frontend/src-tauri/src/api/ask_sivlo/mod.rs
git commit -m "feat(ask-sivlo): implement summary-to-markdown conversion"
```

---

## Task 7: Lexical Retrieval — Normalize, Score, Rank, Dedupe (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/retrieval.rs` (create)

**Interfaces**

```rust
pub(crate) fn normalize_query_terms(query: &str) -> Vec<String>
// Lowercase, extract useful terms, remove stop words, preserve phrase info

pub(crate) fn score_evidence(
    query: &str,
    query_terms: &[String],
    classification: &str,
    scope: &Option<AskSivloScope>,
    evidence: &RawEvidence,
) -> f64
// Scores a single evidence item
// RawEvidence already contains meeting_title for scope/title matching

pub(crate) fn rank_and_dedupe_evidence(
    candidates: Vec<RawEvidence>,
    query: &str,
    classification: &str,
    scope: &Option<AskSivloScope>,
) -> Vec<RawEvidence>
// Ranks, deduplicates, and returns sorted by relevance
```

Stop words (minimal set): "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "out", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "about", "what", "which", "who", "whom", "this", "that", "these", "those", "i", "me", "my", "we", "our", "you", "your", "he", "him", "his", "she", "her", "it", "its", "they", "them", "their"

Scoring:
- Explicit scope/title match: +2.0 (uses evidence.meeting_title)
- Exact phrase match (full query in text): +3.0
- Token match density (fraction of query terms found): +0.0 to +2.0
- Source-intent boost (classification matches source_type): +1.0
- Recency: modest tie-break only (+0.0 to +0.1 based on recency)

**RED**
- Write 8 focused tests:
  1. `normalize_query_terms_basic` — "What were the action items?" → ["action", "items"] (stop words "what" and "were" removed)
  2. `normalize_query_terms_unicode` — "¿Qué pasó en la reunión?" → ["qué", "pasó", "reunión"]
  3. `normalize_stop_words_only` — "what is the" → [] (all stop words)
  4. `score_exact_phrase_match` — evidence containing full query scores higher than evidence with only partial terms
  5. `score_title_match_boost` — evidence from meeting with matching title scores higher
  6. `score_source_intent_boost` — action_item classification boosts transcript evidence less than action_item source
  7. `rank_relevance_beats_recency` — newer evidence with fewer term matches ranks lower than older evidence with more matches
  8. `rank_deduplication` — duplicate evidence (same meeting_id + source_type + text) deduplicated
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo retrieval`
- Expected: all 8 tests FAIL

**GREEN**
- Implement `normalize_query_terms`, `score_evidence`, `rank_and_dedupe_evidence`
- Add `pub mod retrieval;` to `mod.rs`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo retrieval`
- Expected: all 8 tests PASS

**REFACTOR**
- Verify Unicode handling
- Verify no SQL interpolation
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/retrieval.rs frontend/src-tauri/src/api/ask_sivlo/mod.rs
git commit -m "feat(ask-sivlo): implement lexical retrieval with scoring and ranking"
```

---

## Task 8: Evidence Retrieval (Rust — DB-dependent)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/retrieval.rs` (edit)

**Interfaces**

```rust
pub(crate) async fn retrieve_meeting_evidence(
    pool: &SqlitePool,
    query: &str,
    classification: &str,
    scope: &Option<AskSivloScope>,
) -> Result<Vec<RawEvidence>, String>
// Retrieves candidates from all five source types, then ranks/dedupes
```

Five source types participate: `transcript`, `summary`, `note`, `action_item`, `decision`

SQL patterns (from existing codebase):
- Transcripts: `SELECT transcript, timestamp, audio_start_time, audio_end_time FROM transcripts WHERE meeting_id = ? AND LOWER(transcript) LIKE ?` (parameterized)
- Summary: `SummaryProcessesRepository::get_summary_data(pool, meeting_id)` → `result` field → `summary_to_canonical_markdown`
- Notes: `MeetingNotesRepository::get_notes(pool, meeting_id)` → `notes_markdown`
- Action items: Extract from summary using `extract_section_by_headings(markdown, ACTION_HEADINGS)`
- Decisions: Extract from summary using `extract_section_by_headings(markdown, DECISION_HEADINGS)`

**RED**
- Write 12 focused in-memory SQLite RED tests using `sqlx::SqlitePool`:
  1. `retrieve_all_scope_transcripts` — insert 2 meetings with transcripts, query "pricing" → returns transcript evidence from both meetings
  2. `retrieve_meeting_scope` — insert 2 meetings, scope to meeting A → only meeting A evidence returned
  3. `retrieve_multi_term_non_contiguous` — insert transcript "the pricing decision was final" → query "what did we decide about pricing" returns it (useful terms ["decide", "pricing"] match, even though the full query is NOT a contiguous substring of the transcript)
  4. `retrieve_apostrophe_query_parameterized` — insert transcript "Sam's pricing proposal was approved" → query "Sam's pricing" retrieves successfully, no SQL errors from apostrophe
  5. `retrieve_timestamps_preserved` — insert transcript with audio_start_time/end_time → evidence has correct timestamps
  6. `retrieve_summary_evidence` — insert summary_processes row with result JSON → summary evidence returned
  7. `retrieve_notes_evidence` — insert meeting_notes row with notes_markdown → note evidence returned
  8. `retrieve_action_items_from_summary` — insert summary with "## Action Items" section → action_item source type evidence
  9. `retrieve_decisions_from_summary` — insert summary with "## Decisions" section → decision source type evidence
  10. `extract_action_items_from_summary` — full summary with multiple sections → only action items returned
  11. `extract_decisions_from_summary` — full summary → only decisions returned
  12. `retrieve_empty_normalized_terms_skips_like` — query of only stop words → no '%' only LIKE generated, empty result (not SQL error)
- Each DB test creates an in-memory SQLite database, inserts test data, calls `retrieve_meeting_evidence`, asserts results
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo retrieval`
- Expected: all 12 tests FAIL

**GREEN**
- Implement `retrieve_meeting_evidence` with parameterized SQL queries:
  1. Normalize query into useful terms first (strip stop words)
  2. Perform bound LIKE candidate searches using useful terms (never generate a '%' only query when terms are empty)
  3. Merge candidates from all five source types
  4. After retrieving candidates, call `rank_and_dedupe_evidence` from Task 7
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo retrieval`
- Expected: all retrieval tests PASS

**REFACTOR**
- Verify no user data in SQL strings (all parameterized)
- Verify Unicode-safe query handling
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/retrieval.rs
git commit -m "feat(ask-sivlo): implement meeting evidence retrieval"
```

---

## Task 9: Evidence Budget + Citation Map Integrity (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` (edit)

**Interfaces**

```rust
pub(crate) fn build_meeting_context(
    query: &str,
    history: &[AskSivloHistoryMessage],
    evidence: &[RawEvidence],  // already ranked/deduped from Task 7
    evidence_map: &mut HashMap<String, AskSivloCitation>,
) -> (String, String)
// Returns (system_prompt, user_prompt)
//
// Correct pipeline (no evidence may be removed after source IDs are assigned):
// 1. Build bounded history from prior messages (most recent first)
// 2. Estimate fixed prompt overhead (system prompt + history + question text)
// 3. Rank and deduplicate evidence (already done upstream by Task 7)
// 4. Apply MAX_EVIDENCE_ITEMS hard limit
// 5. Truncate excerpts to MAX_EXCERPT_CHARS (Unicode-safe via .chars())
// 6. Fit evidence within BOTH MAX_EVIDENCE_CONTEXT_CHARS and
//    (MAX_USER_PROMPT_CHARS minus fixed prompt overhead) — drop lowest-ranked
//    until both budgets are satisfied
// 7. FINAL evidence list — no further dropping after this point
// 8. Assign sequential S1...Sn source IDs ONLY to included evidence
// 9. Build evidence_map ONLY from included evidence
// 10. Render system prompt + user prompt with source-ID-marked evidence

pub(crate) fn build_bounded_history(
    messages: &[AskSivloHistoryMessage],
    max_messages: usize,
    max_chars: usize,
) -> Vec<AskSivloHistoryMessage>
// Returns most recent messages that fit within limits
```

**RED**
- Write 8 focused tests:
  1. `context_assigns_sequential_source_ids` — 3 evidence items → S1, S2, S3 in prompt and map
  2. `context_truncates_excerpt_to_max` — 1000-char excerpt → ≤500 chars in map
  3. `context_respects_max_evidence_items` — 20 candidates → only 15 appear in prompt and map
  4. `context_evidence_map_only_included` — dropped evidence has NO entry in evidence_map
  5. `context_source_ids_contiguous` — evidence_map contains S1..S15, no gaps
  6. `bounded_history_keeps_most_recent` — 20 messages → only last 10
  7. `bounded_history_respects_char_limit` — long messages truncated to MAX_HISTORY_CHARS keeping newest
  8. `context_user_prompt_budget_drops_before_assigning_ids` — construct enough ranked evidence + history to exceed MAX_USER_PROMPT_CHARS; assert: final user prompt ≤ MAX_USER_PROMPT_CHARS by Unicode character count (`.chars().count()`); lowest-ranked evidence is absent; absent evidence has no evidence_map entry; source IDs are contiguous; every map ID exists in prompt; every prompt `[S#]` exists in map
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo context`
- Expected: all 8 tests FAIL

**GREEN**
- Implement `build_meeting_context` with correct pipeline: history → overhead estimate → item limit → truncate excerpts → dual-budget fit → FINAL list → assign IDs → build map → render prompt
- Implement `build_bounded_history` with most-recent-first truncation
- All `*_CHARS` constants use `.chars().count()` not `.len()`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo context`
- Expected: all 8 tests PASS

**REFACTOR**
- Verify no byte-slicing on Unicode text
- Verify evidence_map contains ONLY included evidence
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/grounding.rs
git commit -m "feat(ask-sivlo): implement evidence budget and citation map integrity"
```

---

## Task 10: Provider Config Resolution (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/provider.rs` (create)

**Interfaces**

```rust
pub(crate) async fn resolve_provider_config(
    pool: &SqlitePool,
    app: &AppHandle<impl Runtime>,
) -> Result<ProviderConfig, String>
// Mirrors existing summary provider resolution pattern
```

This is a thin adapter over `SettingsRepository` — follows the exact pattern from `service.rs`.

**RED**
- Write 1 focused RED test using an in-memory migrated SQLite pool with no model setting:
  1. `missing_model_configuration_returns_configure_model_error` — create an in-memory SQLite pool via the existing migration harness, insert no model settings row, call `resolve_stored_provider_config(&pool)` → returns `Err("No AI model configured. Please configure a model in Settings.")` without any LLM request
- If the full `resolve_provider_config(pool, app_handle)` is awkward to unit-test due to AppHandle, split provider settings resolution into a pure DB helper:
  ```rust
  pub(crate) async fn resolve_stored_provider_config(pool: &SqlitePool) -> Result<ProviderConfig, String>
  // Pure DB lookup — no AppHandle needed
  ```
  and add `app_data_dir` only in the thin AppHandle wrapper
- Do not make real cloud calls
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo provider`
- Expected: test FAILS (module doesn't exist)

**GREEN**
- Implement `resolve_stored_provider_config` (pure DB) and `resolve_provider_config` (AppHandle wrapper) following `service.rs` pattern
- Add `pub mod provider;` to `mod.rs`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo provider`
- Expected: test PASSES

**REFACTOR**
- Verify error messages match existing summary system behavior
- Re-run cargo check

**Verification**
```bash
cd frontend/src-tauri && cargo check
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/provider.rs frontend/src-tauri/src/api/ask_sivlo/mod.rs
git commit -m "feat(ask-sivlo): implement provider config resolution"
```

---

## Task 11: Product Route — Full Implementation (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/mod.rs` (edit — add orchestration)

**Interfaces**

```rust
async fn handle_product_route(
    query: &str,
    history: &[AskSivloHistoryMessage],
    pool: &SqlitePool,
    app: &AppHandle<impl Runtime>,
) -> Result<AskSivloResponse, String>
// Full pipeline: match facts → fallback if none → sanitize history → resolve provider → build prompt → call LLM → return
```

Pipeline:
1. `find_matching_product_facts(query)` → matched facts
2. If no facts match → return `FALLBACK_ANSWER_NO_PRODUCT`, route="product", citations=[]
3. Sanitize/bound history using `build_bounded_history`
4. Resolve existing configured provider via `resolve_provider_config`
5. Construct bounded product prompt: system prompt + product knowledge context + question
6. Call existing `generate_summary()` with the product prompt
7. Return route="product", citations=[] (no citations for product answers)

**RED**
- Write 2 focused tests for prompt construction (testable without DB):
  1. `product_prompt_contains_facts` — matched facts appear in user prompt
  2. `product_prompt_bounded` — prompt respects MAX_USER_PROMPT_CHARS
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo`
- Expected: these 2 tests FAIL

**GREEN**
- Implement `handle_product_route` with full LLM call
- Implement helper `build_product_prompt` for the prompt construction tests
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo`
- Expected: all tests PASS

**REFACTOR**
- Verify no placeholder logic remains
- Verify no "dummy_pool_result" or "In production..." comments
- Verify no meeting evidence in product route
- Re-run all tests

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/mod.rs
git commit -m "feat(ask-sivlo): implement full product route with LLM"
```

---

## Task 12: Main Tauri Command (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/mod.rs` (edit — add command)
- `frontend/src-tauri/src/lib.rs` (edit — register command)

**Interfaces**

```rust
#[tauri::command]
pub async fn api_ask_sivlo<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    query: String,
    history: Vec<AskSivloHistoryMessage>,
    scope: Option<AskSivloScope>,
) -> Result<AskSivloResponse, String>
```

**RED**
- Write 4 focused tests for query validation and scope validation (testable without DB):
  1. `validate_query_too_short` — "ab" → error
  2. `validate_query_too_long` — 4001 chars → error
  3. `validate_explicit_meeting_scope_missing_id` — scope `{ kind: "meeting" }` without meetingId → `Err("Meeting scope requires a meetingId")`, no LLM call
  4. `validate_explicit_meeting_scope_nonexistent` — scope `{ kind: "meeting", meetingId: "nonexistent-123" }` → `Err("Meeting not found")`, no LLM call
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo`
- Expected: these 4 tests FAIL

**GREEN**
- Implement `api_ask_sivlo` command with full pipeline:
  1. Validate query bounds
  2. Validate scope — if explicit meeting scope:
     - Missing meetingId → `Err("Meeting scope requires a meetingId")`
     - Nonexistent meetingId → `Err("Meeting not found")`
  3. Route (meeting vs product)
  4. If product → `handle_product_route`
  5. If meeting → classify → retrieve evidence → if empty AND scope is "all" (not explicit meeting) AND product facts match → `handle_product_route` (post-retrieval fallback) → otherwise meeting fallback → sanitize history → build context → resolve provider → call LLM → extract citations → fail-closed if zero valid citations → return
- Post-retrieval product fallback is NEVER permitted for explicit meeting scope
- Register in `lib.rs` invoke_handler: `api::ask_sivlo::api_ask_sivlo`
- Run: `cd frontend/src-tauri && cargo test --lib ask_sivlo`
- Expected: all tests PASS

**REFACTOR**
- Verify command registration matches existing pattern in `lib.rs` (~line 631)
- Verify no `__cmd__api_ask_sivlo` re-export (not needed)
- Re-run all tests + `cargo check`

**Verification**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo && cargo check
```

**Commit**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/mod.rs frontend/src-tauri/src/lib.rs
git commit -m "feat(ask-sivlo): implement api_ask_sivlo Tauri command"
```

---

## Task 13: Frontend Types + Store Tests (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/types.ts` (create)
- `frontend/src/features/ask-sivlo/askSivloStore.ts` (create)
- `frontend/tests/features/ask-sivlo/store.test.ts` (create)

**Interfaces**

```typescript
// types.ts
export interface AskSivloCitation {
  sourceId: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate?: string;
  sourceType: 'transcript' | 'summary' | 'note' | 'action_item' | 'decision';
  excerpt: string;
  timestampStart?: number;
  timestampEnd?: number;
}

export interface AskSivloMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskSivloCitation[];
  route?: 'meeting' | 'product';
  timestamp: number;
}

export interface AskSivloScope {
  kind: 'all' | 'meeting';
  meetingId?: string;
}

export interface AskSivloHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskSivloResponse {
  answer: string;
  route: 'meeting' | 'product';
  citations: AskSivloCitation[];
}

export interface AskSivloRequest {
  query: string;
  history: AskSivloHistoryMessage[];
  scope?: AskSivloScope;
}
```

```typescript
// askSivloStore.ts — module-level store + useSyncExternalStore
// Pattern from frontend/src/features/meetings/useMeetings.ts
// Snapshot includes scope for subscription-aware rendering:
// interface AskSivloSnapshot {
//   messages: AskSivloMessage[];
//   isLoading: boolean;
//   error: string | null;
//   scope: AskSivloScope;
//   retryRequest: { query: string; scope: AskSivloScope } | null;
// }
```

Key retry behaviors:
- Failed CURRENT request stores `retryRequest: { query, scope }` with current snapshot scope
- Successful request clears `retryRequest` to `null`
- `clearChat` clears `retryRequest` to `null`
- Stale failed requests (generation mismatch) cannot install retry payload
- `retry()` sends the same query/scope using the CURRENT prior conversation state (not stale state)

**RED**
- Write 13 focused Bun tests in `frontend/tests/features/ask-sivlo/store.test.ts`:
  1. `store starts empty` — `getMessages()` returns []
  2. `addMessage appends` — add 2 messages → `getMessages().length === 2`
  3. `clearMessages resets` — add messages, clear → `getMessages()` returns []
  4. `clearMessages increments requestGeneration` — `getRequestGeneration()` increases
  5. `setLoading toggles` — `setLoading(true)` → `getSnapshot().isLoading === true`
  6. `store snapshot includes scope` — default scope is `{ kind: 'all' }`
  7. `unsubscribe/resubscribe preserves state` — subscribe, add message, unsubscribe, re-subscribe → state preserved
  8. `clearChat resets scope` — set scope to meeting, clearChat → scope resets to `{ kind: 'all' }`
  9. `failed request stores retry payload` — `setRetryRequest({ query, scope })` → `getSnapshot().retryRequest` equals payload
  10. `retry payload cleared on success` — set retry → `clearRetryRequest()` → `getSnapshot().retryRequest === null`
  11. `retry payload cleared on clearChat` — set retry → `clearChat()` → retry is null
  12. `stale failure does not create retry payload` — increment generation, set retry at old generation, verify no retry installed (generation guard)
  13. `clearChat increments generation` — `clearChat()` → generation increases (covers stale protection for retry)
- Run: `cd frontend && bun test tests/features/ask-sivlo/store.test.ts`
- Expected: all 13 tests FAIL (module doesn't exist)

**GREEN**
- Create `types.ts` with all interfaces
- Create `askSivloStore.ts` with module-level store (same pattern as `useMeetings.ts`)
- Run: `cd frontend && bun test tests/features/ask-sivlo/store.test.ts`
- Expected: all 13 tests PASS

**REFACTOR**
- Verify no persistence calls (no localStorage, sessionStorage, IndexedDB)
- Verify `requestGeneration` counter works
- Re-run tests

**Verification**
```bash
cd frontend && bun test tests/features/ask-sivlo/store.test.ts
```

**Commit**
```bash
git add frontend/src/features/ask-sivlo/types.ts frontend/src/features/ask-sivlo/askSivloStore.ts frontend/tests/features/ask-sivlo/store.test.ts
git commit -m "feat(ask-sivlo): add frontend types and session store with tests"
```

---

## Task 14: Frontend History + Scope Helpers (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/history.ts` (create — pure helper)
- `frontend/src/features/ask-sivlo/scope.ts` (create — pure helper)
- `frontend/tests/features/ask-sivlo/history.test.ts` (create)
- `frontend/tests/features/ask-sivlo/scope.test.ts` (create)

**Interfaces**

```typescript
// history.ts
export function buildAskSivloHistory(
  messages: AskSivloMessage[],
  maxMessages?: number,
  maxChars?: number,
): AskSivloHistoryMessage[]
// Takes PRIOR messages only (not including current query)
// Current question captured from priorMessages BEFORE appending current user message
// Keeps MOST RECENT messages under limit

export function stripCitationMarkers(content: string): string
// Removes [S1], [S23] etc. from content

export function validateQuery(query: string): { valid: boolean; error?: string }
// Validates query length bounds

// scope.ts
export function createAllScope(): AskSivloScope
export function createMeetingScope(meetingId: string): AskSivloScope
export function isMeetingScope(scope: AskSivloScope): boolean
```

**RED**
- Write 8 focused Bun tests in `frontend/tests/features/ask-sivlo/history.test.ts`:
  1. `current query not duplicated` — 3 prior messages + current query → history has 3, not 4
  2. `only prior turns included` — history does NOT contain the current user message
  3. `newest messages retained under message limit` — 15 messages → only last 10
  4. `newest messages retained under character limit` — long messages → newest kept
  5. `citation markers stripped` — "[S1] hello [S2]" → "hello"
  6. `Unicode character counting safe` — "héllo wörld 🎉" counted by chars, not bytes
  7. `empty messages filtered` — empty content after stripping → excluded
  8. `buildAskSivloHistory returns most recent` — 5 messages → returns last 5

- Write 3 focused Bun tests in `frontend/tests/features/ask-sivlo/scope.test.ts`:
  1. `createAllScope` — returns `{ kind: 'all' }`
  2. `createMeetingScope` — returns `{ kind: 'meeting', meetingId: 'x' }`
  3. `isMeetingScope` — true for meeting scope, false for all scope

- Run: `cd frontend && bun test tests/features/ask-sivlo/`
- Expected: all 11 tests FAIL

**GREEN**
- Create `history.ts` with pure helpers
- Create `scope.ts` with pure helpers
- Run: `cd frontend && bun test tests/features/ask-sivlo/`
- Expected: all 11 tests PASS

**REFACTOR**
- Verify current query is NOT included in history
- Verify newest messages win truncation
- Re-run tests

**Verification**
```bash
cd frontend && bun test tests/features/ask-sivlo/
```

**Commit**
```bash
git add frontend/src/features/ask-sivlo/history.ts frontend/src/features/ask-sivlo/scope.ts frontend/tests/features/ask-sivlo/history.test.ts frontend/tests/features/ask-sivlo/scope.test.ts
git commit -m "feat(ask-sivlo): add history and scope helpers with tests"
```

---

## Task 15: Frontend Hook + Actions Layer (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/useAskSivlo.ts` (create)
- `frontend/src/features/ask-sivlo/actions.ts` (create — pure async orchestration, no React dependency)
- `frontend/tests/features/ask-sivlo/actions.test.ts` (create)

**Interfaces**

```typescript
// types.ts — add request/response types for backend call
export interface AskSivloRequest {
  query: string;
  history: AskSivloHistoryMessage[];
  scope?: AskSivloScope;
}

// actions.ts — pure async send orchestration (no React dependency)
export type AskSivloBackendCall = (
  request: AskSivloRequest,
) => Promise<AskSivloResponse>;

// Default implementation wraps Tauri invoke
const invokeAskSivlo: AskSivloBackendCall = async (request) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<AskSivloResponse>('api_ask_sivlo', {
    query: request.query,
    history: request.history,
    scope: request.scope,
  });
};

export async function sendAskSivloMessage(
  query: string,
  scope: AskSivloScope,
  priorMessages: AskSivloMessage[],
  addUserMessage: (msg: AskSivloMessage) => void,
  addAssistantMessage: (msg: AskSivloMessage) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  getRequestGeneration: () => number,
  incrementRequestGeneration: () => number,
  backendCall: AskSivloBackendCall = invokeAskSivlo,
): Promise<void>
// Calls backendCall, manages loading/error state
// Uses incrementRequestGeneration for stale-response protection

// useAskSivlo.ts — thin subscription/delegation hook
export function useAskSivlo(): {
  messages: AskSivloMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (query: string, scope?: AskSivloScope) => Promise<void>;
  clearChat: () => void;
  scope: AskSivloScope;
  setScope: (scope: AskSivloScope) => void;
  retry: () => Promise<void>;
  retryRequest: { query: string; scope: AskSivloScope } | null;
}
// Thin wrapper: subscribes to store, delegates to actions.ts
```

Key behaviors:
- `sendMessage` builds history from PRIOR messages (not including current query)
- Stale response protection via `requestGeneration` counter (store-level)
- Error messages are user-friendly (no model → "No AI model configured", timeout → "Request timed out")
- `clearChat` resets messages and scope to "all"
- Scope persists across navigation as part of session store

**RED**
- Write 8 focused Bun tests in `frontend/tests/features/ask-sivlo/actions.test.ts`:
  1. `send invokes backend with correct request` — mock backendCall, call sendAskSivloMessage → backendCall called with query, history, scope
  2. `send adds user and assistant messages` — mock backend returns response → addUserMessage + addAssistantMessage called
  3. `send sets loading and error state` — mock backend success → setLoading(true) then setLoading(false); mock backend failure → setError called
  4. `deferred stale response ignored` — send message, clearChat before resolve, old backend resolves → no stale assistant message (uses deferred Promise + controllable backendCall)
  5. `retry invokes backend again with same query/scope` — send fails → retry sends same query/scope to backend again
  6. `retry success clears retry payload` — retry succeeds → clearRetryRequest called
  7. `retry uses current prior conversation state` — send msg1 → send msg2 fails → retry uses msg1+mmsg2 in history (not stale state)
  8. `stale failure does not install retry payload` — increment generation, send fails at old generation → setRetryRequest NOT called
- Run: `cd frontend && bun test tests/features/ask-sivlo/actions.test.ts`
- Expected: all 8 tests FAIL (module doesn't exist)
- Verify TypeScript compilation: `pnpm build` must pass

**GREEN**
- Create `actions.ts` with injectable `AskSivloBackendCall` type, `sendAskSivloMessage` function, and retry action (`retryAskSivlo`) using current store state
- Create `useAskSivlo.ts` as thin subscription/delegation hook using existing store, history, scope helpers and actions; exposes `retry` and `retryRequest`
- Run: `cd frontend && bun test tests/features/ask-sivlo/actions.test.ts`
- Run: `cd frontend && pnpm build`

**REFACTOR**
- Verify no persistence calls
- Verify `buildHistory` called with PRIOR messages only
- Verify retry uses CURRENT store snapshot (not stale state)
- Re-run build

**Verification**
```bash
cd frontend && pnpm build
```

**Commit**
```bash
git add frontend/src/features/ask-sivlo/useAskSivlo.ts frontend/src/features/ask-sivlo/actions.ts frontend/src/features/ask-sivlo/types.ts frontend/tests/features/ask-sivlo/actions.test.ts
git commit -m "feat(ask-sivlo): add useAskSivlo hook, injectable actions layer, and tests"
```

---

## Task 16: Citation Popover + Citation Rendering Helpers (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/CitationPopover.tsx` (create)
- `frontend/src/features/ask-sivlo/citations.ts` (create — pure helpers)
- `frontend/tests/features/ask-sivlo/citations.test.ts` (create)

**Interfaces**

```typescript
// citations.ts — pure helpers (no DOM)
export type CitationSegment = { type: 'text'; text: string } | { type: 'citation'; citationId: string }

export function parseCitationMarkers(content: string): CitationSegment[]
// Splits "Hello [S1] world [S2]" → [{ type: "text", text: "Hello " }, { type: "citation", citationId: "S1" }, ...]

export function resolveCitation(citationId: string, citations: AskSivloCitation[]): AskSivloCitation | undefined
// Finds citation by sourceId

// CitationPopover.tsx — renders citation info in a Popover
// Props: { citation: AskSivloCitation }
// Uses: Popover, PopoverTrigger, PopoverContent from @/components/ui/popover
// Uses: useNavigation from @/hooks/useNavigation
// Source type badge colors: transcript=blue, summary=green, note=yellow, action_item=orange, decision=purple
```

**RED**
- Write 5 focused Bun tests in `frontend/tests/features/ask-sivlo/citations.test.ts`:
  1. `parseCitationMarkers_basic` — "Hello [S1] world" → correct split
  2. `parseCitationMarkers_no_citations` — "Hello world" → single text segment
  3. `parseCitationMarkers_multiple` — "[S1] and [S2]" → correct segments
  4. `resolveCitation_found` — looks up S1 in citations array
  5. `resolveCitation_not_found` — returns undefined for missing ID
- Run: `cd frontend && bun test tests/features/ask-sivlo/citations.test.ts`
- Expected: all 5 tests FAIL

**GREEN**
- Create `citations.ts` with pure helpers
- Create `CitationPopover.tsx` (UI component — manual QA, no DOM test)
- Run: `cd frontend && bun test tests/features/ask-sivlo/citations.test.ts`
- Expected: all 5 tests PASS

**REFACTOR**
- Verify no DOM dependencies in `citations.ts`
- Re-run tests

**Verification**
```bash
cd frontend && bun test tests/features/ask-sivlo/citations.test.ts
```

**Commit**
```bash
git add frontend/src/features/ask-sivlo/CitationPopover.tsx frontend/src/features/ask-sivlo/citations.ts frontend/tests/features/ask-sivlo/citations.test.ts
git commit -m "feat(ask-sivlo): add citation popover and helpers with tests"
```

---

## Task 17: AskSivlo Component + Scope Selector (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/AskSivlo.tsx` (create)
- `frontend/src/components/sivlo/home/HomeWorkspace.tsx` (edit)

**Interfaces**

```typescript
// AskSivlo.tsx — main component
// Uses: Button, Textarea, ScrollArea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem
// Uses: useAskSivlo hook
// Uses: CitationPopover for inline citations
// Uses: parseCitationMarkers, resolveCitation from citations.ts
// Layout: scope selector (Select) + ScrollArea for messages + Textarea input + New Chat button
// Scope selector: "All meetings" (default) + user's meetings from useMeetings()
```

Scope selector requirements:
- Default: "All meetings" → `{ kind: "all" }`
- Other choices: user's meetings loaded from existing `useMeetings()` hook
- No new fetch/store — reuse shared meeting cache
- Selecting meeting sends: `{ kind: "meeting", meetingId }`
- Selected scope survives route navigation as part of session store
- New Chat resets scope to "All meetings"

Provider/error UX requirements:
- If backend returns a missing-model or missing-configuration error:
  show an inline "Configure AI" action that reuses the app's existing
  Settings navigation/opening mechanism. Do not create Ask-Sivlo-specific
  model settings UI.
- Near the composer, show restrained provider disclosure:
  "Responses use your configured AI provider."
- If current provider information is cheaply available through existing
  ConfigContext, clarify local vs cloud behavior without adding another
  settings fetch:
  - Built-in AI → "Local AI"
  - Ollama → "configured Ollama endpoint"
  - Cloud providers → "configured provider"
- Retry button visible when `retryRequest` is non-null; triggers `retry()` from `useAskSivlo`
- No analytics or telemetry

**RED**
- No DOM test — component rendering is manual QA
- Verify TypeScript compilation: `pnpm build` must pass

**GREEN**
- Create `AskSivlo.tsx` with scope selector and all UI
- Edit `HomeWorkspace.tsx` to insert `<AskSivlo />` between PrimaryActions and RecentMeetings
- Run: `cd frontend && pnpm build`

**REFACTOR**
- Verify scope selector uses existing Select component (path: `@/components/ui/select`)
- Verify useMeetings hook provides meeting list
- Verify New Chat resets scope
- Re-run build

**Verification**
```bash
cd frontend && pnpm build
```

**Commit**
```bash
git add frontend/src/features/ask-sivlo/AskSivlo.tsx frontend/src/components/sivlo/home/HomeWorkspace.tsx
git commit -m "feat(ask-sivlo): add AskSivlo component with scope selector"
```

---

## Task 18: Stale-Response Protection + No-Persistence Verification (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/askSivloStore.ts` (verify)
- `frontend/src/features/ask-sivlo/actions.ts` (verify)
- `frontend/tests/features/ask-sivlo/store.test.ts` (verify — tests already green)
- `frontend/tests/features/ask-sivlo/actions.test.ts` (verify — stale-response test already green)

**Interfaces**
No new interfaces — verification task only.

**RED**
No new RED step. Stale-response protection is already tested and green in:
- `store.test.ts` — generation counter tests (Task 13)
- `actions.test.ts` — `deferred stale response ignored` and `stale failure does not install retry payload` tests (Task 15)

**GREEN**
- Run all Ask Sivlo Bun tests:
  ```bash
  cd frontend && bun test tests/features/ask-sivlo/
  ```
- Verify statically that no localStorage, sessionStorage, or IndexedDB calls exist in any Ask Sivlo source files:
  ```bash
  grep -rnE 'localStorage|sessionStorage|IndexedDB' \
    frontend/src/features/ask-sivlo/
  ```
  Expected: empty output (no matches)
- Verify statically that no Analytics imports/calls exist in any Ask Sivlo source files:
  ```bash
  grep -rnE 'analytics|Analytics|track\(|sendEvent\(' \
    frontend/src/features/ask-sivlo/
  ```
  Expected: empty output (no matches)
- Verify stale-response behavior is covered by `actions.test.ts` (`deferred stale response ignored` test) and `store.test.ts` (generation counter tests)

**REFACTOR**
- No refactoring needed — verification only
- Re-run all tests

**Verification**
```bash
cd frontend && bun test tests/features/ask-sivlo/
```

**Commit**
```bash
# No commit needed — verification only, no code changes
```

---

## Task 19: Full Build Verification

**Files**
No new files.

**RED**
- N/A

**GREEN**
- Run all Bun tests:
  ```bash
  cd frontend && bun test
  ```
- Run frontend build:
  ```bash
  cd frontend && pnpm build
  ```
- Run frontend lint:
  ```bash
  cd frontend && pnpm run lint
  ```
- Run ask_sivlo Rust tests:
  ```bash
  cd frontend/src-tauri && cargo test --lib ask_sivlo
  ```
- Run full Rust test suite (no filtering):
  ```bash
  cd frontend/src-tauri && cargo test
  ```
- Run full Rust check:
  ```bash
  cd frontend/src-tauri && cargo check
  ```
- Run whitespace check:
  ```bash
  git diff --check
  ```

**REFACTOR**
- Fix any errors found

**Verification**
All commands pass with zero errors.

```bash
git diff --check

grep -nE 'TODO|TBD|= &\[\.\.\.\]|git add -A' \
  docs/superpowers/plans/2026-08-16-ask-sivlo-implementation.md
```
No implementation placeholders may remain.

**Commit**
```bash
# Only if fixes are needed — use explicit file paths, never git add -A
# git add <specific-files>
# git commit -m "fix(ask-sivlo): resolve build and test issues"
```
(if any fixes needed — skip if clean)

---

## Task 20: Final Plan Verification

Before considering implementation complete, verify:

- [ ] Every spec acceptance criterion maps to a Task
- [ ] Frontend Bun tests are included (Tasks 13, 14, 15, 16, 18)
- [ ] Rust test commands use `cargo test --lib ask_sivlo` (not `-p app_lib`)
- [ ] No placeholders remain (no "may need", "if present", "if applicable", "complete later")
- [ ] Product route is fully implemented with LLM call (Task 11)
- [ ] No false BlackHole claims in product knowledge (Task 5)
- [ ] Retrieval includes normalization/ranking/dedupe (Task 7)
- [ ] Summary conversion preserves headings (Task 6)
- [ ] evidence_map contains only prompt-included evidence (Task 9)
- [ ] Current query is not duplicated in history (Task 14)
- [ ] Newest history wins truncation (Task 14)
- [ ] All `*_CHARS` limits use Unicode-safe char semantics (Task 9)
- [ ] Meeting scope is reachable in UI (Task 17)
- [ ] No analytics/persistence anywhere
- [ ] No dependency additions
- [ ] Explicit meeting scope returns errors, never product fallback (Task 12)
- [ ] score_evidence does not take meeting_title separately (Task 7)
- [ ] Backend call is injectable for testing (Task 15)
- [ ] PRODUCT_FACTS has concrete entries, no ellipsis (Task 5)
- [ ] Import ProductFact says configured transcription provider, not "locally" (Task 5)
- [ ] Provider config resolution has RED test for missing model (Task 10)
- [ ] Task 9 has prompt-pressure budget test (Task 9)
- [ ] Retry state exposed through useAskSivlo (Tasks 13, 15, 17)
- [ ] Task 17 covers provider/error UX and inline Settings action
- [ ] Task 18 is verification-only (no fake RED step)

Run:
```bash
git diff --check
```

---

## File Summary

| File | Action | Task |
|---|---|---|
| `frontend/src-tauri/src/api/ask_sivlo/mod.rs` | **Create** | 1 |
| `frontend/src-tauri/src/api/ask_sivlo/models.rs` | **Create** | 1 |
| `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` | **Create** | 2 |
| `frontend/src-tauri/src/api/ask_sivlo/summary_text.rs` | **Create** | 6 |
| `frontend/src-tauri/src/api/ask_sivlo/retrieval.rs` | **Create** | 7 |
| `frontend/src-tauri/src/api/ask_sivlo/provider.rs` | **Create** | 10 |
| `frontend/src-tauri/src/api/ask_sivlo/product_knowledge.rs` | **Create** | 5 |
| `frontend/src-tauri/src/api/mod.rs` | **Edit** | 1 |
| `frontend/src-tauri/src/lib.rs` | **Edit** | 12 |
| `frontend/src/features/ask-sivlo/types.ts` | **Create** | 13 |
| `frontend/src/features/ask-sivlo/askSivloStore.ts` | **Create** | 13 |
| `frontend/src/features/ask-sivlo/history.ts` | **Create** | 14 |
| `frontend/src/features/ask-sivlo/scope.ts` | **Create** | 14 |
| `frontend/src/features/ask-sivlo/useAskSivlo.ts` | **Create** | 15 |
| `frontend/src/features/ask-sivlo/actions.ts` | **Create** | 15 |
| `frontend/src/features/ask-sivlo/CitationPopover.tsx` | **Create** | 16 |
| `frontend/src/features/ask-sivlo/citations.ts` | **Create** | 16 |
| `frontend/src/features/ask-sivlo/AskSivlo.tsx` | **Create** | 17 |
| `frontend/src/components/sivlo/home/HomeWorkspace.tsx` | **Edit** | 17 |
| `frontend/tests/features/ask-sivlo/store.test.ts` | **Create** | 13 |
| `frontend/tests/features/ask-sivlo/history.test.ts` | **Create** | 14 |
| `frontend/tests/features/ask-sivlo/scope.test.ts` | **Create** | 14 |
| `frontend/tests/features/ask-sivlo/citations.test.ts` | **Create** | 16 |
| `frontend/tests/features/ask-sivlo/actions.test.ts` | **Create** | 15 |

**Total files created:** 21
**Total files edited:** 3
**New npm dependencies:** 0  
**New Cargo dependencies:** 0  

---

## Spec Gate Coverage

| Gate | Covered By |
|---|---|
| TBD/handle-as-needed scan | All Tasks have concrete code; no TODOs or placeholders |
| Persistence leak scan | Store is pure in-memory; Task 18 explicitly verifies |
| Citation integrity | Task 4 (sanitize/extract), Task 9 (evidence map), Task 12 (fail-closed) |
| Type consistency | Task 1 (serde renames match TS interfaces) |
| No scope creep | Non-goals from spec §3 not addressed; no streaming, no persistence, no telemetry |
| Product route completeness | Task 11 (full LLM call, no placeholders) |
| Product fact accuracy | Task 5 (verified against current Sivlo codebase, no Meetily assumptions) |
| Lexical retrieval quality | Task 7 (normalize, score, rank, dedupe) |
| Summary conversion fidelity | Task 6 (faithful port of parse-intelligence.ts) |
| Evidence budget correctness | Task 9 (limit before map, Unicode-safe) |
| History correctness | Task 14 (no duplication, newest wins) |
| Routing precedence | Task 3 (deterministic, ambiguous cases handled) |
| UI scope selector | Task 17 (real Select component, useMeetings integration) |
| Frontend test coverage | Tasks 13, 14, 16, 18 (bun:test) |
