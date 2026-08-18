# Ask Sivlo General Chat + AI Settings Deep Link Design

- **Status:** Approved
- **Date:** 2026-08-17
- **Follow-up to:** [2026-08-16-ask-sivlo-design.md](2026-08-16-ask-sivlo-design.md)

---

## 1. Summary

This is a follow-up design spec that extends Ask Sivlo from a two-route assistant (meeting-grounded + product-help) into a three-route assistant that also handles general-purpose conversation. It also adds a deep link from the Configure AI error action to the correct Settings tab. The original Ask Sivlo design (2026-08-16) is not rewritten or replaced.

Ask Sivlo currently routes every query to either meeting or product. General-purpose questions like "hey", "explain OAuth", or "brainstorm a SaaS idea" are incorrectly routed to the meeting path. When no meeting evidence is found for these queries, the user sees "I wasn't able to find verified information in your meetings for this question." — a misleading response for a non-meeting question. The default routing must no longer be meeting.

---

## 2. Goals

- Ask Sivlo becomes a three-route assistant: **meeting**, **product**, and **general**
- General-purpose questions (conversational openers, coding questions, explanations, brainstorming) route to the general path and receive normal LLM responses — not meeting-grounded fallbacks
- General questions must NOT receive the current "I wasn't able to find verified information in your meetings..." fallback simply because they do not match meeting evidence
- The routing model remains deterministic and local — no LLM classifier call
- The Configure AI error action navigates directly to the Summary Models tab in Settings
- The Settings page gains optional query parameter support for tab pre-selection
- No visual redesign of the Ask Sivlo UI

---

## 3. Non-Goals

- No web search or internet browsing capability
- No persistent chat history or cross-session memory
- No streaming responses
- No general-route citations
- No automatic meeting evidence injection into general questions
- No user-visible "General" scope option in the scope selector
- No LLM classifier or router call for route determination
- No Ask Sivlo-specific settings modal or UI
- No corrupted-model error redesign in this change
- No new npm or Cargo dependencies unless implementation discovers a genuine need

---

## 4. Routing Model

### 4.1 Precedence

The routing function takes the current query and the explicit scope. It returns one of three routes deterministically. Session history is NOT an input to routing — it is used by the selected handler for conversational context but does not affect route selection.

**Precedence (evaluated top to bottom, first match wins):**

1. **Explicit meeting scope** — `{ kind: "meeting", meetingId }`
   → ALWAYS meeting route

2. **Clear meeting intent** — query contains meeting-evidence or temporal keywords
   → meeting route

3. **Clear Sivlo/product intent** — query matches product question patterns AND contains Sivlo/product keywords
   → product route

4. **Everything else**
   → general route

### 4.2 Routing Decision Table

| Input | Route | Reason |
|---|---|---|
| `{ kind: "meeting", meetingId: "abc" }` + any query | meeting | Explicit meeting scope |
| "What decisions did we make?" | meeting | Meeting evidence keywords |
| "What did Sarah say?" | meeting | Meeting evidence keywords |
| "What happened yesterday?" | meeting | Temporal reference |
| "How do I import audio into Sivlo?" | product | Product question pattern + Sivlo keyword |
| "Does Sivlo store my meetings locally?" | product | Product question pattern + Sivlo keyword |
| "What can Sivlo do?" | product | Explicit Sivlo reference + capability keyword |
| "What can you do?" | general | No meeting scope, no meeting keywords, no product intent |
| "Explain OAuth" | general | No matching route triggers |
| "Help me brainstorm a SaaS idea" | general | No matching route triggers |
| "Hey" | general | No matching route triggers |
| How to reverse a linked list | general | No matching route triggers |

### 4.3 Critical Distinction

- **"What can you do?"** → GENERAL (refers to the assistant, not the product)
- **"What can Sivlo do?"** → PRODUCT (explicit product reference)
- **"How do I cook pasta?"** → GENERAL (no product keywords present, no meeting keywords)
- **"How do I import audio into Sivlo?"** → PRODUCT (product pattern + Sivlo keyword)

### 4.4 Default Route

The default route is **general**. This is a behavioral change from the current default of "meeting".

Any query that does not match explicit meeting scope, meeting-intent keywords, or product-intent patterns routes to general. The meeting path is no longer the implicit fallback for unrecognized queries.

### 4.5 No LLM Classifier

Routing remains fully deterministic. No second LLM call is made for classification. The existing keyword-based `route_query` function is extended to return `"general"` as a third outcome.

### 4.6 Meeting Route Unchanged

When a query routes to meeting, all current meeting-grounding behavior is preserved:

- Local retrieval across transcripts, summaries, notes, action items, and decisions
- Evidence marked untrusted with `<meeting_evidence>` boundary
- Citations required for factual meeting claims
- Hallucinated citation IDs discarded
- Zero valid current citations fail closed to safe fallback
- Explicit meeting scope never general-falls-back

### 4.7 Product Route Unchanged

When a query routes to product, all current product-help behavior is preserved:

- Source-controlled `PRODUCT_FACTS` grounding
- Product questions not answered from general model knowledge when verified facts exist
- No meeting evidence in the prompt
- `citations: []`

---

## 5. General Route

### 5.1 System Prompt

A new constant `SYSTEM_PROMPT_GENERAL` is defined:

```
You are Sivlo, a helpful general-purpose assistant. Answer the user's question
normally, accurately, and concisely. Use conversation history for context.
```

### 5.2 Behavior

The general route:

- Does NOT perform meeting retrieval
- Does NOT require meeting citations
- Does NOT use `PRODUCT_FACTS` as grounding
- Reuses the user's configured AI provider (same `resolve_provider_config`)
- Reuses `generate_summary()` from `llm_client.rs`
- Sends bounded session history + current query
- Returns `citations: []`
- Returns `route: "general"`

### 5.3 Prompt Construction

```
System: {SYSTEM_PROMPT_GENERAL}

User:
Conversation History (for context only):
User: {history[0].content}
Assistant: {history[1].content}
...

Question: {query}
```

History is sanitized using the existing `sanitize_history()` function (strips old citation markers). History is bounded using the existing `build_bounded_history()` function.

### 5.4 Prompt Budget

General prompt construction reuses the existing bounded conversation constants:

| Constant | Value | Description |
|---|---|---|
| `MAX_HISTORY_MESSAGES` | 10 | Maximum history messages |
| `MAX_HISTORY_CHARS` | 4000 | Total history character budget |
| `MAX_USER_PROMPT_CHARS` | 17000 | Total user prompt budget |

Construction rules:

1. Preserve current question
2. Keep newest history preferentially
3. Strip stale citation markers from history via `sanitize_history()`
4. Use Unicode-safe character counting (`.chars().count()`)
5. Total prompt must remain ≤ `MAX_USER_PROMPT_CHARS`

No meeting evidence budget applies because no meeting evidence is included.

### 5.5 Response Contract

```json
{
  "answer": "...",
  "route": "general",
  "citations": []
}
```

### 5.6 No Evidence Budget

The general route has no evidence items, no evidence context budget, no excerpt truncation, and no citation map construction. The prompt contains only system instructions, bounded history, and the current question.

---

## 6. Response Contract Expansion

### 6.1 Route Union

The route field expands from:

```
"meeting" | "product"
```

to:

```
"meeting" | "product" | "general"
```

### 6.2 Rust Response Type

The existing `AskSivloResponse` struct uses `pub route: String`. The string value `"general"` is added as a valid route outcome. No struct changes are required — serde serialization handles any string.

### 6.3 Frontend TypeScript Types

**`frontend/src/features/ask-sivlo/types.ts`:**

`AskSivloMessage.route` changes from:

```typescript
route?: 'meeting' | 'product';
```

to:

```typescript
route?: 'meeting' | 'product' | 'general';
```

`AskSivloResponse.route` changes from:

```typescript
route: 'meeting' | 'product';
```

to:

```typescript
route: 'meeting' | 'product' | 'general';
```

### 6.4 General Response Semantics

```json
{
  "answer": "OAuth is an open standard for access delegation...",
  "route": "general",
  "citations": []
}
```

The `citations` array is always empty for general responses. No citation popovers or meeting navigation is rendered for general messages.

---

## 7. Privacy

### 7.1 Local Providers

BuiltInAI: processing remains entirely local. No network calls.

Ollama: requests go to the user's configured Ollama endpoint (typically `localhost:11434`).

### 7.2 Cloud Providers

When a cloud LLM provider is configured (OpenAI, Claude, Groq, OpenRouter, CustomOpenAI), the general route sends:

- The user's current question
- Bounded conversation history (citation markers stripped)
- System prompt

The general route performs NO meeting retrieval and injects NO new transcript, summary, note, action item, or decision evidence into the prompt. However, because session history is cross-route, prior user/assistant messages in the history may themselves contain meeting-derived conversational text from earlier meeting-grounded turns. Stale citation markers (`[S1]`, etc.) are stripped from history, but the message text remains.

Selecting explicit meeting scope still routes to meeting and uses grounded meeting evidence normally — it does not fall back to general.

### 7.3 General vs Meeting Privacy Distinction

| Route | What leaves the device (cloud providers) |
|---|---|
| meeting | Query + history + newly retrieved meeting evidence |
| product | Query + history + product knowledge facts |
| general | Query + history; no newly retrieved meeting evidence |

The general route sends the least data of all three routes.

### 7.4 Provider Disclosure

The existing `ProviderDisclosure` component in `AskSivlo.tsx` applies to all routes. The disclosure text ("Responses use your configured provider") remains accurate for general chat. No route-specific disclosure is needed.

---

## 8. General Chat Session History

### 8.1 Bounded Multi-Turn Conversation

General chat supports bounded multi-turn conversation using the existing session history. The session store (`askSivloStore.ts`) already tracks all messages regardless of route. History for the general route is built the same way as for meeting and product routes — using `buildAskSivloHistory()` on the frontend and `build_bounded_history()` on the backend.

### 8.2 Cross-Route History

Session history accumulates all messages in the current conversation, regardless of route. If the user alternates between meeting, product, and general questions within the same session, the history sent to the backend includes prior messages from all routes.

History is sanitized (citation markers stripped) before being sent, so prior meeting citations do not leak into general prompts.

### 8.3 No Persistence

General chat, like meeting and product chat, is session-only. No chat history is persisted to database, filesystem, localStorage, or IndexedDB. App restart clears the conversation.

---

## 9. Settings Deep Link

### 9.1 Current Settings Tabs

The Settings page defines tabs as a constant:

```typescript
const TABS = [
  { value: 'general', label: 'General', icon: Settings2 },
  { value: 'recording', label: 'Recordings', icon: Mic },
  { value: 'Transcriptionmodels', label: 'Transcription', icon: DatabaseIcon },
  { value: 'summaryModels', label: 'Summary', icon: SparkleIcon },
  { value: 'beta', label: 'Beta', icon: FlaskConical }
] as const;
```

### 9.2 Query Parameter Support

The Settings page reads an optional `tab` query parameter from the URL.

**Behavior:**

| Query parameter | Behavior |
|---|---|
| Absent | Default to `general` tab (current behavior preserved) |
| `tab=summaryModels` | Select the Summary Models tab |
| `tab=general` | Select the General tab |
| `tab=recording` | Select the Recordings tab |
| `tab=Transcriptionmodels` | Select the Transcription tab |
| `tab=beta` | Select the Beta tab |
| `tab=invalidValue` | Default to `general` tab |
| `tab=` (empty) | Default to `general` tab |

**Validated tab values:** Only exact matches against the `TABS` array `value` fields are accepted. All other values are ignored and fall back to `general`.

**Implementation approach:**

1. Read `searchParams.get('tab')` from the URL
2. Validate the value against the known `TABS` values
3. If valid, call `setActiveTab(validatedValue)`
4. If invalid or absent, fall back to `general`
5. If the URL `tab` query parameter changes while Settings remains mounted, `activeTab` updates to the newly validated value — this supports browser back/forward and router navigation from another valid settings tab URL

### 9.3 Browser Navigation

The Settings page reacts to `tab` query parameter changes, not only the initial mount. Navigating to `/settings?tab=summaryModels` from another page, using browser back/forward, or changing the URL while Settings is mounted all update the active tab. Changing tabs via the UI does NOT need to update the URL.

### 9.4 No Ask-Sivlo-Specific Settings UI

The Settings page gains no Ask Sivlo-specific configuration UI. The deep link simply opens an existing tab. The Summary Models tab is the correct destination because it contains the AI provider/model configuration that Ask Sivlo depends on.

---

## 10. Configure AI Deep Link

### 10.1 Current Behavior

`AskSivlo.tsx` defines:

```typescript
const handleConfigureAI = useCallback(() => {
  router.push("/settings");
}, [router]);
```

This navigates to `/settings`, which defaults to the General tab.

### 10.2 New Behavior

The navigation target changes from:

```typescript
router.push("/settings")
```

to:

```typescript
router.push("/settings?tab=summaryModels")
```

### 10.3 Error Matching Scope

The `isConfigError` function continues to match the same error patterns. No broadening of error detection is in scope. The function currently matches:

- `"no ai model configured"`
- `"not configured"`
- `"missing model"`

These patterns are sufficient. The Configure AI button continues to appear only for configuration-related errors.

### 10.4 Corrupted Local Model Error

The corrupted-local-model error discovered manually is OUT OF SCOPE for this spec. It may be addressed as a separate future improvement.

---

## 11. Frontend UX

### 11.1 No Visual Redesign

Ask Sivlo UI remains the same compact homepage panel. No changes to layout, styling, or component structure.

### 11.2 Message Rendering

General messages render exactly like other assistant messages. The `AssistantMessage` component parses citation markers and renders `CitationPopover` for resolved citations. Since general responses contain no citations (`citations: []`), no citation markers appear, and no citation popovers are rendered. The answer text renders as plain text segments.

### 11.3 No Meeting-Fallback Messaging

General responses must not display "I wasn't able to find verified information in your meetings..." or any meeting-fallback messaging. The general route simply returns the LLM's answer.

### 11.4 Empty State

The empty state text updates from:

> "Ask about your meetings or Sivlo."

to:

> "Ask about your meetings, Sivlo, or anything else."

### 11.5 Example Prompts

The example prompt buttons in the empty state remain as-is (meeting and product questions). A general-purpose example is not added — the user can naturally type any general question.

### 11.6 Scope Selector

The scope selector stays as:

- All meetings
- Specific meeting(s)

No "General" scope option is added. General vs meeting/product is routing behavior, not a user-selected scope mode. Selecting a specific meeting continues to force meeting-grounded behavior.

### 11.7 Provider Disclosure

The `ProviderDisclosure` component at the bottom of the panel applies to all routes unchanged.

---

## 12. Error Handling

### 12.1 General Route Errors

The general route shares the same error handling as meeting and product routes:

| Error Condition | Behavior |
|---|---|
| No model configured | Returns `Err("No AI model configured...")` → frontend shows Configure AI button targeting `/settings?tab=summaryModels` |
| LLM timeout | Returns `Err("LLM request timed out")` → frontend shows retry |
| LLM API error | Returns `Err("LLM API error: {detail}")` → frontend shows retry |
| Database error | Returns `Err("Database error: {detail}")` → frontend shows retry |

### 12.2 General Route Never Fail-Closed on Citations

The general route has no evidence and no citations. The fail-closed zero-valid-citations behavior applies only to the meeting route. The general route always returns the LLM's response directly.

---

## 13. Testing Requirements

### 13.1 Rust Routing Tests

| Test | Input | Expected Route |
|---|---|---|
| Explicit meeting scope forces meeting | scope `{ kind: "meeting", meetingId: "x" }`, query "anything" | meeting |
| Clear meeting query routes meeting | "What decisions did we make?" | meeting |
| Clear Sivlo question routes product | "How do I import audio into Sivlo?" | product |
| "what can you do?" routes general | "What can you do?" | general |
| "what can Sivlo do?" routes product | "What can Sivlo do?" | product |
| Arbitrary general question routes general | "Explain OAuth" | general |
| Conversational opener routes general | "hey" | general |
| Temporal reference routes meeting | "What happened yesterday?" | meeting |
| Product pattern without product keyword routes general | "How do I cook pasta?" | general |
| Default is general (not meeting) | "tell me about the project" | general |

### 13.2 General Prompt Tests

| Test | What It Verifies |
|---|---|
| Includes current query | Query text appears in user prompt |
| Includes newest bounded history | History present when prior messages exist |
| Strips old citation markers | `[S1]`, `[S23]` removed from history in prompt |
| Does not contain meeting evidence | No `<meeting_evidence>` tags in general prompt |
| Respects MAX_USER_PROMPT_CHARS | Prompt ≤ 17000 chars (Unicode-safe) |
| No evidence map constructed | `evidence_map` is empty for general route |

### 13.3 General Handler Tests

| Test | What It Verifies |
|---|---|
| Returns route="general" | Response route field is `"general"` |
| Returns citations=[] | Citations array is empty |
| Deterministic prompt construction | Prompt is testable without network (unit-testable) |
| Uses SYSTEM_PROMPT_GENERAL | System prompt matches expected constant |
| Reuses provider config | Same `resolve_provider_config` as other routes |

### 13.4 Regression Tests

| Test | What It Verifies |
|---|---|
| Existing meeting citation fail-closed tests remain green | No behavioral regression |
| Existing product route tests remain green | No behavioral regression |
| Existing classify_query tests remain green | Internal classification unchanged |
| Existing context budget tests remain green | Budget enforcement unchanged |

### 13.5 Frontend Tests

| Test | What It Verifies |
|---|---|
| Route union accepts "general" | TypeScript types compile with general route |
| Assistant general response renders safely | `citations=[]` renders as plain text, no crash |
| No meeting-fallback message for general | "I wasn't able to find..." never appears for route="general" |
| Empty state text updated | "Ask about your meetings, Sivlo, or anything else." |

### 13.6 Settings Deep Link Tests

| Test | What It Verifies |
|---|---|
| Missing tab → general | No query param → `general` tab active |
| `tab=summaryModels` → summaryModels | Summary Models tab active |
| Valid other tab works | `tab=recording` → Recordings tab active |
| Invalid tab → general | `tab=invalidTabValue` → `general` tab active |
| Empty tab → general | `tab=` → `general` tab active |

### 13.7 Configure AI Tests

| Test | What It Verifies |
|---|---|
| Navigation target is exactly `/settings?tab=summaryModels` | Router push called with correct path |

### 13.8 No New Testing Dependencies

All tests use existing infrastructure: Rust `cargo test`, Bun `bun test`.

---

## 14. Implementation Boundaries

### 14.1 Files Modified

**Rust (backend):**
- `frontend/src-tauri/src/api/ask_sivlo/models.rs` — add `SYSTEM_PROMPT_GENERAL` constant
- `frontend/src-tauri/src/api/ask_sivlo/grounding.rs` — extend `route_query` to return `"general"`, add `build_general_context` function
- `frontend/src-tauri/src/api/ask_sivlo/mod.rs` — add `handle_general_route` function, update `api_ask_sivlo` to route to general, add general-route tests

**TypeScript (frontend):**
- `frontend/src/features/ask-sivlo/types.ts` — expand route unions to include `"general"`
- `frontend/src/features/ask-sivlo/AskSivlo.tsx` — update `handleConfigureAI` target, update empty state text
- `frontend/src/app/settings/page.tsx` — add `tab` query parameter reading and validation

### 14.2 Files NOT Modified

- `frontend/src/features/ask-sivlo/actions.ts` — no changes needed (route is opaque to actions layer)
- `frontend/src/features/ask-sivlo/history.ts` — no changes needed (history building is route-agnostic)
- `frontend/src/features/ask-sivlo/askSivloStore.ts` — no changes needed (store is route-agnostic)
- `frontend/src-tauri/src/api/ask_sivlo/product_knowledge.rs` — no changes needed
- `frontend/src-tauri/src/api/ask_sivlo/retrieval.rs` — no changes needed
- `frontend/src-tauri/src/api/ask_sivlo/provider.rs` — no changes needed
- `frontend/src-tauri/src/api/ask_sivlo/summary_text.rs` — no changes needed

---

## 15. Rollout / Acceptance Criteria

### Minimum Acceptance

- [ ] "What can you do?" routes to general and returns a normal LLM answer (not meeting fallback)
- [ ] "Explain OAuth" routes to general and returns a normal LLM answer
- [ ] "What decisions did we make?" still routes to meeting with full grounding
- [ ] "How do I import audio into Sivlo?" still routes to product with product knowledge
- [ ] General route returns `route: "general"` and `citations: []`
- [ ] General route does not include meeting evidence in the prompt
- [ ] General route does not trigger fail-closed citation fallback
- [ ] History is bounded and sanitized for all three routes
- [ ] Configure AI button navigates to `/settings?tab=summaryModels`
- [ ] Settings page reads `tab` query parameter and selects the correct tab
- [ ] Invalid or missing `tab` defaults to `general`
- [ ] Empty state text says "Ask about your meetings, Sivlo, or anything else."
- [ ] All existing tests remain green
- [ ] `cargo check` passes
- [ ] `cargo test --lib ask_sivlo` passes
- [ ] `pnpm build` passes
- [ ] `git diff --check` clean

---

## 16. Deferred Follow-ups

These are explicitly out of scope for this change but may be considered later:

- **Streaming responses**: Show tokens as they arrive from LLM
- **General-route citations**: Source citations for general knowledge answers
- **Web search**: Internet-augmented general chat
- **Persistent chat history**: Optional session history saved to database
- **Cross-session memory**: Recall facts from prior conversations
- **Corrupted model error redesign**: Better UX for corrupted local model files
- **User-selectable route override**: Let user explicitly choose meeting/product/general mode
