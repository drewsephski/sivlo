# Ask Sivlo General Chat + Settings Deep Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.

- **Spec:** [2026-08-17-ask-sivlo-general-chat-design.md](../specs/2026-08-17-ask-sivlo-general-chat-design.md)
- **Date:** 2026-08-17

---

## Goal

Extend Ask Sivlo from a two-route assistant (meeting + product) into a three-route assistant that also handles general-purpose conversation. Add a Settings deep link from the Configure AI error action to the Summary Models tab. Change the default route from "meeting" to "general" so non-meeting, non-product queries receive normal LLM responses instead of meeting-fallback messaging.

---

## Global Constraints

- No new npm dependencies
- No new Cargo dependencies
- No web search
- No streaming
- No persistent chat/history
- No user-visible General scope
- No LLM classifier/router
- Explicit meeting scope ALWAYS forces meeting route
- General route NEVER performs new meeting retrieval
- Meeting citation/fail-closed behavior remains unchanged
- Product route remains source-controlled via PRODUCT_FACTS
- TDD for every behavioral change
- Focused commits only
- Do not touch unrelated dirty main work
- Do not push

---

## Task 1: Three-Way Routing + General Types (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/models.rs` (edit)
- `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` (edit)

**Interfaces**

```rust
// models.rs — new constant
pub(crate) const SYSTEM_PROMPT_GENERAL: &str = "You are Sivlo, a helpful general-purpose assistant. Answer the user's question normally, accurately, and concisely. Use conversation history for context.";

// grounding.rs — updated signature (return type unchanged, string value changes)
pub(crate) fn route_query(query: &str, scope: &Option<AskSivloScope>) -> &'static str
// Returns: "meeting" | "product" | "general"
// Default changes from "meeting" to "general"

// grounding.rs — new pure helper
pub(crate) fn build_general_context(
    query: &str,
    history: &[AskSivloHistoryMessage],
) -> (String, String)
// Returns (SYSTEM_PROMPT_GENERAL, user_prompt)
// Pipeline:
// 1. sanitize_history(history) — strips old [S#]/[s#] markers
// 2. build_bounded_history(sanitized, MAX_HISTORY_MESSAGES, MAX_HISTORY_CHARS)
// 3. Render: "## Conversation History\n{bounded history lines}\n\n## Question\n{query}"
// 4. Enforce MAX_USER_PROMPT_CHARS via Unicode-safe .chars().count()
// 5. Preserve current question under budget pressure (trim history first)
```

**Routing precedence (unchanged structure, new default):**
1. Explicit meeting scope → "meeting"
2. Clear meeting evidence/temporal intent → "meeting"
3. Clear product question pattern + product keyword → "product"
4. Explicit Sivlo/app reference + product keyword → "product"
5. Everything else → "general" (was "meeting")

**RED — 10 route_query tests (in grounding.rs `#[cfg(test)] mod tests`):**

Existing tests updated for new default:
1. `route_meeting_default` — "tell me about the project" → NOW returns `"general"` (was `"meeting"`)
2. `route_product_only_pattern_no_match` — "how do i cook pasta" → NOW returns `"general"` (was `"meeting"`)

New general-route tests:
3. `route_general_what_can_you_do` — "What can you do?" → `"general"`
4. `route_general_explain_oauth` — "Explain OAuth" → `"general"`
5. `route_general_brainstorm` — "Help me brainstorm a SaaS idea" → `"general"`
6. `route_general_hey` — "Hey" → `"general"`

Existing tests unchanged (regression guard):
7. `route_meeting_explicit_scope` — scope `{ kind: "meeting" }` → `"meeting"`
8. `route_product_question_patterns` — "how do I import audio" → `"product"`
9. `route_product_sivlo_reference` — "can Sivlo do transcription" → `"product"`
10. `route_meeting_evidence_keywords` — "what did Sarah say" → `"meeting"`

Note: "How do I cook pasta?" and "tell me about the project" are covered by tests 2 and 1 respectively (updated expected values). No duplicate tests for the same input/output pair.

**RED — 5 build_general_context tests:**
11. `general_context_includes_current_query` — query text appears in user prompt
12. `general_context_includes_newest_history` — bounded history lines present
13. `general_context_strips_citation_markers` — `[S1]`, `[s3]` removed from history in prompt
14. `general_context_no_meeting_evidence` — no `<meeting_evidence>` tags anywhere in prompt
15. `general_context_pressure_query_preserved_under_budget` — defensive fixture:
    - Query: ~4000 Unicode chars (e.g. `"é".repeat(4000)` — max validated query length)
    - History: 10 messages, each ~500 chars → ~5000 chars total (exceeds MAX_HISTORY_CHARS=4000, so bounded to ~4000)
    - Fixed overhead: section labels ("## Conversation History", "## Question", role prefixes) ~200 chars
    - System prompt: ~150 chars
    - Total before trimming: well under MAX_USER_PROMPT_CHARS (17000), so use a much larger query or more history to create real pressure
    - Better approach: query = `"é".repeat(13000)` + history near MAX_HISTORY_CHARS → total exceeds 17000
    - Assert: `user_prompt.chars().count() <= MAX_USER_PROMPT_CHARS`
    - Assert: full query text remains intact in the prompt
    - Assert: oldest history messages are dropped before newest (count history lines, verify newest retained)
    - Assert: no byte slicing — use `.chars().count()` for all length checks
    - Note: normal `api_ask_sivlo` validation limits queries to 4000 chars; this is a defensive pure-helper test proving `build_general_context` respects its contract independently

**GREEN:**
- Update `route_query` default return from `"meeting"` to `"general"` (line 86 of grounding.rs)
- Add `SYSTEM_PROMPT_GENERAL` constant to models.rs
- Add `build_general_context` pure function to grounding.rs
- Add `use super::models::SYSTEM_PROMPT_GENERAL;` to grounding.rs imports

**Verification:**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo grounding
cd frontend/src-tauri && cargo test --lib ask_sivlo
```

**Commit:**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/models.rs frontend/src-tauri/src/api/ask_sivlo/grounding.rs
git commit -m "feat(ask-sivlo): add general route types, routing, and context builder"
```

---

## Task 2: General Handler + Main Orchestration (Rust)

**Files**
- `frontend/src-tauri/src/api/ask_sivlo/mod.rs` (edit)

**Interfaces**

```rust
// mod.rs — new pure helper (constructs the response contract)
fn build_general_response(answer: String) -> AskSivloResponse {
    AskSivloResponse {
        answer,
        route: "general".to_string(),
        citations: vec![],
    }
}

// mod.rs — new handler (uses build_general_response + existing infrastructure)
pub(crate) async fn handle_general_route(
    query: &str,
    history: &[AskSivloHistoryMessage],
    pool: &sqlx::SqlitePool,
    app: &tauri::AppHandle<impl tauri::Runtime>,
) -> Result<AskSivloResponse, String>
// Pipeline:
// 1. build_general_context(query, history) → (system_prompt, user_prompt)
// 2. resolve_provider_config(pool, app) → ProviderConfig
// 3. generate_summary(client, config, system_prompt, user_prompt, ...)
// 4. build_general_response(answer) → response with route="general", citations=[]
// No retrieval. No PRODUCT_FACTS. No citation extraction. No fail-closed.

// Updated orchestration in api_ask_sivlo:
// After initial deterministic route:
//   "product"  → handle_product_route (unchanged)
//   "general"  → handle_general_route (new)
//   "meeting"  → existing retrieval/grounding behavior (unchanged)
```

**Critical orchestration detail:** The existing post-retrieval product fallback (lines 291-310 of mod.rs) lives inside the meeting route branch. Once `route_query` returns `"general"`, `api_ask_sivlo` must NOT enter the meeting retrieval branch at all. The general handler is called directly, bypassing retrieval entirely.

```rust
// api_ask_sivlo orchestration (updated):
let route = grounding::route_query(&query, &scope);

if route == "product" {
    return handle_product_route(&query, &history, pool, &app).await;
}

if route == "general" {
    return handle_general_route(&query, &history, pool, &app).await;
}

// route == "meeting" — existing retrieval/grounding behavior unchanged
let classification = grounding::classify_query(&query);
let evidence = retrieval::retrieve_meeting_evidence(pool, &query, classification, &scope).await?;
// ... rest of meeting path unchanged
```

**RED — 2 tests (in mod.rs `#[cfg(test)] mod tests`):**
1. `general_response_contract_has_general_route_and_no_citations` — call `build_general_response("test answer")`, assert `response.route == "general"` and `response.citations.is_empty()`. This test FAILS before `build_general_response` exists.
2. `build_general_response_preserves_answer_text` — call `build_general_response("OAuth is...")`, assert `response.answer == "OAuth is..."`.

Note: `general_context_uses_system_prompt_general` is already fully covered in Task 1 test 15's assertion that the prompt contains `SYSTEM_PROMPT_GENERAL` content — no duplication needed here. The network/provider call itself is not unit-tested with a real provider; handler wiring is verified by compilation, code review, and the existing `generate_summary` infrastructure. No mock framework or new dependency is introduced.

**GREEN:**
- Add `build_general_response` pure helper to mod.rs
- Implement `handle_general_route` following the pipeline above
- Update `api_ask_sivlo` orchestration to route `"general"` before the meeting branch
- Ensure the post-retrieval product fallback (lines 291-310) is never reached for general queries
- Add `use grounding::build_general_context;` to mod.rs imports

**Regression verification (after GREEN, not part of RED):**
```bash
# All existing tests must remain green — these are regression gates, not new RED tests
cd frontend/src-tauri && cargo test --lib ask_sivlo
# Specifically verify:
# - existing meeting citation fail-closed tests (answer_citations_zero_valid_ids_fail_closed)
# - existing product route tests (product_prompt_contains_facts, product_prompt_bounded)
# - existing meeting routing tests (route_meeting_explicit_scope, route_meeting_evidence_keywords)
```

**Verification:**
```bash
cd frontend/src-tauri && cargo test --lib ask_sivlo
cd frontend/src-tauri && cargo check
```

**Commit:**
```bash
git add frontend/src-tauri/src/api/ask_sivlo/mod.rs
git commit -m "feat(ask-sivlo): add general route handler and orchestration"
```

---

## Task 3: Frontend Contract + Ask Sivlo UX (TypeScript)

**Files**
- `frontend/src/features/ask-sivlo/types.ts` (edit)
- `frontend/src/features/ask-sivlo/uiConstants.ts` (create — pure constants)
- `frontend/src/features/ask-sivlo/AskSivlo.tsx` (edit — import constants)
- `frontend/tests/features/ask-sivlo/uiConstants.test.ts` (create — Bun test)

**Interfaces**

```typescript
// types.ts — expanded route unions
export interface AskSivloMessage {
  // ...
  route?: 'meeting' | 'product' | 'general';  // was 'meeting' | 'product'
  // ...
}

export interface AskSivloResponse {
  answer: string;
  route: 'meeting' | 'product' | 'general';  // was 'meeting' | 'product'
  citations: AskSivloCitation[];
}
```

```typescript
// uiConstants.ts — pure constants, no React or DOM dependency
export const ASK_SIVLO_EMPTY_STATE_COPY =
  "Ask about your meetings, Sivlo, or anything else.";

export const ASK_SIVLO_CONFIGURE_AI_PATH =
  "/settings?tab=summaryModels";
```

```typescript
// AskSivlo.tsx — imports constants, replaces hardcoded strings
import { ASK_SIVLO_EMPTY_STATE_COPY, ASK_SIVLO_CONFIGURE_AI_PATH } from "./uiConstants";

// handleConfigureAI:
const handleConfigureAI = useCallback(() => {
  router.push(ASK_SIVLO_CONFIGURE_AI_PATH);
}, [router]);

// Empty state:
<p className="text-sm text-muted-foreground">
  {ASK_SIVLO_EMPTY_STATE_COPY}
</p>
```

**Type-check strategy:** The `route` union in `types.ts` is a TypeScript compile-time constraint. Bun transpiles TS and is NOT the authoritative type-check gate. The route union is verified by `pnpm build` (which runs Next.js type-checking). No Bun test is written to "prove" a TS union at runtime — that would be meaningless.

**RED — 2 pure tests (in `frontend/tests/features/ask-sivlo/uiConstants.test.ts`):**
1. `empty_state_copy_matches_general_chat_design` — `ASK_SIVLO_EMPTY_STATE_COPY` equals `"Ask about your meetings, Sivlo, or anything else."`
2. `configure_ai_path_targets_summary_models` — `ASK_SIVLO_CONFIGURE_AI_PATH` equals `"/settings?tab=summaryModels"`

**Regression verification (existing tests, not new RED):**
- Existing citation/message rendering tests in `frontend/tests/features/ask-sivlo/` remain green — general responses with `citations: []` render as plain text via the existing `parseCitationMarkers` path. No new test needed for this; it's covered by existing test infrastructure.

**GREEN:**
- Create `frontend/src/features/ask-sivlo/uiConstants.ts` with both constants
- Create `frontend/tests/features/ask-sivlo/uiConstants.test.ts`
- Update `types.ts` route unions to include `'general'`
- Update `AskSivlo.tsx`: import constants, replace hardcoded strings
- Empty state text becomes `{ASK_SIVLO_EMPTY_STATE_COPY}`
- Configure AI target becomes `router.push(ASK_SIVLO_CONFIGURE_AI_PATH)`

**Verification:**
```bash
cd frontend && bun test tests/features/ask-sivlo/uiConstants.test.ts
cd frontend && bun test tests/features/ask-sivlo/
cd frontend && pnpm build
```

**Commit:**
```bash
git add frontend/src/features/ask-sivlo/types.ts frontend/src/features/ask-sivlo/uiConstants.ts frontend/src/features/ask-sivlo/AskSivlo.tsx frontend/tests/features/ask-sivlo/uiConstants.test.ts
git commit -m "feat(ask-sivlo): expand route union to general, update Configure AI target and empty copy"
```

---

## Task 4: Settings Tab Deep Link (TypeScript)

**Files**
- `frontend/src/features/settings/settingsTab.ts` (create — pure helper, single source of truth for tab values)
- `frontend/tests/features/settings/settingsTab.test.ts` (create — Bun test)
- `frontend/src/app/settings/page.tsx` (edit)

**Single source of truth for tab values:** The existing `TABS` array in `page.tsx` defines raw string values independently. This plan replaces that with a shared constant object in `settingsTab.ts`. The `page.tsx` `TABS` array references these constants for its `value` fields. Labels and icons remain in `page.tsx` (they are UI metadata, not routing values).

**Interfaces**

```typescript
// frontend/src/features/settings/settingsTab.ts
export const SETTINGS_TAB = {
  general: 'general',
  recording: 'recording',
  transcription: 'Transcriptionmodels',
  summary: 'summaryModels',
  beta: 'beta',
} as const;

export type SettingsTab = typeof SETTINGS_TAB[keyof typeof SETTINGS_TAB];

export function parseSettingsTab(
  tabParam: string | null | undefined,
): SettingsTab {
  // Returns validated tab or fallback to SETTINGS_TAB.general
  // null → 'general'
  // undefined → 'general'
  // '' → 'general'
  // 'summaryModels' → 'summaryModels'
  // 'invalidValue' → 'general'
}
```

```typescript
// frontend/src/app/settings/page.tsx — updated TABS uses shared constants
import { SETTINGS_TAB, parseSettingsTab, type SettingsTab } from '@/features/settings/settingsTab';

const TABS = [
  { value: SETTINGS_TAB.general, label: 'General', icon: Settings2 },
  { value: SETTINGS_TAB.recording, label: 'Recordings', icon: Mic },
  { value: SETTINGS_TAB.transcription, label: 'Transcription', icon: DatabaseIcon },
  { value: SETTINGS_TAB.summary, label: 'Summary', icon: SparkleIcon },
  { value: SETTINGS_TAB.beta, label: 'Beta', icon: FlaskConical },
] as const;
```

**Settings reactivity pattern (exact contract):**

```typescript
// Inner component — owns useSearchParams and activeTab state
function SettingsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    () => parseSettingsTab(tabParam),
  );

  useEffect(() => {
    setActiveTab(parseSettingsTab(tabParam));
  }, [tabParam]);

  // ... rest of existing SettingsContent (tabs, tab triggers, tab content)
  // UI tab clicks call setActiveTab directly — no URL rewriting needed
}

// Outer exported page — wraps in Suspense for static export safety
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
```

**Key behaviors:**
- `tabParam` (the string from `searchParams.get("tab")`) is the effect dependency — NOT the entire `searchParams` object
- UI tab clicks update `activeTab` directly without rewriting the URL
- Browser back/forward or programmatic `router.push` with new `?tab=` updates `activeTab` via the effect
- `parseSettingsTab` handles all invalid/missing values → fallback to `general`

**Static build safety:** The Next.js App Router with static export requires `useSearchParams()` to be inside a `<Suspense>` boundary. The split into outer page (with `<Suspense>`) and inner `SettingsContent` (with `useSearchParams`) prevents the `Missing Suspense boundary` build failure.

**RED — 8 tests (in `frontend/tests/features/settings/settingsTab.test.ts`):**
1. `undefined_tab_returns_general` — `parseSettingsTab(undefined)` → `SETTINGS_TAB.general`
2. `null_tab_returns_general` — `parseSettingsTab(null)` → `SETTINGS_TAB.general`
3. `empty_tab_returns_general` — `parseSettingsTab("")` → `SETTINGS_TAB.general`
4. `summary_models_tab_valid` — `parseSettingsTab("summaryModels")` → `SETTINGS_TAB.summary`
5. `recording_tab_valid` — `parseSettingsTab("recording")` → `SETTINGS_TAB.recording`
6. `transcription_tab_valid` — `parseSettingsTab("Transcriptionmodels")` → `SETTINGS_TAB.transcription`
7. `beta_tab_valid` — `parseSettingsTab("beta")` → `SETTINGS_TAB.beta`
8. `invalid_tab_returns_general` — `parseSettingsTab("invalidTabValue")` → `SETTINGS_TAB.general`

Tests use the `SETTINGS_TAB` constants for expected values — no duplicated raw strings.

**GREEN:**
- Create `frontend/src/features/settings/settingsTab.ts` with `SETTINGS_TAB`, `SettingsTab` type, and `parseSettingsTab`
- Create `frontend/tests/features/settings/settingsTab.test.ts`
- Refactor `frontend/src/app/settings/page.tsx`:
  - Import `SETTINGS_TAB`, `parseSettingsTab`, `SettingsTab` from `settingsTab.ts`
  - Replace raw string values in `TABS` array with `SETTINGS_TAB.*` constants
  - Extract inner `SettingsContent` component with `useSearchParams()`, `useState`, `useEffect`
  - Wrap in `<Suspense>` in outer exported `SettingsPage`
  - All existing tab content and behavior unchanged

**Verification:**
```bash
cd frontend && bun test tests/features/settings/settingsTab.test.ts
cd frontend && pnpm build
```

**Commit:**
```bash
git add frontend/src/features/settings/settingsTab.ts frontend/tests/features/settings/settingsTab.test.ts frontend/src/app/settings/page.tsx
git commit -m "feat(settings): add tab query parameter deep link support"
```

---

## Task 5: Full Regression / Acceptance Gate

**Files modified:** None (verification only)

**Verification commands (run fresh, in order):**

```bash
# Rust tests
cd frontend/src-tauri && cargo test --lib ask_sivlo
cd frontend/src-tauri && cargo test
cd frontend/src-tauri && cargo check

# Frontend tests
cd frontend && bun test

# Frontend build (static export + type checking)
cd frontend && pnpm build

# Git hygiene
git diff --check
git status --short
```

**Acceptance checklist (every item from spec §15):**

- [ ] "What can you do?" routes to general and returns normal LLM answer
- [ ] "Explain OAuth" routes to general
- [ ] "What decisions did we make?" still routes to meeting with full grounding
- [ ] "How do I import audio into Sivlo?" still routes to product with product knowledge
- [ ] General route returns `route: "general"` and `citations: []`
- [ ] General route does not include meeting evidence in the prompt
- [ ] General route does not trigger fail-closed citation fallback
- [ ] History is bounded and sanitized for all three routes
- [ ] Configure AI navigates to `/settings?tab=summaryModels`
- [ ] Settings page reads `tab` query parameter and selects correct tab
- [ ] Invalid or missing `tab` defaults to `general`
- [ ] Empty state text says "Ask about your meetings, Sivlo, or anything else."
- [ ] All existing tests remain green
- [ ] `cargo check` passes
- [ ] `cargo test --lib ask_sivlo` passes
- [ ] `pnpm build` passes (includes TypeScript type checking — verifies route union)
- [ ] `git diff --check` clean

**Privacy scan:**
- [ ] No persistent chat/history storage
- [ ] No analytics or telemetry
- [ ] No new raw prompt/query/history logging

**Regression protection:**
- [ ] Meeting citation fail-closed still works (`answer_citations_zero_valid_ids_fail_closed`)
- [ ] Explicit meeting scope still forces meeting (`route_meeting_explicit_scope`)
- [ ] Product route still uses PRODUCT_FACTS (`product_prompt_contains_facts`)
- [ ] General route has no meeting evidence (`general_context_no_meeting_evidence`)
- [ ] General route has no citations (`general_response_contract_has_general_route_and_no_citations`)

**Known pre-existing issue (document, do not fix):**
- `pnpm lint` has an interactive-config issue unrelated to this feature. Do not make lint infrastructure part of this feature.

**No commit for this task** — verification only.

---

## Self-Review

### Spec acceptance criteria → task mapping

| Spec criterion | Task |
|---|---|
| "What can you do?" routes general | Task 1 (route_query test 3) |
| "Explain OAuth" routes general | Task 1 (route_query test 4) |
| "What decisions did we make?" still meeting | Task 1 (regression test 10) |
| "How do I import audio into Sivlo?" still product | Task 1 (regression test 8) |
| General returns route="general", citations=[] | Task 2 (build_general_response tests) |
| General no meeting evidence | Task 1 (general_context test 14) |
| General no fail-closed citation | Task 2 (response contract) |
| History bounded/sanitized all routes | Task 1 (reuses existing functions) |
| Configure AI → /settings?tab=summaryModels | Task 3 (uiConstants test 2) |
| Settings reads tab query param | Task 4 |
| Invalid/missing tab → general | Task 4 (parseSettingsTab tests) |
| Empty state copy updated | Task 3 (uiConstants test 1) |
| All existing tests green | Task 5 |
| cargo check passes | Task 5 |
| pnpm build passes | Task 5 |
| git diff --check clean | Task 5 |

### Route union includes general everywhere needed
- `types.ts`: `AskSivloMessage.route` and `AskSivloResponse.route` — Task 3
- Rust `AskSivloResponse.route` is `String` (no union change needed) — already handles "general"
- Route union verified by `pnpm build` (authoritative TypeScript type-check gate), NOT by Bun test

### Explicit meeting scope always wins
- `route_query` checks explicit scope first (line 39-43 of grounding.rs) — unchanged
- Post-retrieval product fallback never applies to explicit meeting scope — unchanged
- General route never entered when explicit meeting scope present — Task 2 orchestration

### No meeting retrieval in general handler
- `handle_general_route` calls `build_general_context` (no `retrieve_meeting_evidence`) — Task 2
- `api_ask_sivlo` routes to general BEFORE the meeting branch — Task 2

### No citations/fail-closed in general route
- `handle_general_route` uses `build_general_response` returning `citations: vec![]` — Task 2
- No `resolve_citations` call in general handler — Task 2

### Product route remains source-controlled
- `handle_product_route` unchanged — no PRODUCT_FACTS modification
- Existing product tests pass — Task 5 regression verification

### Settings single source of truth
- Tab values defined once in `SETTINGS_TAB` const object in `settingsTab.ts`
- `page.tsx` `TABS` array references `SETTINGS_TAB.*` constants
- Tests use `SETTINGS_TAB` constants for expected values — no duplicated raw strings

### Settings reacts to query changes
- `useEffect` with `tabParam` dependency (not entire `searchParams` object) — Task 4
- Browser back/forward supported — Task 4

### Static Next build safety
- `useSearchParams` inside `<Suspense>` boundary — Task 4
- `pnpm build` verification required — Task 4 and Task 5

### No TODO/TBD/placeholders
- All task steps are concrete with exact files, interfaces, tests, and commands

### No Bun test claiming authoritative type-checking
- Route union is a TypeScript compile-time constraint verified by `pnpm build`
- Bun tests verify runtime constants only (uiConstants, parseSettingsTab)

---

## Key Implementation Decisions

**General route:** Pure prompt construction via `build_general_context` reusing `sanitize_history()` and `build_bounded_history()`. No evidence map, no citation extraction, no meeting retrieval. Uses existing `generate_summary()` and `resolve_provider_config()`.

**Response contract:** `build_general_response(answer)` is a pure helper that constructs `AskSivloResponse { answer, route: "general", citations: vec![] }`. `handle_general_route` calls this after `generate_summary` succeeds. The helper is unit-testable without network calls.

**Meeting regression protection:** The existing `route_query` meeting-intent checks (meeting_evidence keywords, temporal keywords, explicit scope) are untouched. Only the default return changes from `"meeting"` to `"general"`.

**Product regression protection:** The existing `route_query` product checks are untouched. `handle_product_route` is unchanged. Post-retrieval product fallback remains inside the meeting branch only.

**Settings single source of truth:** `SETTINGS_TAB` const object in `settingsTab.ts` owns all canonical tab value strings. `page.tsx` imports and uses these constants in its `TABS` array. Labels and icons remain in `page.tsx`.

**Settings reactivity:** `parseSettingsTab(tabParam)` is the pure validation function. `useState(() => parseSettingsTab(tabParam))` initializes state. `useEffect` with `tabParam` dependency reacts to URL changes. UI clicks update `activeTab` without URL rewriting.

**Settings deep-link approach:** Pure `parseSettingsTab` helper + inner `SettingsContent` component using `useSearchParams()` wrapped in `<Suspense>` in the outer exported page. This is the verified Next.js App Router static-export-safe pattern.

**Next static-build safety:** `useSearchParams()` requires a `<Suspense>` boundary for static export. The split into outer page (with Suspense) and inner content (with useSearchParams) prevents the `Missing Suspense boundary` build failure. `pnpm build` is a required verification gate.

**Constants testability:** UI strings extracted to `uiConstants.ts` — pure constants with no React/DOM dependency, testable with Bun. Route union is a TypeScript type constraint, not a runtime value — verified by `pnpm build`, not by Bun test.

---

## Test Coverage

**Rust (cargo test --lib ask_sivlo):**
- 10 route_query tests (6 updated/new general + 4 unchanged regression)
- 5 build_general_context tests (including pressure/budget test)
- 2 build_general_response tests (genuine new RED tests)
- All existing tests (67 in grounding.rs + 17 in mod.rs) remain green

**Frontend (bun test):**
- 2 uiConstants tests (empty state copy + Configure AI path)
- 8 settingsTab tests (pure validation)
- All existing ask-sivlo tests remain green

**TypeScript type checking:**
- Route union `'meeting' | 'product' | 'general'` verified by `pnpm build`

**Settings:**
- 8 parseSettingsTab unit tests
- pnpm build integration gate

**Full verification:**
- cargo test --lib ask_sivlo
- cargo test
- cargo check
- bun test
- pnpm build
- git diff --check
- git status --short

---

## Commit Plan

| # | Message | Files |
|---|---|---|
| 1 | `feat(ask-sivlo): add general route types, routing, and context builder` | models.rs, grounding.rs |
| 2 | `feat(ask-sivlo): add general route handler and orchestration` | mod.rs |
| 3 | `feat(ask-sivlo): expand route union to general, update Configure AI target and empty copy` | types.ts, uiConstants.ts, AskSivlo.tsx, uiConstants.test.ts |
| 4 | `feat(settings): add tab query parameter deep link support` | settingsTab.ts, settingsTab.test.ts, settings/page.tsx |
| 5 | *(verification only, no commit)* | — |
